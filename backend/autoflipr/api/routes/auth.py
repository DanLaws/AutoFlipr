"""
User auth endpoints: register, login, me, forgot-password, reset-password.
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError
from pydantic import BaseModel

from autoflipr.api.deps import DBSession, CurrentUser
from autoflipr.api.limiter import limiter
from autoflipr.auth.utils import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from autoflipr.config import settings
from autoflipr.db.models import User
from autoflipr.email import send_password_reset

logger = logging.getLogger(__name__)

_RESET_TOKEN_EXPIRE_HOURS = 1

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Request / response schemas ────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    plan: str
    email: str
    is_admin: bool


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class MeResponse(BaseModel):
    id: int
    email: str
    plan: str
    scan_count: int
    scan_month: str | None
    is_admin: bool
    created_at: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(request: Request, body: RegisterRequest, db: DBSession):
    if "@" not in body.email or "." not in body.email.split("@")[-1]:
        raise HTTPException(status_code=422, detail="Invalid email address")

    existing = db.query(User).filter(User.email == body.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        plan="free",
        scan_count=0,
        scan_month=_current_month(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email, user.plan, user.is_admin)
    return TokenResponse(
        access_token=token,
        refresh_token=create_refresh_token(user.id),
        plan=user.plan,
        email=user.email,
        is_admin=user.is_admin,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: DBSession):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account suspended")

    token = create_access_token(user.id, user.email, user.plan, user.is_admin)
    return TokenResponse(
        access_token=token,
        refresh_token=create_refresh_token(user.id),
        plan=user.plan,
        email=user.email,
        is_admin=user.is_admin,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: DBSession):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    try:
        payload = decode_token(body.refresh_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account suspended")

    return TokenResponse(
        access_token=create_access_token(user.id, user.email, user.plan, user.is_admin),
        refresh_token=create_refresh_token(user.id),
        plan=user.plan,
        email=user.email,
        is_admin=user.is_admin,
    )


@router.get("/me", response_model=MeResponse)
def me(current_user: CurrentUser, db: DBSession):
    # Refresh from DB to get latest scan_count etc.
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return MeResponse(
        id=user.id,
        email=user.email,
        plan=user.plan,
        scan_count=user.scan_count,
        scan_month=user.scan_month,
        is_admin=user.is_admin,
        created_at=user.created_at.isoformat(),
    )


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: DBSession):
    """Issue a password-reset token. Always returns 200 to prevent email enumeration."""
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user and user.is_active:
        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=_RESET_TOKEN_EXPIRE_HOURS)
        db.commit()
        reset_url = f"{settings.app_url}/reset-password?token={token}"
        try:
            send_password_reset(user.email, reset_url)
        except Exception:
            logger.exception("Password reset email failed for %s", user.email)
    return {"detail": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
def reset_password(request: Request, body: ResetPasswordRequest, db: DBSession):
    """Consume a reset token and set a new password."""
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    user = db.query(User).filter(User.reset_token == body.token).first()
    if not user or not user.reset_token_expires:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    if datetime.now(timezone.utc) > user.reset_token_expires:
        user.reset_token = None
        user.reset_token_expires = None
        db.commit()
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")

    user.password_hash = hash_password(body.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    return {"detail": "Password updated successfully."}
