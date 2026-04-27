# ARCHITECTURAL CONSTRAINT: NO imports from carflip.llm in this file or package
import statistics
from dataclasses import dataclass, field
from typing import Optional

ALGORITHM_VERSION = "1.0"
DEPRECIATION_PER_MILE = 0.08  # £ per mile — adjust per segment when data allows
ASSUMED_FEES_GBP = 300
MIN_COMPS = 1
CONFIDENCE_HIGH = 10
CONFIDENCE_MEDIUM = 5
CONFIDENCE_FACTORS = {"high": 1.0, "medium": 0.85, "low": 0.65}


@dataclass
class Comparable:
    price_gbp: int
    mileage: int


@dataclass
class MOTSummary:
    failures_last_2y: int = 0
    major_advisories_last_2y: int = 0
    has_record: bool = True
    vehicle_age_years: int = 0


@dataclass
class ScoringResult:
    score: float
    estimated_value_gbp: int
    estimated_margin_gbp: int
    price_deviation_pct: float
    comparable_count: int
    mot_penalty: float
    confidence: str
    algorithm_version: str = field(default=ALGORITHM_VERSION)


def _mileage_adjust(price: int, comp_mileage: int, target_mileage: int) -> float:
    return price + DEPRECIATION_PER_MILE * (comp_mileage - target_mileage)


def _trim_outliers(values: list[float]) -> list[float]:
    if len(values) < 4:
        return values
    qs = statistics.quantiles(values, n=4)
    q1, q3 = qs[0], qs[2]
    iqr = q3 - q1
    return [v for v in values if (q1 - 1.5 * iqr) <= v <= (q3 + 1.5 * iqr)]


def _confidence_tier(n: int) -> str:
    if n >= CONFIDENCE_HIGH:
        return "high"
    if n >= CONFIDENCE_MEDIUM:
        return "medium"
    return "low"


def _robust_sigma(values: list[float]) -> float:
    if len(values) >= 4:
        qs = statistics.quantiles(values, n=4)
        iqr = qs[2] - qs[0]
        return iqr / 1.349 if iqr > 0 else 1.0
    if len(values) > 1:
        return statistics.stdev(values) or 1.0
    return 1.0


def score_listing(
    price_gbp: int,
    mileage: int,
    comparables: list[Comparable],
    mot: Optional[MOTSummary] = None,
) -> Optional[ScoringResult]:
    """
    Score a listing against its comparables.
    Returns None if there are too few comparables to score confidently.
    """
    if len(comparables) < MIN_COMPS:
        return None

    adjusted = [_mileage_adjust(c.price_gbp, c.mileage, mileage) for c in comparables]
    trimmed = _trim_outliers(adjusted)
    if len(trimmed) < MIN_COMPS:
        trimmed = adjusted  # don't over-trim small sets

    median = statistics.median(trimmed)
    sigma = _robust_sigma(trimmed)
    robust_z = (median - price_gbp) / sigma  # positive = listing is cheaper than market

    mot_penalty = 0.0
    if mot:
        mot_penalty += 5.0 * mot.failures_last_2y
        mot_penalty += 1.0 * mot.major_advisories_last_2y
        if not mot.has_record and mot.vehicle_age_years > 3:
            mot_penalty += 10.0
        mot_penalty = min(mot_penalty, 30.0)

    confidence = _confidence_tier(len(comparables))
    base = max(0.0, min(100.0, 50.0 + 15.0 * robust_z))
    raw = (base - mot_penalty) * CONFIDENCE_FACTORS[confidence]
    score = round(max(0.0, min(100.0, raw)), 2)

    estimated_value = int(median)
    price_deviation_pct = round(((price_gbp - median) / median) * 100, 2) if median else 0.0

    return ScoringResult(
        score=score,
        estimated_value_gbp=estimated_value,
        estimated_margin_gbp=estimated_value - price_gbp - ASSUMED_FEES_GBP,
        price_deviation_pct=price_deviation_pct,
        comparable_count=len(comparables),
        mot_penalty=mot_penalty,
        confidence=confidence,
    )
