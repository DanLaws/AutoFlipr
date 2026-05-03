from functools import lru_cache
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import asc, desc, func, nullslast
from sqlalchemy.orm import joinedload

from autoflipr.api.deps import DBSession, ProUser, CurrentUser
from autoflipr.db.models import Listing, DealScore, LLMInsight, ListingReport, PriceHistory
from autoflipr.geo import geocode_uk_location, haversine_miles


@lru_cache(maxsize=500)
def _geocode_postcode(postcode: str) -> tuple[float, float] | None:
    return geocode_uk_location(postcode)

# Approximate degree-to-mile conversion factors for the UK (~53°N latitude).
# Used for a cheap bounding-box pre-filter before the precise haversine check.
_MILES_PER_LAT_DEGREE = 69.0
_MILES_PER_LNG_DEGREE = 41.5  # 69 * cos(53°)


def _haversine_expr(home_lat: float, home_lng: float):
    """
    SQLAlchemy SQL expression for great-circle distance in miles between a
    fixed point (home_lat, home_lng) and each listing's (latitude, longitude).

    Identical to haversine_miles() in geo.py but evaluated entirely in Postgres,
    so it can be used in ORDER BY and WHERE clauses without fetching rows into Python.

    Returns NULL for any row where latitude or longitude is NULL.
    """
    dlat = func.radians(Listing.latitude - home_lat) / 2
    dlng = func.radians(Listing.longitude - home_lng) / 2
    a = (
        func.power(func.sin(dlat), 2)
        + func.cos(func.radians(home_lat))
        * func.cos(func.radians(Listing.latitude))
        * func.power(func.sin(dlng), 2)
    )
    return 3958.8 * 2 * func.asin(func.sqrt(a))

router = APIRouter(prefix="/deals", tags=["deals"])


class PreviewDeal(BaseModel):
    id: int
    make: Optional[str]
    model: Optional[str]
    year: Optional[int]
    mileage: Optional[int]
    price_gbp: Optional[int]
    score: float
    estimated_margin_gbp: Optional[int]
    source: str
    image_url: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/preview", response_model=list[PreviewDeal])
