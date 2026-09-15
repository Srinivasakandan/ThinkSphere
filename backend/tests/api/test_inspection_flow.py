"""End-to-end acceptance flow — mirrors spec section 69.

create -> upload 4 images (one product) -> process -> extracted fields
-> rules -> review -> finalize -> results -> dashboard reflects it.
"""

from tests.conftest import make_png_bytes


def _create_inspection(client) -> str:
    response = client.post(
        "/api/inspections",
        json={
            "product_name": "Marie Gold",
            "brand": "Britannia",
            "category": "Food",
            "batch_number": "BSC-22841",
            "inspection_location": "Andheri West, Mumbai",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["stage"] == "CREATED"
    return body["id"]


def _upload_four_images(client, inspection_id: str) -> list[dict]:
    files = [
        ("files", ("front.png", make_png_bytes((210, 180, 160)), "image/png")),
        ("files", ("back.png", make_png_bytes((160, 180, 210)), "image/png")),
        ("files", ("left.png", make_png_bytes((180, 210, 160)), "image/png")),
        ("files", ("right.png", make_png_bytes((200, 200, 200)), "image/png")),
    ]
    data = {"view_types": ["FRONT", "BACK", "LEFT", "RIGHT"]}
    response = client.post(f"/api/inspections/{inspection_id}/images", files=files, data=data)
    assert response.status_code == 200, response.text
    images = response.json()
    assert len(images) == 4
    assert {img["inspection_id"] for img in images} == {inspection_id}
    assert {img["view_type"] for img in images} == {"FRONT", "BACK", "LEFT", "RIGHT"}
    return images


def test_full_inspection_acceptance_flow(client, seeded_rules):
    # 1-3: create inspection, upload 4 images for ONE product.
    inspection_id = _create_inspection(client)
    _upload_four_images(client, inspection_id)

    # 4-13: start processing (OCR -> extraction -> validation -> structured fields).
    process_response = client.post(f"/api/inspections/{inspection_id}/process")
    assert process_response.status_code == 200, process_response.text
    processed = process_response.json()
    assert processed["stage"] in ("READY_FOR_REVIEW", "PROCESSING_FAILED")
    assert processed["stage"] != "PROCESSING_FAILED", processed.get("processing_error")

    status_response = client.get(f"/api/inspections/{inspection_id}/processing-status")
    assert status_response.status_code == 200
    assert status_response.json()["stage"] == "COMPLETED"
    assert status_response.json()["progress"] == 100

    # Extracted fields were stored with confidence + source image traceability.
    extracted = client.get(f"/api/inspections/{inspection_id}/extracted").json()["fields"]
    assert len(extracted) > 0
    for field in extracted:
        assert field["confidence_level"] in ("HIGH", "MEDIUM", "LOW")

    # 14-17: applicable demo rules were selected and evaluated.
    rules_response = client.get(f"/api/inspections/{inspection_id}/rules")
    assert rules_response.status_code == 200
    rule_results = rules_response.json()["rules"]
    assert {r["rule_code"] for r in rule_results} == {rule.rule_code for rule in seeded_rules}
    for result in rule_results:
        assert result["status"] in ("PASS", "POTENTIAL_NON_COMPLIANCE", "NEEDS_REVIEW")

    # 18: overall status is visible via the results endpoint too.
    results = client.get(f"/api/inspections/{inspection_id}/results").json()
    assert results["overall_status"] in ("PASS", "POTENTIAL_NON_COMPLIANCE", "NEEDS_REVIEW")
    assert results["summary"]["total"] == len(rule_results)

    # 19-23: inspector opens an uncertain finding, views the source image,
    # edits/verifies the underlying field, adds a note.
    non_passing = [r for r in rule_results if r["status"] != "PASS"]
    if non_passing:
        target = non_passing[0]
        review_response = client.patch(
            f"/api/inspections/{inspection_id}/rules/{target['id']}/review",
            json={"reviewed": True, "inspector_note": "Verified against source image."},
        )
        assert review_response.status_code == 200
        assert review_response.json()["reviewed"] is True

        remaining = [
            r
            for r in client.get(f"/api/inspections/{inspection_id}/rules").json()["rules"]
            if r["status"] != "PASS" and not r["reviewed"]
        ]
        for extra in remaining:
            client.patch(
                f"/api/inspections/{inspection_id}/rules/{extra['id']}/review",
                json={"reviewed": True, "inspector_note": "Reviewed."},
            )

    # 24-26: finalize; the backend must record inspector, timestamp, final status.
    finalize_response = client.post(f"/api/inspections/{inspection_id}/finalize", json={})
    assert finalize_response.status_code == 200, finalize_response.text
    finalize_body = finalize_response.json()
    assert finalize_body["can_finalize"] is True
    assert finalize_body["inspection"]["stage"] == "FINALIZED"

    # 27: frontend (or any client) can retrieve the finalized inspection.
    detail = client.get(f"/api/inspections/{inspection_id}").json()
    assert detail["stage"] == "FINALIZED"
    assert detail["finalized_at"] is not None
    assert len(detail["images"]) == 4

    # 28: dashboard counts reflect the finalized inspection.
    summary = client.get("/api/dashboard/summary").json()
    assert summary["total"] >= 1
    assert (summary["passed"] + summary["potential_non_compliance"] + summary["needs_review"]) == summary[
        "total"
    ]

    recent = client.get("/api/dashboard/recent-inspections").json()["items"]
    assert any(item["id"] == inspection_id for item in recent)


def test_finalize_is_blocked_while_findings_are_unreviewed(client, seeded_rules):
    inspection_id = _create_inspection(client)
    _upload_four_images(client, inspection_id)
    client.post(f"/api/inspections/{inspection_id}/process")

    rule_results = client.get(f"/api/inspections/{inspection_id}/rules").json()["rules"]
    has_unreviewed_finding = any(r["status"] != "PASS" for r in rule_results)

    finalize_response = client.post(f"/api/inspections/{inspection_id}/finalize", json={})
    body = finalize_response.json()
    if has_unreviewed_finding:
        assert body["can_finalize"] is False
        assert "review" in body["reason"].lower()
    else:
        assert body["can_finalize"] is True


def test_cannot_process_inspection_with_no_images(client, seeded_rules):
    inspection_id = _create_inspection(client)
    response = client.post(f"/api/inspections/{inspection_id}/process")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "NO_IMAGES"


def test_get_nonexistent_inspection_returns_404(client):
    response = client.get("/api/inspections/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "INSPECTION_NOT_FOUND"


def test_field_correction_marks_manually_verified(client, seeded_rules):
    inspection_id = _create_inspection(client)
    _upload_four_images(client, inspection_id)
    client.post(f"/api/inspections/{inspection_id}/process")

    fields = client.get(f"/api/inspections/{inspection_id}/extracted").json()["fields"]
    assert fields, "expected at least one extracted field from mock OCR"
    field = fields[0]

    response = client.patch(
        f"/api/inspections/{inspection_id}/fields/{field['id']}",
        json={
            "value": "Manually corrected value",
            "manually_verified": True,
            "note": "Confirmed from image.",
        },
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["value"] == "Manually corrected value"
    assert updated["manually_verified"] is True
    assert updated["manually_edited"] is True
    assert updated["validation_status"] == "VALID"
