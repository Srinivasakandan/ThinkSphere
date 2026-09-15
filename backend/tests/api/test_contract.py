"""API contract tests — spec sections 66-69.

Verifies response shapes, enum values, auth enforcement and pagination
format match docs/API_CONTRACT.md, independent of the broader
acceptance-flow test.
"""

import io
import uuid

from fastapi import UploadFile

from app.core.config import Settings, get_settings
from app.main import app
from app.repositories import inspection_repository
from app.services.image_service import upload_images
from app.services.ocr.base import OCRResultData, OCRService
from app.services.processing_service import run_processing
from app.services.storage import get_storage_service
from tests.conftest import make_png_bytes


def test_create_inspection_matches_contract_shape(client):
    response = client.post(
        "/api/v1/inspections",
        json={"product_name": "Test Product", "category": "Food"},
    )
    assert response.status_code == 201
    body = response.json()
    assert set(body.keys()) == {"id", "stage"}
    assert body["stage"] == "CREATED"


def test_error_responses_use_the_standard_envelope(client):
    response = client.get("/api/v1/inspections/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert set(body["error"].keys()) >= {"code", "message"}
    assert body["error"]["code"] == "INSPECTION_NOT_FOUND"


def test_validation_error_uses_standard_envelope_with_details(client):
    response = client.post("/api/v1/inspections", json={"category": 12345})
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert "details" in body["error"]


def test_list_inspections_pagination_shape(client, seeded_rules):
    client.post("/api/v1/inspections", json={"product_name": "Paginated Product"})
    response = client.get("/api/v1/inspections", params={"page": 1, "page_size": 5})
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "total", "page", "page_size"}
    assert body["page"] == 1
    assert body["page_size"] == 5


def test_rule_result_status_enum_values_are_the_contract_values(client, seeded_rules):
    create_response = client.post("/api/v1/inspections", json={"product_name": "Enum Check"})
    inspection_id = create_response.json()["id"]
    files = [("files", ("front.png", make_png_bytes(), "image/png"))]
    client.post(f"/api/v1/inspections/{inspection_id}/images", files=files, data={"view_types": ["FRONT"]})
    client.post(f"/api/v1/inspections/{inspection_id}/process")

    rules = client.get(f"/api/v1/inspections/{inspection_id}/rules").json()["rules"]
    assert rules, "expected at least one evaluated rule"
    for rule in rules:
        assert rule["status"] in ("PASS", "POTENTIAL_NON_COMPLIANCE", "NEEDS_REVIEW")
    # Never a bare "FAIL" — spec section 6.
    assert all(r["status"] != "FAIL" for r in rules)


def test_protected_endpoint_rejects_unauthenticated_request_when_supabase_configured(client):
    def configured_settings() -> Settings:
        return Settings(
            supabase_url="https://example.supabase.co",
            supabase_jwt_secret="test-secret",
            allow_mock_auth=False,
        )

    app.dependency_overrides[get_settings] = configured_settings
    try:
        response = client.get("/api/v1/inspections")
        assert response.status_code == 401
    finally:
        del app.dependency_overrides[get_settings]


def test_health_requires_no_authentication(client):
    # Even with Supabase "configured", health must stay open.
    def configured_settings() -> Settings:
        return Settings(supabase_url="https://example.supabase.co", supabase_jwt_secret="x")

    app.dependency_overrides[get_settings] = configured_settings
    try:
        response = client.get("/api/v1/health")
        assert response.status_code == 200
    finally:
        del app.dependency_overrides[get_settings]


class _FixedConflictOCR(OCRService):
    """Deterministic stub: front-ish filenames read one MRP, others read
    another, so the conflict path is exercised reliably (unlike the
    hash-based MockOCRService, whose output for arbitrary filenames is
    not guaranteed to disagree).
    """

    async def process_image(self, image_bytes, *, mime_type, original_filename, view_type):
        text = "MRP ₹50" if "a" in original_filename else "MRP ₹55"
        return OCRResultData(raw_text=text, confidence=0.9)


async def test_extraction_conflict_returns_candidates_never_a_silent_winner(client, db, seeded_rules):
    """Two images disagreeing on MRP must surface CONFLICT + every
    candidate value with its source image — spec section 51.
    """
    create_response = client.post("/api/v1/inspections", json={"product_name": "Conflict Check"})
    inspection_id = create_response.json()["id"]

    settings = get_settings()
    storage = get_storage_service(settings)
    inspection = inspection_repository.get(db, uuid.UUID(inspection_id))
    assert inspection is not None

    upload_files = [
        UploadFile(filename="a.png", file=io.BytesIO(make_png_bytes())),
        UploadFile(filename="b.png", file=io.BytesIO(make_png_bytes())),
    ]
    for f in upload_files:
        f.headers = {"content-type": "image/png"}  # type: ignore[assignment]

    await upload_images(
        db,
        inspection=inspection,
        files=upload_files,
        view_types=["FRONT", "BACK"],
        storage=storage,
        user_id=inspection.inspector_id,
        settings=settings,
    )

    await run_processing(
        db,
        inspection=inspection,
        ocr_service=_FixedConflictOCR(),
        storage=storage,
        user_id=inspection.inspector_id,
    )

    fields = client.get(f"/api/v1/inspections/{inspection_id}/extracted").json()["fields"]
    mrp = next(f for f in fields if f["field_name"] == "MRP")
    assert mrp["validation_status"] == "CONFLICT"
    assert mrp["value"] is not None  # best-effort display value, never silently null
    assert mrp["candidates"] is not None
    values = {c["value"] for c in mrp["candidates"]}
    assert values == {"₹50", "₹55"}
    assert all(c["source_image_id"] for c in mrp["candidates"])
