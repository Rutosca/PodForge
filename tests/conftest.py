"""
Shared fixtures for PodForge test suite.

Provides mocked Redis, Supabase, and Flask test client so tests
never depend on external services.
"""

import os
import sys
import shutil
import tempfile
from unittest.mock import MagicMock, patch

import pytest

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


# ── Fake Redis ──────────────────────────────────────────────────────

class FakeRedis:
    """In-memory Redis replacement backed by a plain dict."""

    def __init__(self):
        self._store: dict[str, bytes] = {}
        self._ttls: dict[str, int] = {}

    # --- string ops -------------------------------------------------------
    def get(self, key):
        return self._store.get(key)

    def set(self, key, value, ex=None):
        self._store[key] = (
            str(value).encode() if not isinstance(value, bytes) else value
        )
        if ex is not None:
            self._ttls[key] = ex

    def incr(self, key):
        current = int(self._store.get(key, b"0"))
        current += 1
        self._store[key] = str(current).encode()
        return current

    def decr(self, key):
        current = int(self._store.get(key, b"0"))
        current -= 1
        self._store[key] = str(current).encode()
        return current

    def expire(self, key, seconds):
        self._ttls[key] = seconds

    def delete(self, key):
        self._store.pop(key, None)

    def exists(self, key):
        return key in self._store

    def flushall(self):
        self._store.clear()
        self._ttls.clear()

    @classmethod
    def from_url(cls, *_args, **_kwargs):
        return cls()

    def register_script(self, script):
        class FakeScript:
            def __call__(self, keys=None, args=None, client=None):
                return b"1"
        return FakeScript()


# ── Fixtures ────────────────────────────────────────────────────────

@pytest.fixture()
def mock_redis():
    """Return a FakeRedis instance that can be injected into app modules."""
    return FakeRedis()


@pytest.fixture()
def mock_supabase():
    """Return a MagicMock that behaves like a Supabase Client."""
    client = MagicMock()
    # Default: auth.get_user returns a user object
    user_obj = MagicMock()
    user_obj.user.id = "test-user-id-123"
    client.auth.get_user.return_value = user_obj
    # Default: rpc('incrementar_uso_si_posible') succeeds
    rpc_result = MagicMock()
    rpc_result.data = True
    client.rpc.return_value.execute.return_value = rpc_result
    return client


@pytest.fixture()
def app_client(mock_redis, mock_supabase):
    """
    Flask test client with Redis and Supabase mocked out at module level.

    The patches are applied *before* importing ``app`` so the module-level
    initialisations (``supabase = create_client(...)`` etc.) use the fakes.
    """
    # Patch external dependencies before app import
    with (
        patch("redis.Redis.from_url", return_value=mock_redis),
        patch("supabase.create_client", return_value=mock_supabase),
        # Prevent the background RQ worker thread from starting
        patch("threading.Thread"),
        # Stub RQ queue
        patch("rq.Queue", return_value=MagicMock()),
    ):
        # Force re-import of app module with patches active
        if "app" in sys.modules:
            del sys.modules["app"]
        if "tasks" in sys.modules:
            del sys.modules["tasks"]

        # Stub tasks module before app imports it
        tasks_stub = MagicMock()
        tasks_stub.queue = MagicMock()
        sys.modules["tasks"] = tasks_stub

        import app as app_module  # noqa: E402

        # Inject mocked objects into the loaded module
        app_module.redis_conn = mock_redis
        app_module.supabase = mock_supabase
        app_module.queue = tasks_stub.queue

        # Disable rate-limiter for test runs
        app_module.limiter.enabled = False

        app_module.app.config["TESTING"] = True

        with app_module.app.test_client() as client:
            yield client

        # Cleanup cached module so next test gets a fresh import
        sys.modules.pop("app", None)
        sys.modules.pop("tasks", None)


@pytest.fixture()
def tmp_dir():
    """
    Create a temporary directory for file-system tests.
    Automatically cleaned up after the test.
    """
    d = tempfile.mkdtemp(prefix="podforge_test_")
    yield d
    shutil.rmtree(d, ignore_errors=True)
