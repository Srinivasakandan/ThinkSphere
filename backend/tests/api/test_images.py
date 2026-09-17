"""Image upload validation and deletion — spec section 42."""

from tests.conftest import make_png_bytes


def _create_inspection(client) -> str:
    response = client.post("/api/v1/inspections", json={"product_name": "Test Product"})
    return response.json()["id"]


def test_rejects_non_image_file(client):
    inspection_id = _create_inspection(client)
    files = [("files", ("not-an-image.txt", b"hello world", "text/plain"))]
    response = client.post(f"/api/v1/inspections/{inspection_id}/images", files=files)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_IMAGE"


def test_rejects_file_with_image_mimetype_but_bad_bytes(client):
    """Never trust the declared MIME type / extension alone."""
    inspection_id = _create_inspection(client)
    files = [("files", ("fake.jpg", b"not actually a jpeg", "image/jpeg"))]
    response = client.post(f"/api/v1/inspections/{inspection_id}/images", files=files)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_IMAGE"


def test_upload_and_delete_image(client):
    inspection_id = _create_inspection(client)
    files = [("files", ("front.png", make_png_bytes(), "image/png"))]
    upload_response = client.post(
        f"/api/v1/inspections/{inspection_id}/images", files=files, data={"view_types": ["FRONT"]}
    )
    assert upload_response.status_code == 200
    image_id = upload_response.json()[0]["id"]

    delete_response = client.delete(f"/api/v1/inspections/{inspection_id}/images/{image_id}")
    assert delete_response.status_code == 204

    detail = client.get(f"/api/v1/inspections/{inspection_id}").json()
    assert all(img["id"] != image_id for img in detail["images"])


def test_blurry_image_flagged_poor_quality_immediately_at_upload(client):
    """make_png_bytes is a flat solid-color image — no edges at all, the
    blur check's worst case — so uploading it should surface POOR quality
    and a manual-inspection-style note right away, before OCR/processing
    ever runs (spec: blur/quality checked at upload time)."""
    inspection_id = _create_inspection(client)
    files = [("files", ("front.png", make_png_bytes(), "image/png"))]
    upload_response = client.post(
        f"/api/v1/inspections/{inspection_id}/images", files=files, data={"view_types": ["FRONT"]}
    )
    assert upload_response.status_code == 200
    image = upload_response.json()[0]
    assert image["image_quality"] == "POOR"
    assert image["quality_note"]
    assert "manual inspection" in image["quality_note"].lower()


def test_delete_nonexistent_image_returns_404(client):
    inspection_id = _create_inspection(client)
    response = client.delete(
        f"/api/v1/inspections/{inspection_id}/images/00000000-0000-0000-0000-000000000099"
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "IMAGE_NOT_FOUND"
