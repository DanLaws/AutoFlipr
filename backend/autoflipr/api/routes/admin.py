"""Admin-only user management endpoints. Requires is_admin == true on the user account."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from autoflipr.api.deps import AdminUser, DBSession
from autoflipr.db.models import Listing, ListingReport, User

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
    plan: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    scan_count: Optional[int] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserRow])
def list_users(
    _admin: AdminUser,
    db: DBSession,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
):
    users = db.query(User).order_by(User.created_at.desc()).offset(skip).limit(limit).all()
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
def update_user(user_id: int, body: UpdateUserRequest, _admin: AdminUser, db: DBSession):
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
def delete_user(user_id: int, _admin: AdminUser, db: DBSession):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()


# ── Reports ───────────────────────────────────────────────────────────────────

class ReportRow(BaseModel):
    id: int
    listing_id: int
    user_id: Optional[int]
    user_email: Optional[str]
    report_type: str
    notes: Optional[str]
    reported_at: str
    review_status: str
    reviewed_at: Optional[str]
    # Listing snapshot
    make: Optional[str]
    model: Optional[str]
    year: Optional[int]
    price_gbp: Optional[int]
    source: str
    url: str
    globally_hidden: bool


class ReviewRequest(BaseModel):
    action: str  # "confirm" | "deny"


@router.get("/reports", response_model=list[ReportRow])
def list_reports(
    _admin: AdminUser,
    db: DBSession,
    review_status: Optional[str] = None,  # pending | confirmed | denied | all
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
) -> list[ReportRow]:
    """Return listing reports, newest first."""
    q = (
        db.query(ListingReport, Listing, User)
        .join(Listing, Listing.id == ListingReport.listing_id)
        .outerjoin(User, User.id == ListingReport.user_id)
    )
    if review_status and review_status != "all":
        q = q.filter(ListingReport.review_status == review_status)
    rows = q.order_by(ListingReport.reported_at.desc()).offset(skip).limit(limit).all()

    return [
        ReportRow(
            id=report.id,
            listing_id=report.listing_id,
            user_id=report.user_id,
            user_email=user.email if user else None,
            report_type=report.report_type,
            notes=report.notes,
            reported_at=report.reported_at.isoformat(),
            review_status=report.review_status,
            reviewed_at=report.reviewed_at.isoformat() if report.reviewed_at else None,
            make=listing.make,
            model=listing.model,
            year=listing.year,
            price_gbp=listing.price_gbp,
            source=listing.source,
            url=listing.url,
            globally_hidden=listing.globally_hidden,
        )
        for report, listing, user in rows
    ]


@router.patch("/reports/{report_id}", response_model=ReportRow)
def review_report(
    report_id: int,
    body: ReviewRequest,
    _admin: AdminUser,
    db: DBSession,
) -> ReportRow:
    """
    Confirm or deny a listing report.

    confirm → mark listing as globally_hidden (removed from all users' deals/scans)
    deny    → false report; listing stays visible for everyone else; reporter still
              sees it hidden (their local hide state is unchanged)
    """
    if body.action not in ("confirm", "deny"):
        raise HTTPException(status_code=422, detail="action must be 'confirm' or 'deny'")

    report = db.query(ListingReport).filter(ListingReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    listing = db.get(Listing, report.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    report.review_status = "confirmed" if body.action == "confirm" else "denied"
    report.reviewed_at = datetime.now(timezone.utc)

    if body.action == "confirm":
        listing.globally_hidden = True
    elif body.action == "deny":
        # If there are other confirmed reports on this listing, keep it hidden
        other_confirmed = (
            db.query(ListingReport)
            .filter(
                ListingReport.listing_id == listing.id,
                ListingReport.id != report_id,
                ListingReport.review_status == "confirmed",
            )
            .first()
        )
        if not other_confirmed:
            listing.globally_hidden = False

    db.commit()
    db.refresh(report)

    user = db.query(User).filter(User.id == report.user_id).first() if report.user_id else None

    return ReportRow(
        id=report.id,
        listing_id=report.listing_id,
        user_id=report.user_id,
        user_email=user.email if user else None,
        report_type=report.report_type,
        notes=report.notes,
        reported_at=report.reported_at.isoformat(),
        review_status=report.review_status,
        reviewed_at=report.reviewed_at.isoformat() if report.reviewed_at else None,
        make=listing.make,
        model=listing.model,
        year=listing.year,
        price_gbp=listing.price_gbp,
        source=listing.source,
        url=listing.url,
        globally_hidden=listing.globally_hidden,
    )
