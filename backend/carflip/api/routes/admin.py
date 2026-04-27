"""
Admin-only user management endpoints.
All routes require HTTP Basic admin credentials.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from carflip.api.deps import AuthUser, DBSession
from carflip.db.models import User

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserRow(BaseModel):
    id: int
    email: str
    plan: str
    scan_count: int
    scan_month: Optional[str]
    is_admin: bool
    is_active: bool
    stripe_customer_id: Optional[str]
    stripe_subscription_id: Optional[str]
    created_at: str


class UpdateUserRequest(BaseModel):
    plan: Optional[str] = None          # free | basic | pro
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    scan_count: Optional[int] = None    # manual override


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserRow])
def list_users(_admin: AuthUser, db: DBSession):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        UserRow(
            id=u.id,
            email=u.email,
            plan=u.plan,
            scan_count=u.scan_count,
            scan_month=u.scan_month,
            is_admin=u.is_admin,
            is_active=u.is_active,
            stripe_customer_id=u.stripe_customer_id,
            stripe_subscription_id=u.stripe_subscription_id,
            created_at=u.created_at.isoformat(),
        )
        for u in users
    ]


@router.patch("/users/{user_id}", response_model=UserRow)
def update_user(user_id: int, body: UpdateUserRequest, _admin: AuthUser, db: DBSession):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.plan is not None:
        if body.plan not in ("free", "basic", "pro"):
            raise HTTPException(status_code=422, detail="plan must be free, basic, or pro")
        user.plan = body.plan

    if body.is_admin is not None:
        user.is_admin = body.is_admin

    if body.is_active is not None:
        user.is_active = body.is_active

    if body.scan_count is not None:
        user.scan_count = body.scan_count

    db.commit()
    db.refresh(user)

    return UserRow(
        id=user.id,
        email=user.email,
        plan=user.plan,
        scan_count=user.scan_count,
        scan_month=user.scan_month,
        is_admin=user.is_admin,
        is_active=user.is_active,
        stripe_customer_id=user.stripe_customer_id,
        stripe_subscription_id=user.stripe_subscription_id,
        created_at=user.created_at.isoformat(),
    )


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, _admin: AuthUser, db: DBSession):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
