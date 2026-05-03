import logging
from datetime import date

from celery import shared_task
from sqlalchemy.orm import Session

from autoflipr.db.models import Listing, MOTHistory
from autoflipr.db.session import SessionLocal
from autoflipr.mot.dvsa import fetch_mot_history

log = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=120, queue="mot")
def fetch_mot_for_listing(self, listing_id: int) -> None:
    db: Session = SessionLocal()
    try:
        listing = db.get(Listing, listing_id)
        if not listing or not listing.registration:
            return

        records = fetch_mot_history(listing.registration)
        for r in records:
            existing = (
                db.query(MOTHistory)
                .filter(
                    MOTHistory.registration == listing.registration,
                    MOTHistory.test_date == r["test_date"],
                )
                .first()
            )
            if existing:
                continue

            db.add(MOTHistory(
                registration=listing.registration,
                test_date=date.fromisoformat(r["test_date"]) if r["test_date"] else None,
                test_result=r["test_result"],
                odometer=r["odometer"],
                odometer_unit=r.get("odometer_unit", "mi"),
                expiry_date=date.fromisoformat(r["expiry_date"]) if r.get("expiry_date") else None,
                advisories=r.get("advisories", []),
                failures=r.get("failures", []),
            ))

        db.commit()

        from autoflipr.llm.tasks import analyse_mot_task
        analyse_mot_task.delay(listing_id)

    except Exception as exc:
        db.rollback()
        log.exception("fetch_mot_for_listing failed listing=%d", listing_id)
        raise self.retry(exc=exc)
    finally:
        db.close()
