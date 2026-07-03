from urllib.parse import urlparse

VALID_DOMAINS = {
    "youtube.com",
    "youtu.be",
    "music.youtube.com",
    "m.youtube.com"
}

def is_valid_youtube_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False

        host = parsed.netloc.lower().split(":")[0]
        host = host.replace("www.", "")
        return host in VALID_DOMAINS
    except Exception:
        return False
