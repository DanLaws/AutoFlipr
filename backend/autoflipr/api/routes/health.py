from fastapi import APIRouter
from sqlalchemy import text

from autoflipr.db.session import SessionLocal

router = APIRouter()


@router.get("/health")
def health() -> dict:
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    return {"status": "ok" if db_ok else "degraded", "db": db_ok}
