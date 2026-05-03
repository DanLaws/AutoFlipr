import logging
from datetime import datetime, timezone

from celery import shared_task
from pydantic import ValidationError
from sqlalchemy.orm import Session

from autoflipr.db.models import Listing, LLMInsight, PriceHistory
from autoflipr.db.session import SessionLocal
from autoflipr.config import settings
from autoflipr.llm import gemini_client
from autoflipr.llm.direct_extract import direct_extract
from autoflipr.llm.schemas import (
    ListingExtraction, MOTNarrative, VehicleAnalysis,
    PROMPT_VERSION_EXTRACTION, PROMPT_VERSION_MOT, PROMPT_VERSION_ANALYSIS,
)

log = logging.getLogger(__name__)

_REQUIRED_FIELDS = ("make", "model", "year", "price_gbp")


def _normalise(s: str | None) -> str | None:
    """Title-case a make/model/variant string so comparables queries match regardless
    of whether the source was ALLCAPS (direct_extract) or Title Case (LLM)."""
    return s.title() if s else s


def _apply_extraction(listing: Listing, data: dict, db) -> None:
    """Write extracted fields onto the listing model."""
    prev_price = listing.price_gbp
    listing.make = _normalise(data.get("make"))
    listing.model = _normalise(data.get("model"))
    listing.variant = _normalise(data.get("variant"))
    listing.year = data.get("year")
    if data.get("mileage") is not None:
        listing.mileage = data["mileage"]
    listing.price_gbp = data.get("price_gbp")
    listing.registration = data.get("registration")
    listing.seller_type = data.get("seller_type")
    listing.seller_name = data.get("seller_name")
    listing.body_type = data.get("body_type")
    listing.colour = data.get("colour")
    listing.urgency_tags = data.get("urgency_tags") or []
    listing.location_raw = data.get("location_text")
    listing.llm_status = "valid"

    if data.get("_lat") is not None and data.get("_lng") is not None:
        # Source already provided coordinates (e.g. Gumtree ltlng field) — use directly.
        listing.latitude = data["_lat"]
        listing.longitude = data["_lng"]
    elif data.get("location_text"):
        from autoflipr.geo import geocode_uk_location
        coords = geocode_uk_location(data["location_text"])
        if coords:
            listing.latitude, listing.longitude = coords

    if data.get("price_gbp") and data["price_gbp"] != prev_price:
        db.add(PriceHistory(listing_id=listing.id, price_gbp=data["price_gbp"]))


