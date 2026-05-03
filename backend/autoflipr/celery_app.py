import structlog
from celery import Celery
from celery.signals import before_task_publish, task_prerun

from autoflipr.config import settings
from autoflipr.logging_config import configure_logging

configure_logging()

celery = Celery(
    "autoflipr",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "autoflipr.tasks.scrape",
        "autoflipr.tasks.mot",
        "autoflipr.tasks.score",
        "autoflipr.tasks.scan_url",
        "autoflipr.llm.tasks",
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
    worker_hijack_root_logger=False,  # let structlog own the root logger
    task_routes={
        "autoflipr.tasks.scrape.*": {"queue": "scrape"},
        "autoflipr.tasks.scan_url.*": {"queue": "scan"},
        "autoflipr.llm.tasks.*": {"queue": "llm"},
        "autoflipr.tasks.score.*": {"queue": "score"},
        "autoflipr.tasks.mot.*": {"queue": "mot"},
    },
)

from autoflipr.tasks.schedule import setup_beat_schedule  # noqa: E402
setup_beat_schedule(celery)


@before_task_publish.connect
def _inject_request_id(headers: dict, **kwargs) -> None:
    """Copy the current request_id from structlog contextvars into the task header."""
    ctx = structlog.contextvars.get_contextvars()
    if rid := ctx.get("request_id"):
        headers["request_id"] = rid


@task_prerun.connect
def _bind_request_id(task, **kwargs) -> None:
    """Restore request_id from task header into structlog context in the worker process."""
    structlog.contextvars.clear_contextvars()
    if rid := (task.request.get("request_id") or ""):
        structlog.contextvars.bind_contextvars(request_id=rid)
