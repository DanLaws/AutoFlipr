"""
User auth endpoints: register, login, me.
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from carflip.api.deps import DBSession, CurrentUser
from carflip.auth.utils import create_access_token, hash_password, verify_password
from carflip.db.models import User

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
    token_type: str = "bearer"
    plan: str
    email: str
    is_admin: bool


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
def register(body: RegisterRequest, db: DBSession):
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
        plan=user.plan,
        email=user.email,
        is_admin=user.is_admin,
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: DBSession):
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