@shared_task(bind=True, max_retries=5, rate_limit="14/m", queue="llm")
def extract_listing_task(self, listing_id: int) -> None:
    db: Session = SessionLocal()
    try:
        listing = db.get(Listing, listing_id)
        if not listing or not listing.raw_html:
            return

        # ── Direct parser (free, instant, no quota) ──────────────────────────
        direct = direct_extract(listing.source, listing.raw_html)
        if direct and all(direct.get(f) for f in _REQUIRED_FIELDS):
            _apply_extraction(listing, direct, db)
            db.add(LLMInsight(
                listing_id=listing_id,
                kind="extraction",
                model="direct",
                prompt_version="direct-v1",
                parsed_output=direct,
                validation_status="valid",
                input_tokens=0,
                output_tokens=0,
            ))
            db.commit()
            log.info("Direct extraction succeeded listing=%d source=%s", listing_id, listing.source)
            from autoflipr.tasks.score import score_listing_task
            score_listing_task.delay(listing_id)
            analyse_vehicle_task.delay(listing_id)
            return

        # ── LLM fallback (Facebook, and any direct-parse failures) ───────────
        raw_output, in_tok, out_tok = gemini_client.extract_listing(listing.raw_html)
        validation_status = "invalid"
        parsed_output = None

        if raw_output:
            try:
                extracted = ListingExtraction.model_validate(raw_output)
                validation_status = "valid"
                parsed_output = extracted.model_dump()
                _apply_extraction(listing, parsed_output, db)
            except ValidationError as exc:
                log.warning("Extraction validation failed listing=%d: %s", listing_id, exc)
                listing.llm_status = "invalid"

        db.add(LLMInsight(
            listing_id=listing_id,
            kind="extraction",
            model=settings.gemini_model,
            prompt_version=PROMPT_VERSION_EXTRACTION,
            raw_output=raw_output,
            parsed_output=parsed_output,
            validation_status=validation_status,
            input_tokens=in_tok,
            output_tokens=out_tok,
        ))
        db.commit()

        if validation_status == "valid":
            from autoflipr.tasks.score import score_listing_task
            score_listing_task.delay(listing_id)
            analyse_vehicle_task.delay(listing_id)

    except Exception as exc:
        db.rollback()
        log.exception("extract_listing_task failed listing=%d", listing_id)
        countdown = min(300 * (2 ** self.request.retries), 3600)  # 5 min → 10 → 20 → 40 → 60 min
        try:
            raise self.retry(exc=exc, countdown=countdown)
        except self.MaxRetriesExceededError:
            log.error(
                "extract_listing_task permanently failed listing=%d after %d retries",
                listing_id, self.max_retries,
            )
            try:
                row = db.get(Listing, listing_id)
                if row:
                    row.llm_status = "failed_permanent"
                    db.commit()
            except Exception:
                pass
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=60, queue="llm")
def analyse_mot_task(self, listing_id: int) -> None:
    db: Session = SessionLocal()
    try:
        listing = db.get(Listing, listing_id)
        if not listing or not listing.registration:
            return

        from autoflipr.db.models import MOTHistory
        mot_rows = (
            db.query(MOTHistory)
            .filter(MOTHistory.registration == listing.registration)
            .order_by(MOTHistory.test_date.desc())
            .all()
        )
        if not mot_rows:
            return

        records = [
            {
                "test_date": str(r.test_date),
                "result": r.test_result,
                "odometer": r.odometer,
                "advisories": r.advisories or [],
                "failures": r.failures or [],
            }
            for r in mot_rows
        ]

        raw_output, in_tok, out_tok = gemini_client.analyse_mot(records)
        validation_status = "invalid"
        parsed_output = None

        if raw_output:
            try:
                narrative = MOTNarrative.model_validate(raw_output)
                validation_status = "valid"
                parsed_output = narrative.model_dump()
            except ValidationError as exc:
                log.warning("MOT narrative validation failed listing=%d: %s", listing_id, exc)

        db.add(LLMInsight(
            listing_id=listing_id,
            kind="mot_narrative",
            model=settings.gemini_model,
            prompt_version=PROMPT_VERSION_MOT,
            raw_output=raw_output,
            parsed_output=parsed_output,
            validation_status=validation_status,
            input_tokens=in_tok,
            output_tokens=out_tok,
        ))
        db.commit()

    except Exception as exc:
        db.rollback()
        log.exception("analyse_mot_task failed listing=%d", listing_id)
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=60, rate_limit="14/m", queue="llm")
def analyse_vehicle_task(self, listing_id: int) -> None:
    db: Session = SessionLocal()
    try:
        listing = db.get(Listing, listing_id)
        if not listing or not listing.raw_html:
            return

        raw_output, in_tok, out_tok = gemini_client.analyse_vehicle(listing.raw_html)
        validation_status = "invalid"
        parsed_output = None

        if raw_output:
            try:
                analysis = VehicleAnalysis.model_validate(raw_output)
                validation_status = "valid"
                parsed_output = analysis.model_dump()
            except Exception as exc:
                log.warning("Vehicle analysis validation failed listing=%d: %s", listing_id, exc)

        db.add(LLMInsight(
            listing_id=listing_id,
            kind="vehicle_analysis",
            model=settings.gemini_model,
            prompt_version=PROMPT_VERSION_ANALYSIS,
            raw_output=raw_output,
            parsed_output=parsed_output,
            validation_status=validation_status,
            input_tokens=in_tok,
            output_tokens=out_tok,
        ))
        db.commit()

    except Exception as exc:
        db.rollback()
        log.exception("analyse_vehicle_task failed listing=%d", listing_id)
        raise self.retry(exc=exc)
    finally:
        db.close()
