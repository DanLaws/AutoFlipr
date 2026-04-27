from celery import Celery
from celery.schedules import crontab


def setup_beat_schedule(celery: Celery) -> None:
    celery.conf.beat_schedule = {
        "scrape-autotrader-every-30min": {
            "task": "carflip.tasks.scrape.scrape_autotrader",
            "schedule": crontab(minute="*/30"),
            "args": [{}],
        },
        "refresh-active-listings-weekly": {
            "task": "carflip.tasks.scrape.refresh_active_listings",
            # Sunday 03:00 London time (UTC+1 in summer, UTC in winter — beat uses UTC)
            "schedule": crontab(hour=3, minute=0, day_of_week=0),
        },
        "scrape-gumtree-every-45min": {
            "task": "carflip.tasks.scrape.scrape_gumtree",
            # Offset from AutoTrader (every 30min) to spread load
            "schedule": crontab(minute="15,45"),
            "args": [{}],
        },
        "scrape-facebook-every-hour": {
            "task": "carflip.tasks.scrape.scrape_facebook",
            # Hourly at :05 — only fires if FB_COOKIES_PATH exists
            "schedule": crontab(minute=5),
            "args": [{}],
        },
    }
