"""Report generation and rules repository browsing."""

from tests.conftest import make_png_bytes


def test_rules_repository_is_readable_and_marked_demo(client, seeded_rules):
    response = client.get("/api/rules")
    assert response.status_code == 200
    rules = response.json()
    assert len(rules) == len(seeded_rules)
    assert all(rule["is_demo"] is True for rule in rules)


def test_generate_report_for_inspection(client, seeded_rules):
    create_response = client.post("/api/inspections", json={"product_name": "Report Test Product"})
    inspection_id = create_response.json()["id"]

    files = [("files", ("front.png", make_png_bytes(), "image/png"))]
    client.post(f"/api/inspections/{inspection_id}/images", files=files, data={"view_types": ["FRONT"]})
    client.post(f"/api/inspections/{inspection_id}/process")

    report_response = client.post(f"/api/reports/inspection/{inspection_id}")
    assert report_response.status_code == 200, report_response.text
    body = report_response.json()
    assert body["inspection_id"] == inspection_id
    assert body["file_path"].endswith(".pdf")
    assert body["url"] is not None

    # The report was actually written and is retrievable via the media mount.
    media_response = client.get(body["url"])
    assert media_response.status_code == 200
    assert media_response.headers["content-type"] == "application/pdf"
    assert media_response.content[:4] == b"%PDF"
