from celery import Celery

from carflip.config import settings

celery = Celery(
    "carflip",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "carflip.tasks.scrape",
        "carflip.tasks.mot",
        "carflip.tasks.score",
        "carflip.tasks.scan_url",
        "carflip.llm.tasks",
    ],
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/London",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "carflip.tasks.scrape.*": {"queue": "scrape"},
        "carflip.tasks.scan_url.*": {"queue": "scan"},
        "carflip.llm.tasks.*": {"queue": "llm"},
        "carflip.tasks.score.*": {"queue": "score"},
        "carflip.tasks.mot.*": {"queue": "mot"},
    },
)

from carflip.tasks.schedule import setup_beat_schedule  # noqa: E402
setup_beat_schedule(celery)
