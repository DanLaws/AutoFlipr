import pytest
from autoflipr.scoring.engine import (
    Comparable,
    MOTSummary,
    ScoringResult,
    score_listing,
    _trim_outliers,
    _robust_sigma,
    ASSUMED_FEES_GBP,
    ALGORITHM_VERSION,
    MIN_COMPS,
)


def make_comps(prices: list[int], mileage: int = 50_000) -> list[Comparable]:
    return [Comparable(price_gbp=p, mileage=mileage) for p in prices]


# ---------------------------------------------------------------------------
# Normal case
# ---------------------------------------------------------------------------

class TestNormalCase:
    def test_returns_scoring_result(self):
        comps = make_comps([5000, 5200, 4800, 5100, 5050])
        result = score_listing(4500, 50_000, comps)
        assert isinstance(result, ScoringResult)

    def test_cheap_listing_scores_high(self):
        comps = make_comps([10_000] * 6)
        result = score_listing(7_000, 50_000, comps)
        assert result.score > 70

    def test_expensive_listing_scores_low(self):
        comps = make_comps([5_000] * 6)
        result = score_listing(8_000, 50_000, comps)
        assert result.score < 30

    def test_fair_price_scores_around_50(self):
        comps = make_comps([5_000] * 6)
        result = score_listing(5_000, 50_000, comps)
        assert 40 <= result.score <= 60

    def test_estimated_value_is_median_of_adjusted(self):
        # All comps at same mileage as listing → adjusted == original price
        comps = make_comps([6_000, 6_000, 6_000, 6_000], mileage=40_000)
        result = score_listing(5_000, 40_000, comps)
        assert result.estimated_value_gbp == 6_000

    def test_margin_accounts_for_fees(self):
        comps = make_comps([6_000] * 5, mileage=40_000)
        result = score_listing(5_000, 40_000, comps)
        assert result.estimated_margin_gbp == 6_000 - 5_000 - ASSUMED_FEES_GBP

    def test_comparable_count_matches_input(self):
        comps = make_comps([5_000] * 7)
        result = score_listing(5_000, 50_000, comps)
        assert result.comparable_count == 7

    def test_algorithm_version_set(self):
        comps = make_comps([5_000] * 4)
        result = score_listing(5_000, 50_000, comps)
        assert result.algorithm_version == ALGORITHM_VERSION

    def test_score_clamped_between_0_and_100(self):
        comps = make_comps([100_000] * 10)
        result = score_listing(100, 50_000, comps)
        assert 0.0 <= result.score <= 100.0

        comps = make_comps([100] * 10)
        result = score_listing(100_000, 50_000, comps)
        assert 0.0 <= result.score <= 100.0


# ---------------------------------------------------------------------------
# Too few comparables
# ---------------------------------------------------------------------------

class TestInsufficientComparables:
    def test_zero_comps_returns_none(self):
        assert score_listing(5_000, 50_000, []) is None

    def test_one_comp_returns_none(self):
        assert score_listing(5_000, 50_000, make_comps([5_000])) is None

    def test_two_comps_returns_none(self):
        assert score_listing(5_000, 50_000, make_comps([5_000, 5_000])) is None

    def test_min_comps_returns_result(self):
        assert score_listing(5_000, 50_000, make_comps([5_000] * MIN_COMPS)) is not None


# ---------------------------------------------------------------------------
# Outlier trimming
# ---------------------------------------------------------------------------

class TestOutlierTrimming:
    def test_trim_removes_extreme_outlier(self):
        # Need enough "normal" values so Q3 isn't dragged up by the outlier
        values = [5_000.0, 5_050.0, 5_080.0, 5_100.0, 5_150.0, 5_200.0, 100_000.0]
        trimmed = _trim_outliers(values)
        assert 100_000.0 not in trimmed

    def test_trim_leaves_small_set_intact(self):
        values = [1_000.0, 2_000.0, 3_000.0]
        assert _trim_outliers(values) == values

    def test_outlier_does_not_inflate_value(self):
        normal_comps = make_comps([5_000] * 5)
        outlier_comps = make_comps([5_000] * 5 + [50_000])
        r_normal = score_listing(4_500, 50_000, normal_comps)
        r_outlier = score_listing(4_500, 50_000, outlier_comps)
        # Estimated value should be similar despite the outlier comp
        assert abs(r_normal.estimated_value_gbp - r_outlier.estimated_value_gbp) < 1_000

    def test_trimmed_set_falls_back_when_too_small(self):
        # If trimming would remove too many, falls back to untrimmed
        # With MIN_COMPS=3 and all distinct extreme values, trimming might leave <3
        # Verify result is still returned (not None)
        comps = make_comps([1_000, 5_000, 100_000])
        result = score_listing(3_000, 50_000, comps)
        assert result is not None


