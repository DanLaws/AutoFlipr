from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import asc, desc, func, nullslast, or_
from sqlalchemy.orm import joinedload

from carflip.api.deps import DBSession, DashboardUser
from carflip.db.models import Listing, DealScore, LLMInsight, PriceHistory
from carflip.geo import geocode_uk_location, haversine_miles

# Simple in-process cache so the same home postcode isn't re-geocoded every request
_postcode_cache: dict[str, tuple[float, float] | None] = {}

router = APIRouter(prefix="/deals", tags=["deals"])


class DealResponse(BaseModel):
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
    score: Optional[float]
    estimated_value_gbp: Optional[int]
    estimated_margin_gbp: Optional[int]
    price_deviation_pct: Optional[float]
    comparable_count: Optional[int]
    confidence: Optional[str]
    location: Optional[str] = None
    distance_miles: Optional[float] = None
    mot_narrative: Optional[str]
    risk_score: Optional[int] = None
    red_flags: Optional[list[str]] = None
    condition_notes: Optional[list[str]] = None
    positives: Optional[list[str]] = None
    analysis_narrative: Optional[str] = None
    analysis_confidence_pct: Optional[int] = None
    price_history: list[dict] = []

    class Config:
        from_attributes = True


@router.get("", response_model=list[DealResponse])
def list_deals(
    db: DBSession,
    _user: DashboardUser,
    min_score: float = Query(0, ge=0, le=100),
    max_price: Optional[int] = Query(None),
    max_mileage: Optional[int] = Query(None),
    min_margin: Optional[int] = Query(None),
    make: Optional[str] = Query(None),
    seller_type: Optional[str] = Query(None),
    year_from: Optional[int] = Query(None),
    year_to: Optional[int] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("score"),
    profitable_only: bool = Query(False),
    source: Optional[str] = Query(None),
    home_postcode: Optional[str] = Query(None),
    max_distance_miles: Optional[float] = Query(None, ge=1),
) -> list[DealResponse]:
    # Subquery: latest score per listing
    latest_score_sq = (
        db.query(
            DealScore.listing_id,
            func.max(DealScore.computed_at).label("max_computed_at"),
        )
        .group_by(DealScore.listing_id)
        .subquery()
    )

    q = (
        db.query(Listing, DealScore)
        .outerjoin(latest_score_sq, Listing.id == latest_score_sq.c.listing_id)
        .outerjoin(
            DealScore,
            (DealScore.listing_id == latest_score_sq.c.listing_id)
            & (DealScore.computed_at == latest_score_sq.c.max_computed_at),
        )
        .filter(
            Listing.removed_at.is_(None),
            Listing.llm_status == "valid",
            # Allow unscored listings through (NULL passes when min_score=0)
            or_(DealScore.score.is_(None), DealScore.score >= min_score),
        )
    )

    if max_price:
        q = q.filter(Listing.price_gbp <= max_price)
    if max_mileage:
        q = q.filter(Listing.mileage <= max_mileage)
    if min_margin:
        q = q.filter(DealScore.estimated_margin_gbp >= min_margin)
    if make:
        q = q.filter(func.lower(Listing.make) == make.lower())
    if seller_type:
        q = q.filter(func.lower(Listing.seller_type) == seller_type.lower())
    if year_from:
        q = q.filter(Listing.year >= year_from)
    if year_to:
        q = q.filter(Listing.year <= year_to)
    if profitable_only:
        q = q.filter(DealScore.estimated_margin_gbp > 0)
    if source:
        sources = [s.strip() for s in source.split(",") if s.strip()]
        if sources:
            q = q.filter(Listing.source.in_(sources))

    _sort = {
        "score":      nullslast(desc(DealScore.score)),
        "price_asc":  asc(Listing.price_gbp),
        "price_desc": desc(Listing.price_gbp),
        "margin":     nullslast(desc(DealScore.estimated_margin_gbp)),
        "mileage":    asc(Listing.mileage),
        "year":       desc(Listing.year),
    }
    order_clause = _sort.get(sort_by, nullslast(desc(DealScore.score)))

    # Geocode home postcode once per request (cached across requests)
    home_coords: Optional[tuple[float, float]] = None
    if home_postcode and max_distance_miles:
        key = home_postcode.upper().replace(" ", "")
        if key not in _postcode_cache:
            _postcode_cache[key] = geocode_uk_location(home_postcode)
        home_coords = _postcode_cache[key]

    # When distance filtering, overfetch to compensate for post-filter loss
    fetch_limit = limit * 4 if home_coords else limit
    rows = q.order_by(order_clause).offset(offset).limit(fetch_limit).all()

    # ── Distance filter ───────────────────────────────────────────────────────
    # Collect the surviving (listing, score, distance) tuples up to `limit`.
    surviving: list[tuple[Listing, DealScore, Optional[float]]] = []
    for listing, score in rows:
        if home_coords:
            if listing.latitude is None or listing.longitude is None:
                continue
            dist = haversine_miles(
                home_coords[0], home_coords[1], listing.latitude, listing.longitude
            )
            if max_distance_miles and dist > max_distance_miles:
                continue
            surviving.append((listing, score, dist))
        else:
            surviving.append((listing, score, None))
        if len(surviving) >= limit:
            break

    if not surviving:
        return []

    # ── Bulk-fetch LLM insights and price history (eliminates N+1) ───────────
    surviving_ids = [lst.id for lst, _, _ in surviving]

    # Fetch the latest valid insight of each kind per listing in one query.
    # Since we order by created_at DESC and deduplicate by (listing_id, kind),
    # the first row per key wins.
    insights_map: dict[tuple[int, str], LLMInsight] = {}
    for row in (
        db.query(LLMInsight)
        .filter(
            LLMInsight.listing_id.in_(surviving_ids),
            LLMInsight.validation_status == "valid",
            LLMInsight.kind.in_(["mot_narrative", "vehicle_analysis"]),
        )
        .order_by(desc(LLMInsight.created_at))
        .all()
    ):
        key = (row.listing_id, row.kind)
        if key not in insights_map:
            insights_map[key] = row

    ph_map: dict[int, list[dict]] = {lid: [] for lid in surviving_ids}
    for ph in (
        db.query(PriceHistory)
        .filter(PriceHistory.listing_id.in_(surviving_ids))
        .order_by(PriceHistory.recorded_at)
        .all()
    ):
        ph_map[ph.listing_id].append(
            {"price_gbp": ph.price_gbp, "recorded_at": ph.recorded_at.isoformat()}
        )

    # ── Build response objects ────────────────────────────────────────────────
    results: list[DealResponse] = []
    for listing, score, distance_miles in surviving:
        mot_insight = insights_map.get((listing.id, "mot_narrative"))
        mot_narrative = (
            mot_insight.parsed_output.get("summary")
            if mot_insight and mot_insight.parsed_output
            else None
        )

        analysis_insight = insights_map.get((listing.id, "vehicle_analysis"))
        analysis_data = analysis_insight.parsed_output if analysis_insight else None

        results.append(DealResponse(
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
            score=float(score.score) if score and score.score is not None else None,
            estimated_value_gbp=score.estimated_value_gbp if score else None,
            estimated_margin_gbp=score.estimated_margin_gbp if score else None,
            price_deviation_pct=(
                float(score.price_deviation_pct)
                if score and score.price_deviation_pct
                else None
            ),
            comparable_count=score.comparable_count if score else None,
            confidence=score.confidence if score else None,
            location=listing.location_raw,
            distance_miles=round(distance_miles, 1) if distance_miles is not None else None,
            mot_narrative=mot_narrative,
            risk_score=analysis_data.get("risk_score") if analysis_data else None,
            red_flags=analysis_data.get("red_flags") if analysis_data else None,
            condition_notes=analysis_data.get("condition_notes") if analysis_data else None,
            positives=analysis_data.get("positives") if analysis_data else None,
            analysis_narrative=analysis_data.get("narrative") if analysis_data else None,
            analysis_confidence_pct=analysis_data.get("confidence_pct") if analysis_data else None,
            price_history=ph_map.get(listing.id, []),
        ))

    return results
