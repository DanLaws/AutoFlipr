import statistics
from datetime import date, datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import and_, func

from autoflipr.api.deps import DBSession, CurrentUser
from autoflipr.db.models import FlipEntry, Listing
from autoflipr.llm import gemini_client
from autoflipr.llm.schemas import ListingOutput
from autoflipr.scoring.engine import DEPRECIATION_PER_MILE

router = APIRouter(prefix="/api/flipfolio", tags=["flipfolio"])


class FlipIn(BaseModel):
    make: str
    model: str
    year: Optional[int] = None
    mileage: Optional[int] = None
    purchase_price: int
    sale_price: Optional[int] = None
    additional_costs: int = 0
    date_bought: date
    date_sold: Optional[date] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    colour: Optional[str] = None
    fuel: Optional[str] = None
    transmission: Optional[str] = None
    features: Optional[list[str]] = None
    mot_advisories: Optional[str] = None

    @field_validator("purchase_price", "additional_costs")
    @classmethod
    def non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("must be non-negative")
        return v

    @field_validator("sale_price")
    @classmethod
    def sale_non_negative(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("must be non-negative")
        return v


class FlipOut(BaseModel):
    id: int
    make: str
    model: str
    year: Optional[int]
    mileage: Optional[int]
    purchase_price: int
    sale_price: Optional[int]
    additional_costs: int
    total_cost: int
    profit: Optional[int]
    date_bought: date
    date_sold: Optional[date]
    days_to_sell: Optional[int]
    source: Optional[str]
    notes: Optional[str]
    colour: Optional[str]
    fuel: Optional[str]
    transmission: Optional[str]
    features: Optional[list[str]]
    mot_advisories: Optional[str]
    listing_output: Optional[dict]
    created_at: datetime


class GenerateListingIn(BaseModel):
    features: list[str] = []
    mot_advisories: Optional[str] = None


class PricingStrategyOut(BaseModel):
    listed_price: int
    target_price: int
    rationale: str
    estimated_days: str


class ListingOut(BaseModel):
    title: str
    description: str
    quick_sale: PricingStrategyOut
    balanced: PricingStrategyOut
    premium: PricingStrategyOut


_LOOKBACK_DAYS = 90
_YEAR_BAND = 1
_MILEAGE_BAND = 0.30


def _fetch_market_comps(
    db,
    make: str,
    model: str,
    year: Optional[int],
    mileage: Optional[int],
) -> dict:
    """Query the listings table for comparable cars and return market summary stats."""
    if not (make and model and year and mileage):
        return {"count": 0, "comps": []}

    cutoff = datetime.now(timezone.utc) - timedelta(days=_LOOKBACK_DAYS)

    def _query(year_band: int, mileage_lo: float, mileage_hi: float):
        return (
            db.query(Listing.price_gbp, Listing.mileage)
            .filter(
                and_(
                    func.lower(Listing.make) == make.lower(),
                    func.lower(Listing.model) == model.lower(),
                    Listing.year.between(year - year_band, year + year_band),
                    Listing.mileage.between(
                        int(mileage * mileage_lo),
                        int(mileage * mileage_hi),
                    ),
                    Listing.llm_status == "valid",
                    Listing.first_seen_at >= cutoff,
                    Listing.removed_at.is_(None),
                    Listing.price_gbp.isnot(None),
                    Listing.mileage.isnot(None),
                )
            )
            .limit(200)
            .all()
        )

    rows = _query(_YEAR_BAND, 1 - _MILEAGE_BAND, 1 + _MILEAGE_BAND)
    if len(rows) < 5:
        rows = _query(2, 0.6, 1.4)

    if not rows:
        return {"count": 0, "comps": []}

    # Mileage-adjust each comp price to the target mileage
    adjusted = [
        int(price + DEPRECIATION_PER_MILE * (comp_mileage - mileage))
        for price, comp_mileage in rows
    ]
    adj_median = int(statistics.median(adjusted))
    raw_prices = sorted(r[0] for r in rows)

    return {
        "count": len(rows),
        "median_asking": int(statistics.median(raw_prices)),
        "adj_median": adj_median,
        "min_asking": raw_prices[0],
        "max_asking": raw_prices[-1],
        "samples": [
            {"price": r[0], "mileage": r[1]}
            for r in sorted(rows, key=lambda x: x[0])[:8]
        ],
    }


def _to_out(entry: FlipEntry) -> FlipOut:
    total_cost = entry.purchase_price + entry.additional_costs
    profit = (entry.sale_price - total_cost) if entry.sale_price is not None else None
    days = (
        (entry.date_sold - entry.date_bought).days
        if entry.date_sold and entry.date_bought
        else None
    )
    return FlipOut(
        id=entry.id,
        make=entry.make,
        model=entry.model,
        year=entry.year,
        mileage=entry.mileage,
        purchase_price=entry.purchase_price,
        sale_price=entry.sale_price,
        additional_costs=entry.additional_costs,
        total_cost=total_cost,
        profit=profit,
        date_bought=entry.date_bought,
        date_sold=entry.date_sold,
        days_to_sell=days,
        source=entry.source,
        notes=entry.notes,
        colour=entry.colour,
        fuel=entry.fuel,
        transmission=entry.transmission,
        features=entry.features,
        mot_advisories=entry.mot_advisories,
        listing_output=entry.listing_output,
        created_at=entry.created_at,
    )


@router.get("", response_model=list[FlipOut])
def list_flips(user: CurrentUser, db: DBSession) -> list[FlipOut]:
    entries = (
        db.query(FlipEntry)
        .filter(FlipEntry.user_id == user["id"])
        .order_by(FlipEntry.date_bought.desc())
        .all()
    )
    return [_to_out(e) for e in entries]


@router.post("", response_model=FlipOut, status_code=status.HTTP_201_CREATED)
def create_flip(body: FlipIn, user: CurrentUser, db: DBSession) -> FlipOut:
    entry = FlipEntry(user_id=user["id"], **body.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _to_out(entry)


@router.put("/{entry_id}", response_model=FlipOut)
def update_flip(entry_id: int, body: FlipIn, user: CurrentUser, db: DBSession) -> FlipOut:
    entry = db.get(FlipEntry, entry_id)
    if not entry or entry.user_id != user["id"]:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump().items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return _to_out(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flip(entry_id: int, user: CurrentUser, db: DBSession) -> None:
    entry = db.get(FlipEntry, entry_id)
    if not entry or entry.user_id != user["id"]:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(entry)
    db.commit()


@router.post("/{entry_id}/generate-listing", response_model=ListingOut)
def generate_listing(entry_id: int, body: GenerateListingIn, user: CurrentUser, db: DBSession) -> ListingOut:
    entry = db.get(FlipEntry, entry_id)
    if not entry or entry.user_id != user["id"]:
        raise HTTPException(status_code=404, detail="Not found")

    # Persist the features and MOT advisories so they're available next time
    entry.features = body.features or []
    entry.mot_advisories = body.mot_advisories
    db.commit()

    total_cost = entry.purchase_price + entry.additional_costs
    market = _fetch_market_comps(db, entry.make, entry.model, entry.year, entry.mileage)

    raw, _, _ = gemini_client.generate_listing(
        make=entry.make,
        model=entry.model,
        year=entry.year,
        mileage=entry.mileage,
        colour=entry.colour,
        fuel=entry.fuel,
        transmission=entry.transmission,
        total_cost=total_cost,
        features=body.features,
        mot_advisories=body.mot_advisories,
        market=market,
    )

    if not raw:
        raise HTTPException(status_code=502, detail="Listing generation failed — please try again")

    try:
        parsed = ListingOutput.model_validate(raw)
    except Exception:
        raise HTTPException(status_code=502, detail="Listing generation returned invalid data")

    result = ListingOut(
        title=parsed.title,
        description=parsed.description,
        quick_sale=PricingStrategyOut(**parsed.pricing.quick_sale.model_dump()),
        balanced=PricingStrategyOut(**parsed.pricing.balanced.model_dump()),
        premium=PricingStrategyOut(**parsed.pricing.premium.model_dump()),
    )

    entry.listing_output = result.model_dump()
    db.commit()

    return result
