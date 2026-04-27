from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import celery app first so @shared_task decorators bind to the correct broker
import carflip.celery_app  # noqa: F401

from carflip.api.routes import deals, listings, health, vehicle
from carflip.api.routes.auth import router as auth_router
from carflip.api.routes.billing import router as billing_router
from carflip.api.routes.admin import router as admin_router
from carflip.api.routes.scan import router as scan_router

app = FastAPI(title="Carflip API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
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
