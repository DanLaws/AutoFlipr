from fastapi import APIRouter
from sqlalchemy import text

from carflip.db.session import SessionLocal

router = APIRouter()


@router.get("/health")
def health() -> dict:
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception:
        db_ok = False

    return {"status": "ok" if db_ok else "degraded", "db": db_ok}
