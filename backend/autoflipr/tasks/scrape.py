import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional, Type

from celery import shared_task
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from autoflipr.config import settings
from autoflipr.db.models import DealScore, Listing, PriceHistory, ScrapeRun
from autoflipr.db.session import SessionLocal
from autoflipr.scrapers.autotrader import AutoTraderScraper
from autoflipr.scrapers.base import BaseScraper, RawListing
from autoflipr.scrapers.facebook import FacebookScraper, FacebookLoginWallError
from autoflipr.scrapers.gumtree import GumtreeScraper

log = logging.getLogger(__name__)


def _extract_price_only(source: str, html: str) -> Optional[int]:
    """Cheap regex price extraction — no LLM, no full parse."""
    try:
        if source == "autotrader":
            m = re.search(r"for sale for\s+£([\d,]+)", html, re.IGNORECASE)
            if m:
                return int(m.group(1).replace(",", ""))
        elif source == "gumtree":
            m = re.search(r'"amt"\s*:\s*(\d+)', html)
            if m:
                return int(m.group(1)) // 100
    except Exception:
        pass
    return None


def _persist_raw_listings(db: Session, raw_listings: list[RawListing]) -> tuple[int, int, list[dict]]:
    """Upsert a list of RawListings into the DB.

    - New listings: queue full extraction pipeline.
    - Changed hash, already valid (Option C): extract price only; re-score if changed (Option D).
    - Changed hash, not yet valid: re-queue full extraction.
    - Unchanged hash: just touch last_scraped_at.
    """
    from autoflipr.llm.tasks import extract_listing_task
    from autoflipr.tasks.score import score_listing_task

    listings_new = 0
    listings_updated = 0
    errors: list[dict] = []

    now = datetime.now(timezone.utc)
    for raw in raw_listings:
        # Use a savepoint so a single failure only rolls back that row, not the whole batch.
        sp = db.begin_nested()
        try:
            existing = (
                db.query(Listing)
                .filter(Listing.source == raw.source, Listing.external_id == raw.external_id)
                .first()
            )

            if existing:
                existing.last_scraped_at = now
                if raw.image_urls:
                    existing.image_urls = raw.image_urls

                if existing.raw_hash != raw.raw_hash:
                    existing.raw_html = raw.raw_html
                    existing.raw_hash = raw.raw_hash

                    if existing.llm_status == "valid":
                        # Option C/D: already extracted — price check only
                        new_price = _extract_price_only(raw.source, raw.raw_html)
                        if new_price and new_price != existing.price_gbp:
                            log.info(
                                "Price change listing=%d %s→%s",
                                existing.id, existing.price_gbp, new_price,
                            )
                            existing.price_gbp = new_price
                            db.add(PriceHistory(listing_id=existing.id, price_gbp=new_price))
                            db.flush()
                            score_listing_task.delay(existing.id)
                    else:
                        # Not yet successfully extracted — run full pipeline
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

            sp.commit()
        except Exception as exc:
            sp.rollback()
            log.exception("Failed to persist listing %s", raw.external_id)
            errors.append({"stage": "persist", "url": raw.url, "message": str(exc)})

    # Single commit for the entire batch (all savepoints already flushed above).
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        log.exception("Batch commit failed in _persist_raw_listings")
        errors.append({"stage": "batch_commit", "url": "", "message": str(exc)})

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

    except FacebookLoginWallError as exc:
        log.warning("%s scrape aborted: %s", source, exc)
        run.status = "cookie_expired"
        errors.append({"stage": "scrape", "message": str(exc)})
        db.commit()
        # No retry — operator must refresh cookies manually

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


async def _fetch_listings_concurrent(
    external_ids: list[str],
    scraper: AutoTraderScraper,
    max_concurrent: int = 5,
) -> list[tuple[str, RawListing | None]]:
    """Fetch multiple AutoTrader listings concurrently with a semaphore cap."""
    semaphore = asyncio.Semaphore(max_concurrent)

    async def _fetch_one(eid: str) -> tuple[str, RawListing | None]:
        async with semaphore:
            try:
                return eid, await scraper.fetch_listing(eid)
            except Exception:
                log.exception("refresh_active_listings: error fetching %s", eid)
                return eid, None

    return await asyncio.gather(*[_fetch_one(eid) for eid in external_ids])


@shared_task(bind=True, max_retries=0, queue="scrape")
def refresh_active_listings(self) -> dict:
    """Re-fetch all active AutoTrader listings to catch price changes and removals."""
    from autoflipr.llm.tasks import extract_listing_task

    db: Session = SessionLocal()
    listings = (
        db.query(Listing)
        .filter(Listing.source == "autotrader", Listing.removed_at.is_(None))
        .all()
    )

    if not listings:
        db.close()
        return {"refreshed": 0, "changed": 0, "removed": 0, "errors": 0}

    scraper = AutoTraderScraper()
    now = datetime.now(timezone.utc)

    # Fetch all listings concurrently (max 5 at a time) — one asyncio.run()
    # instead of one per listing, avoiding repeated browser startup overhead.
    id_to_listing = {lst.external_id: lst for lst in listings}
    fetch_results: list[tuple[str, RawListing | None]] = asyncio.run(
        _fetch_listings_concurrent(list(id_to_listing.keys()), scraper)
    )

    refreshed = removed = changed = errors = 0

    for external_id, raw in fetch_results:
        listing = id_to_listing[external_id]
        try:
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
            log.exception("refresh_active_listings: error persisting listing %s", listing.id)
            db.rollback()
            errors += 1

    db.close()
    log.info(
        "refresh_active_listings done: refreshed=%d changed=%d removed=%d errors=%d",
        refreshed, changed, removed, errors,
    )
    return {"refreshed": refreshed, "changed": changed, "removed": removed, "errors": errors}


