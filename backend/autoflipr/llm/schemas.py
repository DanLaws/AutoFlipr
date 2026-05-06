from typing import Optional
from pydantic import BaseModel, field_validator
from datetime import datetime

PROMPT_VERSION_EXTRACTION = "extraction-v1"
PROMPT_VERSION_MOT = "mot-v1"
PROMPT_VERSION_ANALYSIS = "analysis-v1"


class ListingExtraction(BaseModel):
    """Validated output from the listing extraction prompt."""

    make: str
    model: str
    variant: Optional[str] = None
    year: int
    mileage: Optional[int] = None
    price_gbp: int
    registration: Optional[str] = None
    transmission: Optional[str] = None
    fuel: Optional[str] = None
    owners: Optional[int] = None
    seller_type: Optional[str] = None  # 'private' | 'trade'
    urgency_tags: list[str] = []
    location_text: Optional[str] = None
    body_type: Optional[str] = None
    colour: Optional[str] = None
    seller_name: Optional[str] = None

    @field_validator("year")
    @classmethod
    def year_plausible(cls, v: int) -> int:
        current_year = datetime.now().year
        if not (1990 <= v <= current_year + 1):
            raise ValueError(f"Year {v} out of plausible range")
        return v

    @field_validator("mileage")
    @classmethod
    def mileage_plausible(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (1 <= v <= 500_000):
            raise ValueError(f"Mileage {v} out of plausible range")
        return v

    @field_validator("price_gbp")
    @classmethod
    def price_plausible(cls, v: int) -> int:
        if not (100 <= v <= 250_000):
            raise ValueError(f"Price £{v} out of plausible range")
        return v

    @field_validator("registration", mode="before")
    @classmethod
    def normalise_reg(cls, v: Optional[str]) -> Optional[str]:
        import re
        if not v:
            return None
        normalised = v.upper().replace(" ", "")
        # Accept only plausible UK plate formats to avoid LLM hallucinations
        # from seller descriptions ("60K miles", "56 plate", etc.)
        _UK_PLATE = re.compile(
            r"^("
            r"[A-Z]{2}\d{2}[A-Z]{3}"          # new-style  AB12CDE (2001+)
            r"|[A-Z]\d{3}[A-Z]{3}"             # 90s prefix  A123BCD
            r"|[A-Z]{3}\d{3}[A-Z]"             # 70s suffix  ABC123D
            r"|[A-Z]{1,3}\d{1,4}"              # dateless short  A1 / AB12
            r"|[A-Z]{2}\d{2}[A-Z]{3}"          # duplicate guard
            r")$"
        )
        return normalised if _UK_PLATE.match(normalised) else None

    @field_validator("seller_type", mode="before")
    @classmethod
    def normalise_seller(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.lower()
            return v if v in ("private", "trade") else None
        return v


class MOTNarrative(BaseModel):
    """Validated output from the MOT analysis prompt."""

    summary: str
    risk_tags: list[str] = []
    mileage_consistent: Optional[bool] = None
    notable_advisories: list[str] = []


class PricingStrategy(BaseModel):
    """One of three pricing tiers from the listing assistant."""

    listed_price: int
    target_price: int
    rationale: str
    estimated_days: str


class ListingPricing(BaseModel):
    quick_sale: PricingStrategy
    balanced: PricingStrategy
    premium: PricingStrategy


class ListingOutput(BaseModel):
    """Validated output from the listing generation prompt."""

    title: str
    description: str
    pricing: ListingPricing


class VehicleAnalysis(BaseModel):
    """Validated output from the vehicle listing quality analysis prompt."""

    risk_score: int  # 0–100; higher = more concerns about listing quality
    red_flags: list[str] = []
    condition_notes: list[str] = []
    positives: list[str] = []
    narrative: str
    confidence_pct: int  # 0–100; how much usable info the listing contains

    @field_validator("risk_score", "confidence_pct")
    @classmethod
    def clamp_pct(cls, v: int) -> int:
        return max(0, min(100, v))
