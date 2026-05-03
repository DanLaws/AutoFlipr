import pytest
from datetime import datetime
from pydantic import ValidationError

from autoflipr.llm.schemas import ListingExtraction, VehicleAnalysis, MOTNarrative


BASE = dict(
    make="Ford",
    model="Focus",
    year=2015,
    price_gbp=5_000,
)


# ---------------------------------------------------------------------------
# Year validator
# ---------------------------------------------------------------------------

class TestYearValidator:
    def test_valid_year_accepted(self):
        e = ListingExtraction(**BASE)
        assert e.year == 2015

    def test_boundary_1990_accepted(self):
        e = ListingExtraction(**{**BASE, "year": 1990})
        assert e.year == 1990

    def test_next_year_accepted(self):
        next_year = datetime.now().year + 1
        e = ListingExtraction(**{**BASE, "year": next_year})
        assert e.year == next_year

    def test_year_too_old_raises(self):
        with pytest.raises(ValidationError, match="out of plausible range"):
            ListingExtraction(**{**BASE, "year": 1989})

    def test_far_future_year_raises(self):
        with pytest.raises(ValidationError, match="out of plausible range"):
            ListingExtraction(**{**BASE, "year": datetime.now().year + 2})


# ---------------------------------------------------------------------------
# Mileage validator
# ---------------------------------------------------------------------------

class TestMileageValidator:
    def test_none_mileage_accepted(self):
        e = ListingExtraction(**{**BASE, "mileage": None})
        assert e.mileage is None

    def test_omitted_mileage_defaults_none(self):
        e = ListingExtraction(**BASE)
        assert e.mileage is None

    def test_valid_mileage_accepted(self):
        e = ListingExtraction(**{**BASE, "mileage": 50_000})
        assert e.mileage == 50_000

    def test_boundary_1_accepted(self):
        e = ListingExtraction(**{**BASE, "mileage": 1})
        assert e.mileage == 1

    def test_boundary_500000_accepted(self):
        e = ListingExtraction(**{**BASE, "mileage": 500_000})
        assert e.mileage == 500_000

    def test_zero_mileage_raises(self):
        with pytest.raises(ValidationError, match="out of plausible range"):
            ListingExtraction(**{**BASE, "mileage": 0})

    def test_negative_mileage_raises(self):
        with pytest.raises(ValidationError, match="out of plausible range"):
            ListingExtraction(**{**BASE, "mileage": -1})

    def test_mileage_above_500000_raises(self):
        with pytest.raises(ValidationError, match="out of plausible range"):
            ListingExtraction(**{**BASE, "mileage": 500_001})


# ---------------------------------------------------------------------------
# Price validator
# ---------------------------------------------------------------------------

class TestPriceValidator:
    def test_valid_price_accepted(self):
        e = ListingExtraction(**BASE)
        assert e.price_gbp == 5_000

    def test_boundary_100_accepted(self):
        e = ListingExtraction(**{**BASE, "price_gbp": 100})
        assert e.price_gbp == 100

    def test_boundary_250000_accepted(self):
        e = ListingExtraction(**{**BASE, "price_gbp": 250_000})
        assert e.price_gbp == 250_000

    def test_price_too_low_raises(self):
        with pytest.raises(ValidationError, match="out of plausible range"):
            ListingExtraction(**{**BASE, "price_gbp": 99})

    def test_price_too_high_raises(self):
        with pytest.raises(ValidationError, match="out of plausible range"):
            ListingExtraction(**{**BASE, "price_gbp": 250_001})


# ---------------------------------------------------------------------------
# Registration normalisation
# ---------------------------------------------------------------------------

class TestRegNormalisation:
    def test_none_registration_returns_none(self):
        e = ListingExtraction(**{**BASE, "registration": None})
        assert e.registration is None

    def test_empty_string_returns_none(self):
        e = ListingExtraction(**{**BASE, "registration": ""})
        assert e.registration is None

    def test_new_style_plate_accepted(self):
        e = ListingExtraction(**{**BASE, "registration": "AB12CDE"})
        assert e.registration == "AB12CDE"

    def test_new_style_plate_lowercased_normalised(self):
        e = ListingExtraction(**{**BASE, "registration": "ab12cde"})
        assert e.registration == "AB12CDE"

    def test_new_style_plate_with_space_normalised(self):
        e = ListingExtraction(**{**BASE, "registration": "AB12 CDE"})
        assert e.registration == "AB12CDE"

    def test_90s_prefix_plate_accepted(self):
        e = ListingExtraction(**{**BASE, "registration": "A123BCD"})
        assert e.registration == "A123BCD"

    def test_70s_suffix_plate_accepted(self):
        e = ListingExtraction(**{**BASE, "registration": "ABC123D"})
        assert e.registration == "ABC123D"

    def test_dateless_short_plate_accepted(self):
        e = ListingExtraction(**{**BASE, "registration": "A1"})
        assert e.registration == "A1"

    def test_hallucination_returns_none(self):
        # "60K miles" style text LLM might emit
        e = ListingExtraction(**{**BASE, "registration": "60K miles"})
        assert e.registration is None

    def test_numeric_only_returns_none(self):
        e = ListingExtraction(**{**BASE, "registration": "12345"})
        assert e.registration is None


# ---------------------------------------------------------------------------
# Seller type normalisation
# ---------------------------------------------------------------------------

class TestSellerTypeNormalisation:
    def test_private_accepted(self):
        e = ListingExtraction(**{**BASE, "seller_type": "private"})
        assert e.seller_type == "private"

    def test_trade_accepted(self):
        e = ListingExtraction(**{**BASE, "seller_type": "trade"})
        assert e.seller_type == "trade"

    def test_uppercase_normalised(self):
        e = ListingExtraction(**{**BASE, "seller_type": "PRIVATE"})
        assert e.seller_type == "private"

    def test_unknown_value_returns_none(self):
        e = ListingExtraction(**{**BASE, "seller_type": "dealer"})
        assert e.seller_type is None

    def test_none_seller_type_accepted(self):
        e = ListingExtraction(**{**BASE, "seller_type": None})
        assert e.seller_type is None


# ---------------------------------------------------------------------------
# VehicleAnalysis percent clamp
# ---------------------------------------------------------------------------

class TestVehicleAnalysisClamp:
    def _make(self, risk: int, conf: int) -> VehicleAnalysis:
        return VehicleAnalysis(risk_score=risk, narrative="test", confidence_pct=conf)

    def test_valid_values_pass_through(self):
        v = self._make(50, 80)
        assert v.risk_score == 50
        assert v.confidence_pct == 80

    def test_zero_and_100_boundary(self):
        v = self._make(0, 100)
        assert v.risk_score == 0
        assert v.confidence_pct == 100

    def test_above_100_clamped_to_100(self):
        v = self._make(150, 200)
        assert v.risk_score == 100
        assert v.confidence_pct == 100

    def test_below_0_clamped_to_0(self):
        v = self._make(-10, -5)
        assert v.risk_score == 0
        assert v.confidence_pct == 0
