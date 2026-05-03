"""
FastAPI dependency helpers.

Auth strategy:
  - All routes: Bearer JWT issued by /api/auth/login or /register
  - Admin routes: Bearer JWT with is_admin == true
  - Pro routes: Bearer JWT with plan == "pro" or is_admin == true
"""
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from autoflipr.auth.utils import decode_token
from autoflipr.db.models import User
from autoflipr.db.session import get_db

_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _get_token_payload(token: Optional[str] = Depends(_oauth2)) -> dict:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return decode_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_user(
    payload: Annotated[dict, Depends(_get_token_payload)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Any authenticated user — verifies is_active and returns fresh plan/is_admin from DB."""
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")
    return {
        "id": user.id,
        "email": user.email,
        "plan": user.plan,
        "is_admin": user.is_admin,
    }


def require_pro(user: Annotated[dict, Depends(require_user)]) -> dict:
    """Requires pro plan or admin."""
    if user["plan"] != "pro" and not user["is_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pro plan required",
        )
    return user


def require_admin(user: Annotated[dict, Depends(require_user)]) -> dict:
    """Requires is_admin flag on the user account."""
    if not user["is_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


# ── Type aliases ──────────────────────────────────────────────────────────────

DBSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[dict, Depends(require_user)]
ProUser = Annotated[dict, Depends(require_pro)]
AdminUser = Annotated[dict, Depends(require_admin)]
