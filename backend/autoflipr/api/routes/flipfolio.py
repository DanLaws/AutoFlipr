from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator

from autoflipr.api.deps import DBSession, CurrentUser
from autoflipr.db.models import FlipEntry
from autoflipr.llm import gemini_client
from autoflipr.llm.schemas import ListingOutput

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
    )

    if not raw:
        raise HTTPException(status_code=502, detail="Listing generation failed — please try again")

    try:
        parsed = ListingOutput.model_validate(raw)
    except Exception:
        raise HTTPException(status_code=502, detail="Listing generation returned invalid data")

    return ListingOut(
        title=parsed.title,
        description=parsed.description,
        quick_sale=PricingStrategyOut(**parsed.pricing.quick_sale.model_dump()),
        balanced=PricingStrategyOut(**parsed.pricing.balanced.model_dump()),
        premium=PricingStrategyOut(**parsed.pricing.premium.model_dump()),
    )
