import logging
from datetime import datetime, timezone, timedelta

from celery import shared_task
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from autoflipr.db.models import Listing, DealScore, MOTHistory
from autoflipr.db.session import SessionLocal
from autoflipr.scoring.engine import (
    Comparable, MOTSummary, ScoringResult, score_listing, ALGORITHM_VERSION
)

log = logging.getLogger(__name__)

_YEAR_BAND = 1
_MILEAGE_BAND = 0.3
_LOOKBACK_DAYS = 60


def score_listing_sync(db: Session, listing_id: int) -> None:
    """
    Run the full scoring pipeline synchronously against an open DB session.

    Shared by both the Celery task (score_listing_task) and the inline scan
    path (scan_url_task) so the two always produce identical results.
    """
    listing = db.get(Listing, listing_id)
    if not listing or listing.llm_status != "valid":
        return
    if not all([listing.make, listing.model, listing.year, listing.mileage, listing.price_gbp]):
        return

    cutoff = datetime.now(timezone.utc) - timedelta(days=_LOOKBACK_DAYS)

    def _query_comps(year_band: int, mileage_lo: float, mileage_hi: float) -> list[Comparable]:
        rows = (
            db.query(Listing.price_gbp, Listing.mileage)
            .filter(
                and_(
                    func.lower(Listing.make) == (listing.make or "").lower(),
                    func.lower(Listing.model) == (listing.model or "").lower(),
                    Listing.year.between(listing.year - year_band, listing.year + year_band),
                    Listing.mileage.between(
                        int(listing.mileage * mileage_lo),
                        int(listing.mileage * mileage_hi),
                    ),
                    Listing.llm_status == "valid",
                    Listing.first_seen_at >= cutoff,
                    Listing.removed_at.is_(None),
                    Listing.id != listing_id,
                    Listing.price_gbp.isnot(None),
                    Listing.mileage.isnot(None),
                )
            )
            .limit(200)
            .all()
        )
        return [Comparable(price_gbp=r[0], mileage=r[1]) for r in rows]

    comparables = _query_comps(_YEAR_BAND, 1 - _MILEAGE_BAND, 1 + _MILEAGE_BAND)

    # Widen bands if too few comparables
    if len(comparables) < 5:
        comparables = _query_comps(2, 0.6, 1.4)

    # Build MOT summary if registration is known
    mot_summary = None
    if listing.registration:
        two_years_ago = (datetime.now(timezone.utc) - timedelta(days=730)).date()
        mot_rows = (
            db.query(MOTHistory)
            .filter(
                MOTHistory.registration == listing.registration,
                MOTHistory.test_date >= two_years_ago,
            )
            .all()
        )
        has_any = (
            db.query(MOTHistory)
            .filter(MOTHistory.registration == listing.registration)
            .first() is not None
        )
        mot_summary = MOTSummary(
            failures_last_2y=sum(1 for r in mot_rows if r.test_result == "FAIL"),
            major_advisories_last_2y=sum(len(r.failures or []) for r in mot_rows),
            has_record=has_any,
            vehicle_age_years=(datetime.now().year - listing.year if listing.year else 0),
        )

    result: ScoringResult | None = score_listing(
        price_gbp=listing.price_gbp,
        mileage=listing.mileage,
        comparables=comparables,
        mot=mot_summary,
    )

    if result is None:
        log.info("Insufficient comparables for listing=%d", listing_id)
        return

    db.add(DealScore(
        listing_id=listing_id,
        score=result.score,
        estimated_value_gbp=result.estimated_value_gbp,
        estimated_margin_gbp=result.estimated_margin_gbp,
        price_deviation_pct=result.price_deviation_pct,
        comparable_count=result.comparable_count,
        mot_penalty=result.mot_penalty,
        confidence=result.confidence,
        algorithm_version=ALGORITHM_VERSION,
    ))
    db.commit()


@shared_task(queue="score")
def rescore_unscored_task() -> None:
    """Queue scoring for every valid listing that has no DealScore row yet."""
    from sqlalchemy import not_, exists as sa_exists
    db: Session = SessionLocal()
    try:
        ids = [
            l.id for l in (
                db.query(Listing)
                .filter(Listing.llm_status == "valid", Listing.removed_at.is_(None))
                .filter(~sa_exists().where(DealScore.listing_id == Listing.id))
                .all()
            )
        ]
        for lid in ids:
            score_listing_task.delay(lid)
        if ids:
            log.info("rescore_unscored_task: queued %d listings", len(ids))
    finally:
        db.close()


@shared_task(bind=True, max_retries=2, default_retry_delay=60, queue="score")
def score_listing_task(self, listing_id: int) -> None:
    db: Session = SessionLocal()
    try:
        score_listing_sync(db, listing_id)
    except Exception as exc:
        db.rollback()
        log.exception("score_listing_task failed listing=%d", listing_id)
        raise self.retry(exc=exc)
    finally:
        db.close()
