"""
Tests for services.llm_service.calculate_viral_score
"""

import pytest
from services.llm_service import calculate_viral_score


class TestViralScorePerfectInputs:
    """Verify score calculation with known factor values."""

    def test_all_factors_max_sweet_spot_duration(self):
        """All factors at 1.0 + duration in sweet spot (40s) → close to 100."""
        factors = {
            "contradiction": 1.0,
            "controversy": 1.0,
            "language_intensity": 1.0,  # not in formula but present
            "hook_clarity": 1.0,
            "engagement_potential": 1.0,
        }
        score = calculate_viral_score(factors, 40)
        # 1*30 + 1*20 + 1*20 + 1.0*10 + 1*20 = 100
        assert score == 100

    def test_all_factors_zero(self):
        """All factors at 0.0 → only duration component remains."""
        factors = {
            "contradiction": 0.0,
            "controversy": 0.0,
            "language_intensity": 0.0,
            "hook_clarity": 0.0,
            "engagement_potential": 0.0,
        }
        # duration 40s → mult 1.0 → 0 + 0 + 0 + 10 + 0 = 10
        assert calculate_viral_score(factors, 40) == 10

    def test_empty_factors(self):
        """Empty dict defaults every factor to 0."""
        score = calculate_viral_score({}, 40)
        # only duration_mult*10 = 10
        assert score == 10


class TestDurationBrackets:
    """Verify the stepped duration multiplier."""

    _max_factors = {
        "contradiction": 1.0,
        "controversy": 1.0,
        "hook_clarity": 1.0,
        "engagement_potential": 1.0,
    }

    @pytest.mark.parametrize("duration", [25, 40, 60])
    def test_sweet_spot_25_60(self, duration):
        """25-60s → mult 1.0 → duration component = 10."""
        score = calculate_viral_score(self._max_factors, duration)
        # 30+20+20+10+20 = 100
        assert score == 100

    @pytest.mark.parametrize("duration", [61, 75, 90])
    def test_acceptable_61_90(self, duration):
        """61-90s → mult 0.8 → duration component = 8."""
        score = calculate_viral_score(self._max_factors, duration)
        # 30+20+20+8+20 = 98
        assert score == 98

    @pytest.mark.parametrize("duration", [20, 22, 24])
    def test_ultra_short_20_24(self, duration):
        """20-24s → mult 0.7 → duration component = 7."""
        score = calculate_viral_score(self._max_factors, duration)
        # 30+20+20+7+20 = 97
        assert score == 97

    @pytest.mark.parametrize("duration", [91, 100, 120])
    def test_long_91_120(self, duration):
        """91-120s → mult 0.6 → duration component = 6."""
        score = calculate_viral_score(self._max_factors, duration)
        # 30+20+20+6+20 = 96
        assert score == 96

    @pytest.mark.parametrize("duration", [5, 19, 121, 200])
    def test_out_of_range(self, duration):
        """<20s or >120s → mult 0.5 → duration component = 5."""
        score = calculate_viral_score(self._max_factors, duration)
        # 30+20+20+5+20 = 95
        assert score == 95


class TestClamping:
    """Score and factor value clamping."""

    def test_score_clamped_to_100(self):
        """Even with absurd internal values the score cannot exceed 100."""
        # Factors are clamped to [0,1] so no combination can exceed 100
        factors = {
            "contradiction": 1.0,
            "controversy": 1.0,
            "hook_clarity": 1.0,
            "engagement_potential": 1.0,
        }
        assert calculate_viral_score(factors, 40) <= 100

    def test_score_clamped_to_0(self):
        """Score can never go below 0."""
        factors = {
            "contradiction": -5.0,
            "controversy": -5.0,
            "hook_clarity": -5.0,
            "engagement_potential": -5.0,
        }
        score = calculate_viral_score(factors, 5)
        assert score >= 0

    def test_negative_factors_clamped_to_zero(self):
        """Negative factor values act as 0."""
        factors = {
            "contradiction": -1.0,
            "controversy": -1.0,
            "hook_clarity": -1.0,
            "engagement_potential": -1.0,
        }
        # All clamped to 0 → 0+0+0+duration+0
        score = calculate_viral_score(factors, 40)
        expected_duration_only = 10  # 1.0 * 10
        assert score == expected_duration_only

    def test_factors_above_one_clamped(self):
        """Factor values > 1.0 act as 1.0."""
        factors = {
            "contradiction": 5.0,
            "controversy": 5.0,
            "hook_clarity": 5.0,
            "engagement_potential": 5.0,
        }
        # All clamped to 1.0 → same as max
        assert calculate_viral_score(factors, 40) == 100


class TestEdgeCases:
    """Various edge cases."""

    def test_zero_duration(self):
        """Duration 0 → out of range → mult 0.5."""
        score = calculate_viral_score({}, 0)
        assert score == 5  # 0.5 * 10

    def test_string_factor_values(self):
        """Factors stored as strings should be converted via float()."""
        factors = {
            "contradiction": "0.9",
            "controversy": "0.7",
            "hook_clarity": "0.8",
            "engagement_potential": "0.85",
        }
        score = calculate_viral_score(factors, 50)
        assert isinstance(score, int)
        assert 0 <= score <= 100

    def test_missing_engagement_key(self):
        """Missing 'engagement_potential' defaults to 0."""
        factors = {"contradiction": 1.0}
        score = calculate_viral_score(factors, 40)
        # 1*30 + 0 + 0 + 1.0*10 + 0 = 40
        assert score == 40
