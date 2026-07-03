"""
Tests for helper functions in services.llm_service:
  - _timestamp_to_seconds
  - _extract_clip_transcript
  - _normalize_clips
"""

import pytest
from services.llm_service import (
    _timestamp_to_seconds,
    _extract_clip_transcript,
    _normalize_clips,
)


# ── _timestamp_to_seconds ──────────────────────────────────────────

class TestTimestampToSeconds:
    """Convert MM:SS and H:MM:SS strings to integer seconds."""

    def test_zero(self):
        assert _timestamp_to_seconds("00:00") == 0

    def test_minutes_and_seconds(self):
        assert _timestamp_to_seconds("01:30") == 90

    def test_large_minutes(self):
        assert _timestamp_to_seconds("12:14") == 734

    def test_hours_minutes_seconds(self):
        # 1*3600 + 5*60 + 30 = 3930
        assert _timestamp_to_seconds("1:05:30") == 3930

    def test_hours_zero(self):
        assert _timestamp_to_seconds("0:00:00") == 0

    def test_invalid_format_returns_zero(self):
        assert _timestamp_to_seconds("not-a-timestamp") == 0

    def test_empty_string_returns_zero(self):
        assert _timestamp_to_seconds("") == 0

    def test_single_number_returns_zero(self):
        assert _timestamp_to_seconds("42") == 0

    def test_four_parts_returns_zero(self):
        assert _timestamp_to_seconds("1:2:3:4") == 0

    def test_whitespace_handling(self):
        assert _timestamp_to_seconds("  01:30  ") == 90


# ── _extract_clip_transcript ───────────────────────────────────────

class TestExtractClipTranscript:
    """Extract relevant lines from a timestamped transcription."""

    SAMPLE = (
        "[00:00] Intro del podcast\n"
        "[01:00] Hablamos sobre marketing\n"
        "[02:00] El marketing digital ha cambiado\n"
        "[03:00] Estrategias de redes sociales\n"
        "[04:00] Conclusión del tema\n"
        "[05:00] Despedida"
    )

    def test_extracts_lines_within_range(self):
        # Clip from 02:00 to 03:00 with 120s buffer → 00:00 to 05:00
        result = _extract_clip_transcript(self.SAMPLE, "02:00", "03:00", buffer_seconds=120)
        assert "[02:00]" in result
        assert "[03:00]" in result

    def test_buffer_includes_surrounding_context(self):
        # Clip 02:00–03:00, buffer 60s → should include 01:00 and 04:00
        result = _extract_clip_transcript(self.SAMPLE, "02:00", "03:00", buffer_seconds=60)
        assert "[01:00]" in result
        assert "[04:00]" in result

    def test_no_matching_lines_returns_fallback(self):
        # Looking for timestamps way beyond what's in the sample
        result = _extract_clip_transcript(self.SAMPLE, "99:00", "99:30", buffer_seconds=0)
        # Should fall back to first 5000 chars of transcription
        assert "Intro del podcast" in result

    def test_empty_transcription(self):
        result = _extract_clip_transcript("", "01:00", "02:00")
        assert result == ""  # empty string sliced to [:5000] is still ""

    def test_non_timestamped_lines_ignored(self):
        mixed = "[01:00] Timestamped line\nPlain text line\n[02:00] Another stamped"
        result = _extract_clip_transcript(mixed, "00:00", "03:00", buffer_seconds=0)
        assert "Plain text" not in result
        assert "[01:00]" in result


# ── _normalize_clips ────────────────────────────────────────────────

class TestNormalizeClips:
    """Normalize LLM output into a consistent clip format."""

    def test_calculates_viral_score(self):
        data = {
            "resumen_global_contexto": "Test context",
            "clips": [
                {
                    "start": "01:00",
                    "end": "01:50",
                    "duration_seconds": 50,
                    "topic": "Test topic",
                    "type": "contradiction",
                    "factors": {
                        "contradiction": 0.9,
                        "controversy": 0.7,
                        "hook_clarity": 0.8,
                        "engagement_potential": 0.85,
                    },
                }
            ],
        }
        result = _normalize_clips(data)
        clip = result["clips"][0]
        assert "viral_score" in clip
        assert isinstance(clip["viral_score"], int)
        assert 0 <= clip["viral_score"] <= 100

    def test_sorts_by_viral_score_descending(self):
        data = {
            "clips": [
                {
                    "duration_seconds": 40,
                    "factors": {"contradiction": 0.2, "controversy": 0.2,
                                "hook_clarity": 0.2, "engagement_potential": 0.2},
                },
                {
                    "duration_seconds": 40,
                    "factors": {"contradiction": 1.0, "controversy": 1.0,
                                "hook_clarity": 1.0, "engagement_potential": 1.0},
                },
            ]
        }
        result = _normalize_clips(data)
        scores = [c["viral_score"] for c in result["clips"]]
        assert scores == sorted(scores, reverse=True)

    def test_sets_default_values(self):
        data = {"clips": [{"duration_seconds": 40, "factors": {}}]}
        result = _normalize_clips(data)
        clip = result["clips"][0]
        assert clip["frase_clave"] == ""
        assert clip["por_que_viral"] == []
        assert clip["platform_fit"] == {}
        assert clip["clip_tipo"] == "insight"
        assert clip["intensidad_hook"] == 3

    def test_empty_clips_list(self):
        result = _normalize_clips({"clips": []})
        assert result["clips"] == []

    def test_missing_clips_key(self):
        result = _normalize_clips({})
        assert result["clips"] == []

    def test_platforms_to_platform_fit_retrocompat(self):
        """Legacy 'platforms' list should be converted to platform_fit dict."""
        data = {
            "clips": [
                {
                    "duration_seconds": 40,
                    "factors": {},
                    "platforms": ["tiktok", "instagram"],
                }
            ]
        }
        result = _normalize_clips(data)
        pf = result["clips"][0]["platform_fit"]
        assert pf == {"tiktok": 70, "instagram": 70}

    def test_preserves_resumen_global_contexto(self):
        data = {
            "resumen_global_contexto": "Podcast de negocios, tono informal.",
            "clips": [],
        }
        result = _normalize_clips(data)
        assert result["resumen_global_contexto"] == "Podcast de negocios, tono informal."
