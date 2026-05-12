"""
On-demand single-URL scan task.

Runs in the 'scrape' queue so it has access to the Playwright browser.
Does scrape → LLM extract → score in a single synchronous task so the
frontend can poll one endpoint for results.
"""
import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from celery import shared_task
from pydantic import ValidationError
from sqlalchemy.orm import Session

from autoflipr.config import settings
from autoflipr.db.models import DealScore, Listing, LLMInsight, PriceHistory, UserScan
from autoflipr.db.session import SessionLocal
from autoflipr.geo import geocode_uk_location
from autoflipr.llm import gemini_client
from autoflipr.llm.direct_extract import direct_extract
from autoflipr.llm.schemas import (
    ListingExtraction, VehicleAnalysis,
    PROMPT_VERSION_EXTRACTION, PROMPT_VERSION_ANALYSIS,
)
from autoflipr.scrapers.base import RawListing
from autoflipr.tasks.score import score_listing_sync

log = logging.getLogger(__name__)


# ── URL helpers ───────────────────────────────────────────────────────────────

def detect_source(url: str) -> Optional[str]:
    """Return the source name for a supported listing URL, or None if not recognised.

    Uses proper hostname parsing so that URLs like
    https://evil.com/?ref=autotrader.co.uk cannot spoof the allowed-source check.
    """
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return None
        host = (parsed.hostname or "").lower()
    except Exception:
        return None

    if host in ("www.autotrader.co.uk", "autotrader.co.uk"):
        return "autotrader"
    if host in ("www.gumtree.com", "gumtree.com"):
        return "gumtree"
    if host in ("www.facebook.com", "facebook.com", "m.facebook.com"):
        if "/marketplace/" in parsed.path:
            return "fb"
    return None


def extract_external_id(url: str, source: str) -> Optional[str]:
    if source == "autotrader":
        m = re.search(r"/car-details/(\d+)", url)
        return m.group(1) if m else None
    if source == "gumtree":
        m = re.search(r"/(\d{8,})(?:[/?#]|$)", url)
        return m.group(1) if m else None
    if source == "fb":
        m = re.search(r"/marketplace/item/(\d{10,})/", url)
        return m.group(1) if m else None
    return None


def normalise_url(url: str, source: str, external_id: str) -> str:
    """Return canonical URL for deduplication."""
    if source == "autotrader":
        return f"https://www.autotrader.co.uk/car-details/{external_id}"
    if source == "gumtree":
        return url.split("?")[0].rstrip("/")
    if source == "fb":
        return f"https://www.facebook.com/marketplace/item/{external_id}/"
    return url


# ── Single-URL Playwright fetchers ────────────────────────────────────────────

async def _fetch_autotrader(external_id: str) -> Optional[RawListing]:
    from autoflipr.scrapers.autotrader import AutoTraderScraper
    scraper = AutoTraderScraper()
    return await scraper.fetch_listing(external_id)


async def _fetch_facebook(url: str, external_id: str) -> Optional[RawListing]:
    """Fetch a single Facebook Marketplace listing via the FB scraper."""
    from autoflipr.scrapers.facebook import FacebookScraper
    scraper = FacebookScraper()
    return await scraper.fetch_listing(external_id)


async def _fetch_gumtree(url: str, external_id: str) -> Optional[RawListing]:
    """Fetch a single Gumtree listing via headless Playwright."""
    import random
    from playwright.async_api import async_playwright
    from autoflipr.scrapers.gumtree import _IMG_CDN, _dismiss_onetrust
    from autoflipr.scrapers.base import USER_AGENTS

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        ctx = await browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            locale="en-GB",
            timezone_id="Europe/London",
            viewport={"width": 1440, "height": 900},
        )
        page = await ctx.new_page()

        async def _route(route):
            rt = route.request.resource_type
            req_url = route.request.url
            if rt == "image" and _IMG_CDN in req_url:
                await route.continue_()
            elif rt in ("image", "media", "font"):
                await route.abort()
            else:
                await route.continue_()

        await page.route("**/*", _route)

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
            await page.wait_for_timeout(2_000)
            await _dismiss_onetrust(page)

            html = await page.content()
            if len(html) < 2_000:
                return None
            if external_id not in page.url:
                return None  # redirected = removed

            image_urls = await page.evaluate(f"""
                () => {{
                    const cdn = '{_IMG_CDN}';
                    const imgs = [...document.querySelectorAll('img')]
                        .map(i => i.src)
                        .filter(src => src.includes(cdn));
                    const seen = new Set();
                    return imgs.filter(src => {{
                        if (seen.has(src)) return false;
                        seen.add(src);
                        return true;
                    }});
                }}
            """)
            return RawListing(
                source="gumtree",
                external_id=external_id,
                url=url,
                raw_html=html,
                image_urls=image_urls or [],
            )
        except Exception as exc:
            log.warning("[scan] gumtree fetch error: %s", exc)
            return None
        finally:
            await browser.close()


