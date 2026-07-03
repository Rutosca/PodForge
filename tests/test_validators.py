"""
Tests for utils.validators.is_valid_youtube_url
"""

import pytest
from utils.validators import is_valid_youtube_url


# ── Valid URLs ───────────────────────────────────────────────────────

class TestValidYouTubeURLs:
    """URLs that MUST be accepted."""

    @pytest.mark.parametrize("url", [
        "https://youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "http://youtube.com/watch?v=abc123",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://www.youtu.be/dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=abc",
        "https://music.youtube.com/watch?v=abc",
        "https://www.music.youtube.com/watch?v=abc",
    ])
    def test_valid_url(self, url):
        assert is_valid_youtube_url(url) is True

    def test_with_port(self):
        assert is_valid_youtube_url("https://youtube.com:443/watch?v=abc") is True

    def test_with_extra_path_segments(self):
        assert is_valid_youtube_url(
            "https://youtube.com/watch?v=abc&list=PLxyz&index=5"
        ) is True

    def test_with_www_prefix(self):
        assert is_valid_youtube_url("https://www.youtube.com/watch?v=abc") is True

    def test_youtu_be_with_path(self):
        assert is_valid_youtube_url("https://youtu.be/abc123?t=42") is True

    def test_m_youtube_with_shorts(self):
        assert is_valid_youtube_url("https://m.youtube.com/shorts/abc123") is True


# ── Invalid URLs ─────────────────────────────────────────────────────

class TestInvalidYouTubeURLs:
    """URLs that MUST be rejected."""

    @pytest.mark.parametrize("url", [
        "https://google.com",
        "https://vimeo.com/12345",
        "https://dailymotion.com/video/x12345",
        "https://notyoutube.com/watch?v=abc",
        "https://youtube.com.evil.com/watch?v=abc",
    ])
    def test_non_youtube_sites(self, url):
        assert is_valid_youtube_url(url) is False

    def test_empty_string(self):
        assert is_valid_youtube_url("") is False

    def test_non_http_scheme_ftp(self):
        assert is_valid_youtube_url("ftp://youtube.com/watch?v=abc") is False

    def test_non_http_scheme_javascript(self):
        assert is_valid_youtube_url("javascript:alert(1)") is False

    def test_no_scheme(self):
        assert is_valid_youtube_url("youtube.com/watch?v=abc") is False

    def test_malformed_url(self):
        assert is_valid_youtube_url("not a url at all") is False

    def test_none_value(self):
        # urlparse(None) raises; the bare except should catch it
        assert is_valid_youtube_url(None) is False  # type: ignore[arg-type]

    def test_data_uri(self):
        assert is_valid_youtube_url("data:text/html,<h1>hi</h1>") is False
