import logging
from datetime import datetime, timezone

from celery import shared_task
from pydantic import ValidationError
from sqlalchemy.orm import Session

from carflip.db.models import Listing, LLMInsight, PriceHistory
from carflip.db.session import SessionLocal
from carflip.config import settings
from carflip.llm import gemini_client
from carflip.llm.schemas import (
    ListingExtraction, MOTNarrative, VehicleAnalysis,
    PROMPT_VERSION_EXTRACTION, PROMPT_VERSION_MOT, PROMPT_VERSION_ANALYSIS,
)

log = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=None, default_retry_delay=300, rate_limit="12/m", queue="llm")
def extract_listing_task(self, listing_id: int) -> None:
    db: Session = SessionLocal()
    try:
        listing = db.get(Listing, listing_id)
        if not listing or not listing.raw_html:
            return

        raw_output, in_tok, out_tok = gemini_client.extract_listing(listing.raw_html)
        validation_status = "invalid"
        parsed_output = None

        if raw_output:
            try:
                extracted = ListingExtraction.model_validate(raw_output)
                validation_status = "valid"
                parsed_output = extracted.model_dump()

                prev_price = listing.price_gbp

                # Write extracted fields back to listing
                listing.make = extracted.make
                listing.model = extracted.model
                listing.variant = extracted.variant
                listing.year = extracted.year
                if extracted.mileage is not None:
                    listing.mileage = extracted.mileage
                listing.price_gbp = extracted.price_gbp
                listing.registration = extracted.registration
                listing.seller_type = extracted.seller_type
                listing.seller_name = extracted.seller_name
                listing.body_type = extracted.body_type
                listing.colour = extracted.colour
                listing.urgency_tags = extracted.urgency_tags or []
                listing.location_raw = extracted.location_text
                listing.llm_status = "valid"

                if extracted.location_text:
                    from carflip.geo import geocode_uk_location
                    coords = geocode_uk_location(extracted.location_text)
                    if coords:
                        listing.latitude, listing.longitude = coords

                # Record price snapshot if price changed or this is the first extraction
                if extracted.price_gbp and extracted.price_gbp != prev_price:
                    db.add(PriceHistory(listing_id=listing_id, price_gbp=extracted.price_gbp))

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
            from carflip.tasks.score import score_listing_task
            score_listing_task.delay(listing_id)
            analyse_vehicle_task.delay(listing_id)

    except Exception as exc:
        db.rollback()
        log.exception("extract_listing_task failed listing=%d", listing_id)
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task(bind=True, max_retries=3, default_retry_delay=60, queue="llm")
def analyse_mot_task(self, listing_id: int) -> None:
    db: Session = SessionLocal()
    try:
        listing = db.get(Listing, listing_id)
        if not listing or not listing.registration:
            return

        from carflip.db.models import MOTHistory
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


@shared_task(bind=True, max_retries=3, default_retry_delay=60, rate_limit="12/m", queue="llm")
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
