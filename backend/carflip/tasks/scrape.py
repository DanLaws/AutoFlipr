import asyncio
import logging
from datetime import datetime, timezone
from typing import Callable, Optional, Type

from celery import shared_task
from sqlalchemy.orm import Session

from carflip.config import settings
from carflip.db.models import Listing, ScrapeRun
from carflip.db.session import SessionLocal
from carflip.scrapers.autotrader import AutoTraderScraper
from carflip.scrapers.base import BaseScraper, RawListing
from carflip.scrapers.facebook import FacebookScraper
from carflip.scrapers.gumtree import GumtreeScraper

log = logging.getLogger(__name__)


def _persist_raw_listings(db: Session, raw_listings: list[RawListing]) -> tuple[int, int, list[dict]]:
    """Upsert a list of RawListings into the DB and queue LLM extraction for new/changed ones."""
    from carflip.llm.tasks import extract_listing_task

    listings_new = 0
    listings_updated = 0
    errors: list[dict] = []

    for raw in raw_listings:
        try:
            existing = (
                db.query(Listing)
                .filter(Listing.source == raw.source, Listing.external_id == raw.external_id)
                .first()
            )
            now = datetime.now(timezone.utc)

            if existing:
                if existing.raw_hash == raw.raw_hash:
                    existing.last_scraped_at = now
                    if raw.image_urls:
                        existing.image_urls = raw.image_urls
                    listings_updated += 1
                else:
                    existing.raw_html = raw.raw_html
                    existing.raw_hash = raw.raw_hash
                    existing.image_urls = raw.image_urls or existing.image_urls
                    existing.last_scraped_at = now
                    existing.llm_status = "pending"
                    db.flush()
                    extract_listing_task.delay(existing.id)
                    listings_updated += 1
            else:
                listing = Listing(
                    source=raw.source,
                    external_id=raw.external_id,
                    url=raw.url,
                    raw_html=raw.raw_html,
                    raw_hash=raw.raw_hash,
                    image_urls=raw.image_urls or [],
                    last_scraped_at=now,
                )
                db.add(listing)
                db.flush()
                extract_listing_task.delay(listing.id)
                listings_new += 1

            db.commit()
        except Exception as exc:
            db.rollback()
            log.exception("Failed to persist listing %s", raw.external_id)
            errors.append({"stage": "persist", "url": raw.url, "message": str(exc)})

    return listings_new, listings_updated, errors


def _run_scrape(
    self_task,
    scraper_class: Type[BaseScraper],
    source: str,
    search_params: dict,
    merge_config: Optional[Callable[[dict], None]] = None,
) -> dict:
    """
    Generic scrape runner shared by all source-specific Celery tasks.

    Creates a ScrapeRun record, runs the scraper, persists results, and
    updates the run record — regardless of source.
    """
    if merge_config:
        merge_config(search_params)

    db: Session = SessionLocal()
    run = ScrapeRun(source=source, started_at=datetime.now(timezone.utc), status="running")
    db.add(run)
    db.commit()
    db.refresh(run)

    scraper = scraper_class()
    errors: list[dict] = []
    listings_new = 0
    listings_updated = 0

    try:
        raw_listings = asyncio.run(scraper.run(search_params))
        run.listings_found = len(raw_listings)
        listings_new, listings_updated, errors = _persist_raw_listings(db, raw_listings)
        run.status = "ok" if not errors else "partial"

    except Exception as exc:
        log.exception("%s scrape task failed", source)
        run.status = "failed"
        errors.append({"stage": "scrape", "message": str(exc)})
        db.commit()
        raise self_task.retry(exc=exc)

    finally:
        run.completed_at = datetime.now(timezone.utc)
        run.listings_new = listings_new
        run.listings_updated = listings_updated
        run.errors = errors
        db.commit()
        listings_found = run.listings_found or 0
        db.close()

    return {
        "source": source,
        "found": listings_found,
        "new": listings_new,
        "updated": listings_updated,
        "errors": len(errors),
    }


# ── Source tasks ──────────────────────────────────────────────────────────────

@shared_task(bind=True, max_retries=2, default_retry_delay=300, queue="scrape")
def scrape_autotrader(self, search_params: dict | None = None) -> dict:
    return _run_scrape(self, AutoTraderScraper, "autotrader", search_params or {})


@shared_task(bind=True, max_retries=2, default_retry_delay=300, queue="scrape")
def scrape_gumtree(self, search_params: dict | None = None) -> dict:
    """
    Scrape Gumtree UK cars.

    Requires GUMTREE_CDP_URL to be set in .env pointing to a real Chrome
    browser with remote debugging enabled, e.g.:

        GUMTREE_CDP_URL=ws://host.docker.internal:9222

    Start Chrome on the host with:

        /Applications/Google Chrome.app/Contents/MacOS/Google\\ Chrome \\
          --remote-debugging-port=9222 --no-first-run --no-default-browser-check

    Without CDP, Gumtree's Imperva bot protection will block scraping.
    """
    def _merge(params: dict) -> None:
        if not params.get("search_location"):
            params["search_location"] = settings.gumtree_search_location
        if not params.get("max_price") and settings.gumtree_max_price:
            params["max_price"] = settings.gumtree_max_price

    return _run_scrape(self, GumtreeScraper, "gumtree", search_params or {}, merge_config=_merge)


@shared_task(bind=True, max_retries=1, default_retry_delay=600, queue="scrape")
def scrape_facebook(self, search_params: dict | None = None) -> dict:
    """
    Scrape Facebook Marketplace cars.

    Requires a valid Facebook session cookie file at FB_COOKIES_PATH
    (default: /data/facebook_cookies.json).

    Export cookies after logging in to facebook.com using the "Cookie-Editor"
    browser extension → Export as JSON → save to the configured path.

    If the cookie file is missing or expired, this task exits gracefully with
    found=0 rather than raising an error.
    """
    return _run_scrape(self, FacebookScraper, "fb", search_params or {})


@shared_task(bind=True, max_retries=0, queue="scrape")
def refresh_active_listings(self) -> dict:
    """Re-fetch all active AutoTrader listings to catch price changes and removals."""
    from carflip.llm.tasks import extract_listing_task

    db: Session = SessionLocal()
    listings = (
        db.query(Listing)
        .filter(Listing.source == "autotrader", Listing.removed_at.is_(None))
        .all()
    )

    scraper = AutoTraderScraper()
    refreshed = removed = changed = errors = 0
    now = datetime.now(timezone.utc)

    for listing in listings:
        try:
            raw: RawListing | None = asyncio.run(scraper.fetch_listing(listing.external_id))

            if raw is None:
                listing.removed_at = now
                db.commit()
                removed += 1
                continue

            listing.last_scraped_at = now
            if raw.image_urls:
                listing.image_urls = raw.image_urls

            if raw.raw_hash != listing.raw_hash:
                listing.raw_html = raw.raw_html
                listing.raw_hash = raw.raw_hash
                listing.llm_status = "pending"
                db.commit()
                extract_listing_task.delay(listing.id)
                changed += 1
            else:
                db.commit()

            refreshed += 1

        except Exception:
            log.exception("refresh_active_listings: error on listing %s", listing.id)
            db.rollback()
            errors += 1

    db.close()
    log.info(
        "refresh_active_listings done: refreshed=%d changed=%d removed=%d errors=%d",
        refreshed, changed, removed, errors,
    )
    return {"refreshed": refreshed, "changed": changed, "removed": removed, "errors": errors}