# ── LLM helpers ───────────────────────────────────────────────────────────────

def _store_vehicle_analysis(db: Session, listing_id: int, raw_html: str) -> None:
    """
    Run vehicle analysis and persist the LLMInsight record.
    Non-blocking — logs a warning and returns on any failure.
    """
    try:
        ana_output, ana_in, ana_out = gemini_client.analyse_vehicle(raw_html)
        ana_status = "invalid"
        ana_parsed = None
        if ana_output:
            try:
                analysis = VehicleAnalysis.model_validate(ana_output)
                ana_status = "valid"
                ana_parsed = analysis.model_dump()
            except Exception:
                pass
        db.add(LLMInsight(
            listing_id=listing_id,
            kind="vehicle_analysis",
            model=settings.gemini_model,
            prompt_version=PROMPT_VERSION_ANALYSIS,
            raw_output=ana_output,
            parsed_output=ana_parsed,
            validation_status=ana_status,
            input_tokens=ana_in,
            output_tokens=ana_out,
        ))
        db.commit()
    except Exception:
        log.warning("[scan] vehicle analysis failed — continuing without it")


# ── Main Celery task ──────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=1, queue="scrape")
def scan_url_task(self, scan_id: int) -> None:
    db: Session = SessionLocal()
    scan: Optional[UserScan] = None

    try:
        scan = db.get(UserScan, scan_id)
        if not scan:
            return

        scan.status = "processing"
        db.commit()

        url = scan.url
        source = detect_source(url)
        if not source:
            scan.status = "error"
            scan.error_message = (
                "URL not recognised — must be AutoTrader, Gumtree, or Facebook Marketplace"
            )
            scan.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        external_id = extract_external_id(url, source)
        if not external_id:
            scan.status = "error"
            scan.error_message = "Could not extract listing ID from URL"
            scan.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        canonical_url = normalise_url(url, source, external_id)

        # ── 1. Check if already in DB with valid extraction ─────────────────
        existing = (
            db.query(Listing)
            .filter(Listing.source == source, Listing.external_id == external_id)
            .first()
        )

        if existing and existing.llm_status == "valid":
            # Re-score to freshen comparables
            score_listing_sync(db, existing.id)

            # Run vehicle analysis if it hasn't been done yet
            has_analysis = db.query(LLMInsight).filter(
                LLMInsight.listing_id == existing.id,
                LLMInsight.kind == "vehicle_analysis",
                LLMInsight.validation_status == "valid",
            ).first()
            if not has_analysis and existing.raw_html:
                _store_vehicle_analysis(db, existing.id, existing.raw_html)

            scan.listing_id = existing.id
            scan.status = "done"
            scan.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        # ── 2. Scrape the URL ───────────────────────────────────────────────
        if source == "autotrader":
            raw = asyncio.run(_fetch_autotrader(external_id))
        elif source == "gumtree":
            raw = asyncio.run(_fetch_gumtree(canonical_url, external_id))
        else:  # fb
            raw = asyncio.run(_fetch_facebook(canonical_url, external_id))

        if not raw:
            scan.status = "error"
            scan.error_message = "Could not fetch listing — it may have been removed"
            scan.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        # ── 3. Persist / update listing ────────────────────────────────────
        if existing:
            listing = existing
            listing.raw_html = raw.raw_html
            listing.raw_hash = raw.raw_hash
            listing.image_urls = raw.image_urls
        else:
            listing = Listing(
                source=source,
                external_id=external_id,
                url=canonical_url,
                raw_html=raw.raw_html,
                raw_hash=raw.raw_hash,
                image_urls=raw.image_urls,
                llm_status="pending",
            )
            db.add(listing)

        db.commit()
        db.refresh(listing)

        # ── 4. Extraction (direct parser first, LLM fallback) ──────────────
        _REQUIRED = ("make", "model", "year", "price_gbp")
        validation_status = "invalid"
        parsed_output = None
        raw_output = None
        extraction_model = settings.gemini_model
        in_tok = out_tok = 0

        direct = direct_extract(source, raw.raw_html)
        if direct and all(direct.get(f) for f in _REQUIRED):
            # Zero-cost structured parse succeeded
            validation_status = "valid"
            parsed_output = direct
            extraction_model = "direct"

            prev_price = listing.price_gbp
            listing.make = direct.get("make", "").title() or None
            listing.model = direct.get("model", "").title() or None
            listing.variant = (direct.get("variant") or "").title() or None
            listing.year = direct.get("year")
            if direct.get("mileage") is not None:
                listing.mileage = direct["mileage"]
            listing.price_gbp = direct.get("price_gbp")
            listing.registration = direct.get("registration")
            listing.seller_type = direct.get("seller_type")
            listing.seller_name = direct.get("seller_name")
            listing.body_type = direct.get("body_type")
            listing.colour = direct.get("colour")
            listing.urgency_tags = direct.get("urgency_tags") or []
            listing.location_raw = direct.get("location_text")
            listing.llm_status = "valid"

            if direct.get("_lat") is not None and direct.get("_lng") is not None:
                listing.latitude = direct["_lat"]
                listing.longitude = direct["_lng"]
            elif direct.get("location_text"):
                coords = geocode_uk_location(direct["location_text"])
                if coords:
                    listing.latitude, listing.longitude = coords

            if direct.get("price_gbp") and direct["price_gbp"] != prev_price:
                db.add(PriceHistory(listing_id=listing.id, price_gbp=direct["price_gbp"]))

            log.info("[scan] direct extraction succeeded listing=%d source=%s", listing.id, source)
        else:
            # LLM fallback
            raw_output, in_tok, out_tok = gemini_client.extract_listing(raw.raw_html)

            if raw_output:
                try:
                    extracted = ListingExtraction.model_validate(raw_output)
                    validation_status = "valid"
                    parsed_output = extracted.model_dump()

                    prev_price = listing.price_gbp
                    listing.make = (extracted.make or "").title() or None
                    listing.model = (extracted.model or "").title() or None
                    listing.variant = (extracted.variant or "").title() or None
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
                        coords = geocode_uk_location(extracted.location_text)
                        if coords:
                            listing.latitude, listing.longitude = coords

                    if extracted.price_gbp and extracted.price_gbp != prev_price:
                        db.add(PriceHistory(listing_id=listing.id, price_gbp=extracted.price_gbp))

                except ValidationError as exc:
                    log.warning("[scan] extraction validation failed: %s", exc)
                    listing.llm_status = "invalid"

        db.add(LLMInsight(
            listing_id=listing.id,
            kind="extraction",
            model=extraction_model,
            prompt_version="direct-v1" if extraction_model == "direct" else PROMPT_VERSION_EXTRACTION,
            raw_output=None if extraction_model == "direct" else raw_output,
            parsed_output=parsed_output,
            validation_status=validation_status,
            input_tokens=in_tok,
            output_tokens=out_tok,
        ))
        db.commit()

        if validation_status != "valid":
            scan.status = "error"
            scan.error_message = "AI extraction failed — listing may not contain enough detail"
            scan.listing_id = listing.id
            scan.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        # ── 5. Score ────────────────────────────────────────────────────────
        score_listing_sync(db, listing.id)

        # ── 6. Vehicle analysis (best-effort, non-blocking) ─────────────────
        _store_vehicle_analysis(db, listing.id, raw.raw_html)

        scan.listing_id = listing.id
        scan.status = "done"
        scan.completed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as exc:
        log.exception("[scan] scan_url_task failed scan_id=%d", scan_id)
        if scan:
            db.rollback()
            try:
                scan.status = "error"
                scan.error_message = str(exc)[:500]
                scan.completed_at = datetime.now(timezone.utc)
                db.commit()
            except Exception:
                pass
        raise self.retry(exc=exc, countdown=10)
    finally:
        db.close()
