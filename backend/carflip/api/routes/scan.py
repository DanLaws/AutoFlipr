"""
User scan endpoints — on-demand URL scanning with history.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from carflip.api.deps import CurrentUser, DBSession
from carflip.celery_app import celery
from carflip.db.models import DealScore, Listing, LLMInsight, UserScan, User
from carflip.tasks.scan_url import detect_source

router = APIRouter(prefix="/api/scan", tags=["scan"])

PLAN_LIMITS = {"free": 5, "basic": 50, "pro": None}


# ── Schemas ───────────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    url: str


class ScanResult(BaseModel):
    id: int
    url: str
    status: str           # pending | processing | done | error
    error_message: Optional[str] = None
    scanned_at: str
    completed_at: Optional[str] = None
    # Populated when status == "done"
    listing_id: Optional[int] = None
    source: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    variant: Optional[str] = None
    year: Optional[int] = None
    mileage: Optional[int] = None
    price_gbp: Optional[int] = None
    image_urls: Optional[list] = None
    location: Optional[str] = None
    seller_type: Optional[str] = None
    seller_name: Optional[str] = None
    body_type: Optional[str] = None
    colour: Optional[str] = None
    score: Optional[float] = None
    estimated_value_gbp: Optional[int] = None
    estimated_margin_gbp: Optional[int] = None
    price_deviation_pct: Optional[float] = None
    comparable_count: Optional[int] = None
    confidence: Optional[str] = None
    # Vehicle analysis
    risk_score: Optional[int] = None
    narrative: Optional[str] = None
    red_flags: Optional[list] = None
    positives: Optional[list] = None
    condition_notes: Optional[list] = None


def _build_result(scan: UserScan, db: Session) -> ScanResult:
    base = ScanResult(
        id=scan.id,
        url=scan.url,
        status=scan.status,
        error_message=scan.error_message,
        scanned_at=scan.scanned_at.isoformat(),
        completed_at=scan.completed_at.isoformat() if scan.completed_at else None,
    )
    if scan.listing:
        listing = scan.listing
        base.listing_id = listing.id
        base.source = listing.source
        base.make = listing.make
        base.model = listing.model
        base.variant = listing.variant
        base.year = listing.year
        base.mileage = listing.mileage
        base.price_gbp = listing.price_gbp
        base.image_urls = listing.image_urls
        base.location = listing.location_raw
        base.seller_type = listing.seller_type
        base.seller_name = listing.seller_name
        base.body_type = listing.body_type
        base.colour = listing.colour

        if listing.deal_scores:
            latest = max(listing.deal_scores, key=lambda s: s.computed_at)
            base.score = float(latest.score) if latest.score is not None else None
            base.estimated_value_gbp = latest.estimated_value_gbp
            base.estimated_margin_gbp = latest.estimated_margin_gbp
            base.price_deviation_pct = (
                float(latest.price_deviation_pct) if latest.price_deviation_pct else None
            )
            base.comparable_count = latest.comparable_count
            base.confidence = latest.confidence

        insight = (
            db.query(LLMInsight)
            .filter(
                LLMInsight.listing_id == listing.id,
                LLMInsight.kind == "vehicle_analysis",
                LLMInsight.validation_status == "valid",
            )
            .order_by(LLMInsight.created_at.desc())
            .first()
        )
        if insight and insight.parsed_output:
            p = insight.parsed_output
            base.risk_score = p.get("risk_score")
            base.narrative = p.get("narrative")
            base.red_flags = p.get("red_flags")
            base.positives = p.get("positives")
            base.condition_notes = p.get("condition_notes")

    return base


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _check_and_deduct(db: Session, user_id: int, plan: str) -> None:
    """Enforce monthly scan limit. Raises 429 if exceeded."""
    limit = PLAN_LIMITS.get(plan)
    if limit is None:
        return  # pro = unlimited

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return

    month = _current_month()
    if user.scan_month != month:
        user.scan_count = 0
        user.scan_month = month

    if user.scan_count >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly scan limit reached ({limit} scans on {plan} plan). Upgrade to scan more.",
        )

    user.scan_count += 1
    db.commit()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", response_model=ScanResult, status_code=202)
def submit_scan(body: ScanRequest, current_user: CurrentUser, db: DBSession):
    url = body.url.strip()

    if not detect_source(url):
        raise HTTPException(
            status_code=422,
            detail=(
                "Only AutoTrader (autotrader.co.uk), Gumtree (gumtree.com), "
                "and Facebook Marketplace (facebook.com/marketplace) URLs are supported."
            ),
        )

    _check_and_deduct(db, current_user["id"], current_user["plan"])

    scan = UserScan(user_id=current_user["id"], url=url, status="pending")
    db.add(scan)
    db.commit()
    db.refresh(scan)

    celery.send_task("carflip.tasks.scan_url.scan_url_task", args=[scan.id], queue="scan")

    return _build_result(scan, db)


@router.get("/history", response_model=list[ScanResult])
def scan_history(
    current_user: CurrentUser,
    db: DBSession,
    limit: int = 20,
    offset: int = 0,
):
    scans = (
        db.query(UserScan)
        .options(
            joinedload(UserScan.listing).joinedload(Listing.deal_scores)
        )
        .filter(UserScan.user_id == current_user["id"])
        .order_by(desc(UserScan.scanned_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_build_result(s, db) for s in scans]


@router.get("/{scan_id}", response_model=ScanResult)
def get_scan(scan_id: int, current_user: CurrentUser, db: DBSession):
    scan = (
        db.query(UserScan)
        .options(
            joinedload(UserScan.listing).joinedload(Listing.deal_scores)
        )
        .filter(UserScan.id == scan_id, UserScan.user_id == current_user["id"])
        .first()
    )
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return _build_result(scan, db)