@shared_task(bind=True, max_retries=0, queue="scrape")
def refresh_gumtree_listings(self) -> dict:
    """Re-fetch all active Gumtree listings to mark sold/removed ones and catch price changes."""
    from autoflipr.llm.tasks import extract_listing_task
    from autoflipr.tasks.score import score_listing_task

    db: Session = SessionLocal()
    listings = (
        db.query(Listing)
        .filter(Listing.source == "gumtree", Listing.removed_at.is_(None))
        .all()
    )

    scraper = GumtreeScraper()
    refreshed = removed = changed = errors = 0
    now = datetime.now(timezone.utc)

    for listing in listings:
        try:
            raw: RawListing | None = asyncio.run(scraper.fetch_listing(listing.url))

            if raw is None:
                listing.removed_at = now
                db.commit()
                removed += 1
                continue

            listing.last_scraped_at = now

            if raw.raw_hash != listing.raw_hash:
                listing.raw_html = raw.raw_html
                listing.raw_hash = raw.raw_hash

                if listing.llm_status == "valid":
                    new_price = _extract_price_only("gumtree", raw.raw_html)
                    if new_price and new_price != listing.price_gbp:
                        log.info(
                            "Gumtree price change listing=%d %s→%s",
                            listing.id, listing.price_gbp, new_price,
                        )
                        listing.price_gbp = new_price
                        db.add(PriceHistory(listing_id=listing.id, price_gbp=new_price))
                        score_listing_task.delay(listing.id)
                else:
                    listing.llm_status = "pending"
                    extract_listing_task.delay(listing.id)
                changed += 1

            db.commit()
            refreshed += 1
            scraper._jitter_sleep(60 / scraper.base_rate_limit)

        except Exception:
            db.rollback()
            log.exception("refresh_gumtree_listings: error on listing %s", listing.id)
            errors += 1

    db.close()
    log.info(
        "refresh_gumtree_listings done: refreshed=%d removed=%d changed=%d errors=%d",
        refreshed, removed, changed, errors,
    )
    return {"refreshed": refreshed, "removed": removed, "changed": changed, "errors": errors}


@shared_task(bind=True, max_retries=0, queue="scrape")
def check_top_deals_availability(self) -> dict:
    """
    Spot-check the highest-scoring active listings for removal.

    Runs every 2 hours. Picks the top 50 AutoTrader and top 20 Gumtree listings
    by score that haven't been checked in the last 2 hours, fetches each one,
    and sets removed_at if the listing is gone. Highest-scoring deals are always
    checked first so stale top deals disappear from the grid promptly.
    """
    db: Session = SessionLocal()
    now = datetime.now(timezone.utc)
    stale_cutoff = now - timedelta(hours=2)

    # Subquery: best score per listing
    best_score = (
        db.query(
            DealScore.listing_id,
            func.max(DealScore.score).label("best"),
        )
        .group_by(DealScore.listing_id)
        .subquery()
    )

    def _top_listings(source: str, limit: int) -> list[Listing]:
        return (
            db.query(Listing)
            .join(best_score, best_score.c.listing_id == Listing.id)
            .filter(
                Listing.source == source,
                Listing.removed_at.is_(None),
                Listing.llm_status == "valid",
                or_(
                    Listing.last_scraped_at.is_(None),
                    Listing.last_scraped_at < stale_cutoff,
                ),
            )
            .order_by(desc(best_score.c.best))
            .limit(limit)
            .all()
        )

    at_listings = _top_listings("autotrader", 50)
    gt_listings = _top_listings("gumtree", 20)

    at_checked = at_removed = gt_checked = gt_removed = 0

    # ── AutoTrader: concurrent (5 at a time) ──────────────────────────────────
    if at_listings:
        scraper = AutoTraderScraper()
        id_map = {lst.external_id: lst for lst in at_listings}
        results = asyncio.run(
            _fetch_listings_concurrent(list(id_map.keys()), scraper, max_concurrent=5)
        )
        for eid, raw in results:
            listing = id_map[eid]
            try:
                if raw is None:
                    listing.removed_at = now
                    at_removed += 1
                else:
                    listing.last_scraped_at = now
                    at_checked += 1
                db.commit()
            except Exception:
                log.exception("check_top_deals: AT commit failed for listing %s", listing.id)
                db.rollback()

    # ── Gumtree: sequential with rate limiting ────────────────────────────────
    if gt_listings:
        scraper = GumtreeScraper()
        for listing in gt_listings:
            try:
                raw = asyncio.run(scraper.fetch_listing(listing.url))
                if raw is None:
                    listing.removed_at = now
                    gt_removed += 1
                else:
                    listing.last_scraped_at = now
                    gt_checked += 1
                db.commit()
                scraper._jitter_sleep(60 / scraper.base_rate_limit)
            except Exception:
                log.exception("check_top_deals: GT commit failed for listing %s", listing.id)
                db.rollback()

    db.close()
    log.info(
        "check_top_deals_availability: at_checked=%d at_removed=%d gt_checked=%d gt_removed=%d",
        at_checked, at_removed, gt_checked, gt_removed,
    )
    return {
        "at_checked": at_checked, "at_removed": at_removed,
        "gt_checked": gt_checked, "gt_removed": gt_removed,
    }
