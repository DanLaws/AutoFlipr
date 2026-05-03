from celery import Celery
from celery.schedules import crontab


def setup_beat_schedule(celery: Celery) -> None:
    # AutoTrader UK-wide searches, split into 3 price bands so each sweep covers
    # a distinct market segment. Staggered 10 minutes apart so at most 2 run
    # simultaneously (worker-scrape concurrency=2). Sort by most-recent so each
    # run captures the freshest listings in that band.
    #
    # Depth: max_pages=20 → ~260 listings per run. Each band runs every 30 min →
    # up to 1,560 listing checks per band per hour across all 3 bands.
    # Known-valid listings are price-checked only (Option C+D) — no LLM cost.
    _AT_BASE = {"postcode": "", "sort": "mostrecent", "max_pages": 20}

    celery.conf.beat_schedule = {
        # Band 1: budget (≤£5k) — most active flip segment
        "scrape-autotrader-budget": {
            "task": "autoflipr.tasks.scrape.scrape_autotrader",
            "schedule": crontab(minute="0,30"),
            "args": [{**_AT_BASE, "price_to": 5000, "year_from": 2005}],
        },
        # Band 2: mid-range (£5k–£20k)
        "scrape-autotrader-mid": {
            "task": "autoflipr.tasks.scrape.scrape_autotrader",
            "schedule": crontab(minute="10,40"),
            "args": [{**_AT_BASE, "price_from": 5000, "price_to": 20000, "year_from": 2010}],
        },
        # Band 3: premium (£20k–£50k)
        "scrape-autotrader-premium": {
            "task": "autoflipr.tasks.scrape.scrape_autotrader",
            "schedule": crontab(minute="20,50"),
            "args": [{**_AT_BASE, "price_from": 20000, "price_to": 50000, "year_from": 2015}],
        },
        # Re-fetch all active listings weekly: detects removals + catches price
        # changes on listings that have fallen off the first-20-pages of results.
        "refresh-active-listings-weekly": {
            "task": "autoflipr.tasks.scrape.refresh_active_listings",
            # Sunday 03:00 UTC
            "schedule": crontab(hour=3, minute=0, day_of_week=0),
        },
        # Same for Gumtree — staggered 2h after AutoTrader so they don't overlap
        "refresh-gumtree-listings-weekly": {
            "task": "autoflipr.tasks.scrape.refresh_gumtree_listings",
            # Sunday 05:00 UTC
            "schedule": crontab(hour=5, minute=0, day_of_week=0),
        },
        # Gumtree UK-wide, 15 pages (~375 listings/run), every 45 min
        "scrape-gumtree-every-45min": {
            "task": "autoflipr.tasks.scrape.scrape_gumtree",
            "schedule": crontab(minute="25,55"),  # offset from AT bands
            "args": [{"max_pages": 15}],
        },
        "scrape-facebook-every-hour": {
            "task": "autoflipr.tasks.scrape.scrape_facebook",
            "schedule": crontab(minute=5),
            "args": [{}],
        },
        "rescore-unscored-hourly": {
            "task": "autoflipr.tasks.score.rescore_unscored_task",
            "schedule": crontab(minute=50),
        },
        # Check top-scored listings for removal every 2 hours.
        # Prioritises highest-scoring deals so stale top results are caught quickly
        # without hammering the source sites on every run.
        "check-top-deals-availability": {
            "task": "autoflipr.tasks.scrape.check_top_deals_availability",
            "schedule": crontab(minute=35, hour="*/2"),
        },
    }