def preview_deals(db: DBSession) -> list[PreviewDeal]:
    """Public endpoint — top scored listings for the landing page."""
    latest_score_sq = (
        db.query(
            DealScore.listing_id,
            func.max(DealScore.computed_at).label("max_computed_at"),
        )
        .group_by(DealScore.listing_id)
        .subquery()
    )

    rows = (
        db.query(Listing, DealScore)
        .join(latest_score_sq, Listing.id == latest_score_sq.c.listing_id)
        .join(
            DealScore,
            (DealScore.listing_id == latest_score_sq.c.listing_id)
            & (DealScore.computed_at == latest_score_sq.c.max_computed_at),
        )
        .filter(
            Listing.removed_at.is_(None),
            Listing.llm_status == "valid",
            DealScore.score.isnot(None),
        )
        .order_by(desc(DealScore.score))
        .limit(8)
        .all()
    )

    return [
        PreviewDeal(
            id=listing.id,
            make=listing.make,
            model=listing.model,
            year=listing.year,
            mileage=listing.mileage,
            price_gbp=listing.price_gbp,
            score=float(score.score),
            estimated_margin_gbp=score.estimated_margin_gbp,
            source=listing.source,
            image_url=(listing.image_urls[0] if listing.image_urls else None),
        )
        for listing, score in rows
    ]


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
    user: ProUser,
    min_score: float = Query(0, ge=0, le=100),
    max_price: Optional[int] = Query(None),
    max_mileage: Optional[int] = Query(None),
    min_margin: Optional[int] = Query(None),
    make: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
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

    # Resolve requesting user's ID from the dashboard identifier (email for JWT,
    # admin username for Basic auth).  Used to filter listings they've reported.
    from autoflipr.db.models import User as UserModel
    _caller = db.query(UserModel).filter(UserModel.email == user["email"]).first()
    caller_id: Optional[int] = _caller.id if _caller else None

    # Subquery: listing IDs reported by this user (any review status)
    user_reported_sq = (
        db.query(ListingReport.listing_id)
        .filter(ListingReport.user_id == caller_id)
        .subquery()
        if caller_id else None
    )

    q = (
        db.query(Listing, DealScore)
        .join(latest_score_sq, Listing.id == latest_score_sq.c.listing_id)
        .join(
            DealScore,
            (DealScore.listing_id == latest_score_sq.c.listing_id)
            & (DealScore.computed_at == latest_score_sq.c.max_computed_at),
        )
        .filter(
            Listing.removed_at.is_(None),
            Listing.llm_status == "valid",
            Listing.globally_hidden.is_(False),   # admin-confirmed reports
            DealScore.score.isnot(None),
            DealScore.score >= min_score,
        )
    )

    # Hide listings this user has personally reported
    if user_reported_sq is not None:
        q = q.filter(~Listing.id.in_(user_reported_sq))

    if max_price:
        q = q.filter(Listing.price_gbp <= max_price)
    if max_mileage:
        q = q.filter(Listing.mileage <= max_mileage)
    if min_margin:
        q = q.filter(DealScore.estimated_margin_gbp >= min_margin)
    if make:
        q = q.filter(func.lower(Listing.make) == make.lower())
    if model:
        q = q.filter(func.lower(Listing.model).contains(model.lower()))
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

    home_coords: Optional[tuple[float, float]] = None
    if home_postcode:
        home_coords = _geocode_postcode(home_postcode.upper().replace(" ", ""))

    sorting_by_distance = sort_by == "distance" and home_coords is not None

    # Bounding-box pre-filter: pushed to the DB whenever a distance constraint is
    # active.  Slightly over-inclusive (~10% vs haversine) but cheap — the
    # ix_listings_lat_lng index turns it into a range scan.  The haversine check
    # below discards the false positives.
    if home_coords and max_distance_miles:
        home_lat, home_lng = home_coords
        lat_delta = max_distance_miles / _MILES_PER_LAT_DEGREE
        lng_delta = max_distance_miles / _MILES_PER_LNG_DEGREE
        q = q.filter(
            Listing.latitude.isnot(None),
            Listing.longitude.isnot(None),
            Listing.latitude.between(home_lat - lat_delta, home_lat + lat_delta),
            Listing.longitude.between(home_lng - lng_delta, home_lng + lng_delta),
        )

    # ── Distance sort: push haversine ORDER BY entirely into Postgres ─────────
    # Previously this fetched up to 5,000 rows into Python for sorting.  Now the
    # haversine expression is evaluated in Postgres, so we can use a normal
    # LIMIT/OFFSET and only transfer `limit` rows across the wire.
    surviving: list[tuple[Listing, DealScore, Optional[float]]] = []

    if sorting_by_distance:
        home_lat, home_lng = home_coords  # type: ignore[misc]  # guarded by sorting_by_distance
        dist_sql = _haversine_expr(home_lat, home_lng)

        # Require coordinates; apply precise distance cap in the DB.
        q = q.filter(Listing.latitude.isnot(None), Listing.longitude.isnot(None))
        if max_distance_miles:
            q = q.filter(dist_sql <= max_distance_miles)

        rows = q.order_by(asc(dist_sql)).offset(offset).limit(limit).all()

        # Recompute distances in Python only for the small result set (≤ limit rows).
        # This keeps the response accurate and avoids adding a scalar subquery to SELECT.
        for listing, score in rows:
            dist = haversine_miles(home_lat, home_lng, listing.latitude, listing.longitude)
            surviving.append((listing, score, dist))

    else:
        # Non-distance sort: fetch exactly what we need, apply haversine post-fetch
        # only on the returned rows (cheap — at most `limit` rows).
        fetch_limit = (limit * 2) if (home_coords and max_distance_miles) else limit
        rows = q.order_by(order_clause).offset(offset).limit(fetch_limit).all()

        for listing, score in rows:
            if home_coords:
                if listing.latitude is None or listing.longitude is None:
                    if max_distance_miles:
                        continue  # skip unlocated listings when distance filter is active
                    surviving.append((listing, score, None))
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


@router.get("/by-ids", response_model=list[DealResponse])
def deals_by_ids(
    db: DBSession,
    user: CurrentUser,
    ids: str = Query(..., description="Comma-separated listing IDs"),
) -> list[DealResponse]:
    """Fetch specific listings by ID for the Watchlist — available to all users.
    Uses a LEFT OUTER JOIN so listings without a deal score are still returned."""
    id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
    if not id_list:
        return []

    latest_score_sq = (
        db.query(
            DealScore.listing_id,
            func.max(DealScore.computed_at).label("max_computed_at"),
        )
        .group_by(DealScore.listing_id)
        .subquery()
    )

    rows = (
        db.query(Listing, DealScore)
        .outerjoin(latest_score_sq, Listing.id == latest_score_sq.c.listing_id)
        .outerjoin(
            DealScore,
            (DealScore.listing_id == latest_score_sq.c.listing_id)
            & (DealScore.computed_at == latest_score_sq.c.max_computed_at),
        )
        .filter(Listing.id.in_(id_list))
        .all()
    )

    if not rows:
        return []

    surviving_ids = [lst.id for lst, _ in rows]
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

    results: list[DealResponse] = []
    for listing, score in rows:
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
            distance_miles=None,
            mot_narrative=mot_narrative,
            risk_score=analysis_data.get("risk_score") if analysis_data else None,
            red_flags=analysis_data.get("red_flags") if analysis_data else None,
            condition_notes=analysis_data.get("condition_notes") if analysis_data else None,
            positives=analysis_data.get("positives") if analysis_data else None,
            analysis_narrative=analysis_data.get("narrative") if analysis_data else None,
            analysis_confidence_pct=analysis_data.get("confidence_pct") if analysis_data else None,
            price_history=ph_map.get(listing.id, []),
        ))

    # Preserve the order the client requested
    order_map = {i: pos for pos, i in enumerate(id_list)}
    results.sort(key=lambda r: order_map.get(r.id, 9999))
    return results
