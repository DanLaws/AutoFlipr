"""
Structured JSON logging via structlog.

All existing stdlib logging.getLogger() calls are automatically routed through
structlog's ProcessorFormatter, so no log-site changes are needed.  The
`request_id` context var (bound by RequestIDMiddleware / Celery task_prerun) is
merged into every record by merge_contextvars.
"""
import logging
import structlog


def configure_logging(log_level: str = "INFO") -> None:
    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
    ]

    structlog.configure(
        processors=shared_processors
        + [structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.processors.JSONRenderer(),
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Silence noisy third-party loggers
    for name in ("uvicorn.access", "httpx", "playwright"):
        logging.getLogger(name).setLevel(logging.WARNING)