# ---------------------------------------------------------------------------
# MOT penalty
# ---------------------------------------------------------------------------

class TestMOTPenalty:
    def test_no_mot_means_zero_penalty(self):
        comps = make_comps([5_000] * 5)
        result = score_listing(5_000, 50_000, comps, mot=None)
        assert result.mot_penalty == 0.0

    def test_failures_add_5_points_each(self):
        comps = make_comps([5_000] * 5)
        mot = MOTSummary(failures_last_2y=2)
        result = score_listing(5_000, 50_000, comps, mot=mot)
        assert result.mot_penalty == 10.0

    def test_major_advisories_add_1_point_each(self):
        comps = make_comps([5_000] * 5)
        mot = MOTSummary(major_advisories_last_2y=3)
        result = score_listing(5_000, 50_000, comps, mot=mot)
        assert result.mot_penalty == 3.0

    def test_no_record_old_vehicle_adds_10(self):
        comps = make_comps([5_000] * 5)
        mot = MOTSummary(has_record=False, vehicle_age_years=5)
        result = score_listing(5_000, 50_000, comps, mot=mot)
        assert result.mot_penalty == 10.0

    def test_no_record_new_vehicle_no_penalty(self):
        comps = make_comps([5_000] * 5)
        mot = MOTSummary(has_record=False, vehicle_age_years=2)
        result = score_listing(5_000, 50_000, comps, mot=mot)
        assert result.mot_penalty == 0.0

    def test_mot_penalty_capped_at_30(self):
        comps = make_comps([5_000] * 5)
        mot = MOTSummary(
            failures_last_2y=10,         # 50 pts
            major_advisories_last_2y=10,  # 10 pts
            has_record=False,
            vehicle_age_years=10,         # 10 pts
        )
        result = score_listing(5_000, 50_000, comps, mot=mot)
        assert result.mot_penalty == 30.0

    def test_mot_penalty_reduces_score(self):
        comps = make_comps([10_000] * 6)
        r_clean = score_listing(7_000, 50_000, comps)
        r_mot = score_listing(7_000, 50_000, comps, mot=MOTSummary(failures_last_2y=3))
        assert r_mot.score < r_clean.score


# ---------------------------------------------------------------------------
# Zero-sigma guard
# ---------------------------------------------------------------------------

class TestZeroSigmaGuard:
    def test_identical_comparables_do_not_raise(self):
        # All comps identical → stdev=0 / IQR=0; _robust_sigma must return 1.0
        comps = make_comps([5_000] * 6)
        result = score_listing(5_000, 50_000, comps)
        assert result is not None

    def test_identical_comparables_sigma_is_1(self):
        values = [5_000.0] * 6
        sigma = _robust_sigma(values)
        assert sigma == 1.0


# ---------------------------------------------------------------------------
# Confidence tiers
# ---------------------------------------------------------------------------

class TestConfidenceTiers:
    def test_low_confidence_few_comps(self):
        comps = make_comps([5_000] * 4)
        result = score_listing(5_000, 50_000, comps)
        assert result.confidence == "low"

    def test_medium_confidence(self):
        comps = make_comps([5_000] * 7)
        result = score_listing(5_000, 50_000, comps)
        assert result.confidence == "medium"

    def test_high_confidence(self):
        comps = make_comps([5_000] * 12)
        result = score_listing(5_000, 50_000, comps)
        assert result.confidence == "high"

    def test_low_confidence_dampens_score(self):
        # Same inputs, more comps → higher effective score due to confidence multiplier
        comps_low = make_comps([10_000] * 4)
        comps_high = make_comps([10_000] * 12)
        r_low = score_listing(7_000, 50_000, comps_low)
        r_high = score_listing(7_000, 50_000, comps_high)
        assert r_low.score < r_high.score


# ---------------------------------------------------------------------------
# Mileage adjustment
# ---------------------------------------------------------------------------

class TestMileageAdjustment:
    def test_high_mileage_comp_adjusts_up(self):
        # Comp at 100k miles, listing at 50k → comp adjusted up (worth more if mileage were 50k)
        comp = Comparable(price_gbp=5_000, mileage=100_000)
        comps = [Comparable(price_gbp=5_000, mileage=100_000)] * 5
        result = score_listing(5_000, 50_000, comps)
        # Adjusted value should be higher than raw comp price
        assert result.estimated_value_gbp > 5_000

    def test_same_mileage_no_adjustment(self):
        comps = make_comps([6_000] * 5, mileage=40_000)
        result = score_listing(5_000, 40_000, comps)
        assert result.estimated_value_gbp == 6_000
