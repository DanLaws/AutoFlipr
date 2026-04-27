from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, func

from carflip.api.deps import DBSession, AuthUser, CurrentUser
from carflip.db.models import Listing, DealScore, LLMInsight, MOTHistory, ScrapeRun, ListingReport

router = APIRouter(prefix="/listings", tags=["listings"])


class ListingSummary(BaseModel):
    id: int
    source: str
    url: str
    make: Optional[str]
    model: Optional[str]
    variant: Optional[str]
    year: Optional[int]
    mileage: Optional[int]
    price_gbp: Optional[int]
    registration: Optional[str]
    seller_type: Optional[str]
    seller_name: Optional[str]
    body_type: Optional[str]
    colour: Optional[str]
    image_urls: Optional[list] = None
    llm_status: str
    first_seen_at: Optional[str]

    class Config:
        from_attributes = True


class PipelineStats(BaseModel):
    total: int
    pending: int
    valid: int
    invalid: int


@router.get("", response_model=list[ListingSummary])
def list_listings(
    db: DBSession,
    _user: AuthUser,
    llm_status: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
) -> list[ListingSummary]:
    q = db.query(Listing).filter(Listing.removed_at.is_(None))
    if llm_status:
        q = q.filter(Listing.llm_status == llm_status)
    rows = q.order_by(desc(Listing.first_seen_at)).offset(offset).limit(limit).all()
    return [
        ListingSummary(
            id=r.id,
            source=r.source,
            url=r.url,
            make=r.make,
            model=r.model,
            variant=r.variant,
            year=r.year,
            mileage=r.mileage,
            price_gbp=r.price_gbp,
            registration=r.registration,
            seller_type=r.seller_type,
            seller_name=r.seller_name,
            body_type=r.body_type,
            colour=r.colour,
            image_urls=r.image_urls,
            llm_status=r.llm_status,
            first_seen_at=r.first_seen_at.isoformat() if r.first_seen_at else None,
        )
        for r in rows
    ]


@router.get("/pipeline/stats", response_model=PipelineStats)
def pipeline_stats(db: DBSession, _user: AuthUser) -> PipelineStats:
    counts = (
        db.query(Listing.llm_status, func.count(Listing.id))
        .filter(Listing.removed_at.is_(None))
        .group_by(Listing.llm_status)
        .all()
    )
    by_status = {status: n for status, n in counts}
    return PipelineStats(
        total=sum(by_status.values()),
        pending=by_status.get("pending", 0),
        valid=by_status.get("valid", 0),
        invalid=by_status.get("invalid", 0),
    )


class ListingDetail(BaseModel):
    id: int
    source: str
    url: str
    make: Optional[str]
    model: Optional[str]
    variant: Optional[str]
    year: Optional[int]
    mileage: Optional[int]
    price_gbp: Optional[int]
    registration: Optional[str]
    seller_type: Optional[str]
    seller_name: Optional[str]
    body_type: Optional[str]
    colour: Optional[str]
    urgency_tags: Optional[list[str]]
    image_urls: Optional[list] = None
    llm_status: str
    scores: list[dict]
    mot_history: list[dict]
    insights: list[dict]

    class Config:
        from_attributes = True


@router.get("/{listing_id}", response_model=ListingDetail)
def get_listing(listing_id: int, db: DBSession, _user: AuthUser) -> ListingDetail:
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    scores = [
        {
            "score": float(s.score) if s.score else None,
            "estimated_value_gbp": s.estimated_value_gbp,
            "estimated_margin_gbp": s.estimated_margin_gbp,
            "comparable_count": s.comparable_count,
            "confidence": s.confidence,
            "computed_at": s.computed_at.isoformat(),
        }
        for s in sorted(listing.deal_scores, key=lambda x: x.computed_at, reverse=True)
    ]

    mot_rows = []
    if listing.registration:
        mot_rows = [
            {
                "test_date": str(r.test_date),
                "result": r.test_result,
                "odometer": r.odometer,
                "advisories": r.advisories or [],
                "failures": r.failures or [],
            }
            for r in db.query(MOTHistory)
            .filter(MOTHistory.registration == listing.registration)
            .order_by(desc(MOTHistory.test_date))
            .all()
        ]

    insights = [
        {
            "kind": i.kind,
            "validation_status": i.validation_status,
            "parsed_output": i.parsed_output,
            "created_at": i.created_at.isoformat(),
        }
        for i in sorted(listing.llm_insights, key=lambda x: x.created_at, reverse=True)
        if i.validation_status == "valid"
    ]

    return ListingDetail(
        id=listing.id,
        source=listing.source,
        url=listing.url,
        make=listing.make,
        model=listing.model,
        variant=listing.variant,
        year=listing.year,
        mileage=listing.mileage,
        price_gbp=listing.price_gbp,
        registration=listing.registration,
        seller_type=listing.seller_type,
        seller_name=listing.seller_name,
        body_type=listing.body_type,
        colour=listing.colour,
        urgency_tags=listing.urgency_tags,
        image_urls=listing.image_urls,
        llm_status=listing.llm_status,
        scores=scores,
        mot_history=mot_rows,
        insights=insights,
    )


class ReportRequest(BaseModel):
    report_type: Literal["scam", "spam", "duplicate", "other"] = "scam"
    notes: Optional[str] = None


class ReportResponse(BaseModel):
    id: int
    listing_id: int
    report_type: str
    reported_at: str


@router.post("/{listing_id}/report", response_model=ReportResponse, status_code=201)
def report_listing(
    listing_id: int,
    body: ReportRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> ReportResponse:
    """Flag a listing as a scam, spam, duplicate, or other issue."""
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    report = ListingReport(
        listing_id=listing_id,
        user_id=current_user["id"],
        report_type=body.report_type,
        notes=body.notes,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return ReportResponse(
        id=report.id,
        listing_id=report.listing_id,
        report_type=report.report_type,
        reported_at=report.reported_at.isoformat(),
    )


class ScrapeRunSummary(BaseModel):
    id: int
    source: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]
    listings_found: Optional[int]
    listings_new: Optional[int]
    status: Optional[str]


@router.get("/scrape-runs/recent", response_model=list[ScrapeRunSummary], tags=["admin"])
def recent_scrape_runs(db: DBSession, _user: AuthUser, limit: int = 20) -> list[ScrapeRunSummary]:
    runs = db.query(ScrapeRun).order_by(desc(ScrapeRun.started_at)).limit(limit).all()
    return [
        ScrapeRunSummary(
            id=r.id,
            source=r.source,
            started_at=r.started_at.isoformat() if r.started_at else None,
            completed_at=r.completed_at.isoformat() if r.completed_at else None,
            listings_found=r.listings_found,
            listings_new=r.listings_new,
            status=r.status,
        )
        for r in runs
    ]
