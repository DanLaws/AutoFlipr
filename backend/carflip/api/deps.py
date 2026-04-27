"""
FastAPI dependency helpers.

Auth strategy:
  - Admin routes: HTTP Basic (auth_user / auth_pass from settings)
  - User routes:  Bearer JWT  (issued by /api/auth/login or /register)
  - Pro routes:   Bearer JWT with plan == "pro" (or is_admin)
"""
import secrets
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials, OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from carflip.auth.utils import decode_token
from carflip.config import settings
from carflip.db.session import get_db

# ── HTTP Basic (admin) ────────────────────────────────────────────────────────

_basic_security = HTTPBasic()


def require_auth(credentials: Annotated[HTTPBasicCredentials, Depends(_basic_security)]) -> str:
    ok_user = secrets.compare_digest(credentials.username, settings.auth_user)
    ok_pass = secrets.compare_digest(credentials.password, settings.auth_pass)
    if not (ok_user and ok_pass):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


# ── JWT (user) ────────────────────────────────────────────────────────────────

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


def require_user(payload: Annotated[dict, Depends(_get_token_payload)]) -> dict:
    """Any authenticated user (free, basic, or pro)."""
    return {
        "id": int(payload["sub"]),
        "email": payload["email"],
        "plan": payload["plan"],
        "is_admin": payload.get("is_admin", False),
    }


def require_pro(user: Annotated[dict, Depends(require_user)]) -> dict:
    """Requires pro plan or admin."""
    if user["plan"] != "pro" and not user["is_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pro plan required",
        )
    return user


# ── Flexible auth: Basic (admin) OR JWT (pro/admin) ──────────────────────────

def require_dashboard_access(
    credentials: Annotated[Optional[HTTPBasicCredentials], Depends(HTTPBasic(auto_error=False))],
    token: Optional[str] = Depends(_oauth2),
) -> str:
    """
    Accepts either:
    - HTTP Basic admin credentials (for the admin panel)
    - A valid JWT with plan==pro or is_admin==true (for subscribed users)
    Returns a string identifier for the caller.
    """
    # Try JWT first
    if token:
        try:
            payload = decode_token(token)
            plan = payload.get("plan", "free")
            is_adm = payload.get("is_admin", False)
            if plan == "pro" or is_adm:
                return payload["email"]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Pro plan required",
            )
        except JWTError:
            pass

    # Try Basic
    if credentials:
        ok_user = secrets.compare_digest(credentials.username, settings.auth_user)
        ok_pass = secrets.compare_digest(credentials.password, settings.auth_pass)
        if ok_user and ok_pass:
            return credentials.username

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": 'Basic realm="AutoFlippers"'},
    )


# ── Type aliases ──────────────────────────────────────────────────────────────

DBSession = Annotated[Session, Depends(get_db)]
AuthUser = Annotated[str, Depends(require_auth)]
DashboardUser = Annotated[str, Depends(require_dashboard_access)]
CurrentUser = Annotated[dict, Depends(require_user)]
ProUser = Annotated[dict, Depends(require_pro)]
