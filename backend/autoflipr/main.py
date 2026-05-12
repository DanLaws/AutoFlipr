import uuid
import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

# Configure structured logging before anything else creates a logger
from autoflipr.logging_config import configure_logging
configure_logging()

# Import celery app first so @shared_task decorators bind to the correct broker
import autoflipr.celery_app  # noqa: F401

from autoflipr.api.limiter import limiter
from autoflipr.api.routes import deals, listings, health, vehicle
from autoflipr.api.routes.auth import router as auth_router
from autoflipr.api.routes.billing import router as billing_router
from autoflipr.api.routes.admin import router as admin_router
from autoflipr.api.routes.scan import router as scan_router
from autoflipr.api.routes.flipfolio import router as flipfolio_router
from autoflipr.api.routes.watchlist import router as watchlist_router
from autoflipr.config import settings

log = structlog.get_logger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Generate a unique request_id per HTTP request and bind it to structlog context."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


app = FastAPI(
    title="AutoFlipr API",
    version="0.1.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
)

# Request ID must come before everything else (outermost middleware = last added)
app.add_middleware(RequestIDMiddleware)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(deals.router, prefix="/api")
app.include_router(listings.router, prefix="/api")
app.include_router(vehicle.router, prefix="/api")
app.include_router(auth_router)
app.include_router(billing_router)
app.include_router(admin_router)
app.include_router(scan_router)
app.include_router(flipfolio_router)
app.include_router(watchlist_router)
