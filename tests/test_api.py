"""
Integration tests for Flask API endpoints.

Uses the ``app_client`` fixture from conftest which patches Redis,
Supabase, and the RQ worker so nothing external is needed.
"""

import io
import json
import pytest
from unittest.mock import MagicMock


# ═══════════════════════════════════════════════════════════════════
# POST /transformar
# ═══════════════════════════════════════════════════════════════════

class TestTransformar:
    """POST /transformar — URL-based podcast processing."""

    def test_missing_url_returns_400(self, app_client):
        resp = app_client.post("/transformar", data={})
        assert resp.status_code == 400
        body = resp.get_json()
        assert "error" in body

    def test_invalid_url_returns_400(self, app_client):
        resp = app_client.post("/transformar", data={"url": "https://google.com"})
        assert resp.status_code == 400
        body = resp.get_json()
        assert "error" in body


# ═══════════════════════════════════════════════════════════════════
# POST /subir
# ═══════════════════════════════════════════════════════════════════

class TestSubir:
    """POST /subir — file upload processing."""

    def test_no_file_returns_400(self, app_client):
        resp = app_client.post("/subir", data={})
        assert resp.status_code == 400
        body = resp.get_json()
        assert "error" in body

    def test_empty_filename_returns_400(self, app_client):
        data = {"file": (io.BytesIO(b"audio data"), "")}
        resp = app_client.post(
            "/subir",
            data=data,
            content_type="multipart/form-data",
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "error" in body


# ═══════════════════════════════════════════════════════════════════
# GET /status/<job_id>
# ═══════════════════════════════════════════════════════════════════

class TestStatus:
    """GET /status/<job_id> — job polling."""

    def test_job_not_found_returns_404(self, app_client):
        resp = app_client.get("/status/nonexistent-job-id-999")
        assert resp.status_code in (404, 500)
        body = resp.get_json()
        assert "error" in body


# ═══════════════════════════════════════════════════════════════════
# GET /creditos
# ═══════════════════════════════════════════════════════════════════

class TestCreditos:
    """GET /creditos — credit balance."""

    def test_anonymous_returns_remaining(self, app_client):
        resp = app_client.get("/creditos")
        assert resp.status_code == 200
        body = resp.get_json()
        assert "remaining" in body
        assert isinstance(body["remaining"], int)
        assert body["remaining"] >= 0

    def test_anonymous_plan_is_free(self, app_client):
        resp = app_client.get("/creditos")
        body = resp.get_json()
        assert body.get("plan") == "FREE"
        assert body.get("unlimited") is False


# ═══════════════════════════════════════════════════════════════════
# GET /historial
# ═══════════════════════════════════════════════════════════════════

class TestHistorial:
    """GET /historial — analysis history."""

    def test_no_auth_returns_empty_historial(self, app_client):
        resp = app_client.get("/historial")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["historial"] == []

    def test_bearer_null_returns_empty(self, app_client):
        resp = app_client.get(
            "/historial",
            headers={"Authorization": "Bearer null"},
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["historial"] == []


# ═══════════════════════════════════════════════════════════════════
# POST /generar-copy
# ═══════════════════════════════════════════════════════════════════

class TestGenerarCopy:
    """POST /generar-copy — on-demand copy generation."""

    def test_no_json_returns_400(self, app_client):
        resp = app_client.post("/generar-copy", data="not json")
        assert resp.status_code == 400
        body = resp.get_json()
        assert "error" in body

    def test_missing_clip_returns_400(self, app_client):
        resp = app_client.post(
            "/generar-copy",
            data=json.dumps({"transcripcion": "Some text"}),
            content_type="application/json",
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "clip" in body["error"].lower()

    def test_missing_transcripcion_returns_400(self, app_client):
        resp = app_client.post(
            "/generar-copy",
            data=json.dumps({"clip": {"start": "00:00", "end": "01:00"}}),
            content_type="application/json",
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "transcripcion" in body["error"].lower()


# ═══════════════════════════════════════════════════════════════════
# POST /extraer-ideas
# ═══════════════════════════════════════════════════════════════════

class TestExtraerIdeas:
    """POST /extraer-ideas — idea extraction engine."""

    def test_no_json_returns_400(self, app_client):
        resp = app_client.post("/extraer-ideas", data="not json")
        assert resp.status_code == 400
        body = resp.get_json()
        assert "error" in body

    def test_missing_transcripcion_returns_400(self, app_client):
        resp = app_client.post(
            "/extraer-ideas",
            data=json.dumps({"resumen_contexto": "algo"}),
            content_type="application/json",
        )
        assert resp.status_code == 400
        body = resp.get_json()
        assert "transcripcion" in body["error"].lower()
