"""Report generation and rules repository browsing."""

from tests.conftest import make_png_bytes


def test_rules_repository_is_readable_and_marked_demo(client, seeded_rules):
    response = client.get("/api/v1/rules")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == len(seeded_rules)
    assert len(body["items"]) == len(seeded_rules)
    assert all(rule["is_demo"] is True for rule in body["items"])


def test_rules_repository_supports_pagination_and_search(client, seeded_rules):
    response = client.get("/api/v1/rules", params={"page": 1, "page_size": 1})
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    assert body["total"] == len(seeded_rules)

    search_response = client.get("/api/v1/rules", params={"search": "consumer"})
    assert search_response.status_code == 200
    search_body = search_response.json()
    assert search_body["total"] == 1
    assert search_body["items"][0]["rule_code"] == "TR004"


def test_get_single_rule(client, seeded_rules):
    rule_id = str(seeded_rules[0].id)
    response = client.get(f"/api/v1/rules/{rule_id}")
    assert response.status_code == 200
    assert response.json()["id"] == rule_id


def test_get_missing_rule_returns_404(client):
    response = client.get("/api/v1/rules/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RULE_NOT_FOUND"


def test_generate_report_for_inspection(client, seeded_rules):
    create_response = client.post("/api/v1/inspections", json={"product_name": "Report Test Product"})
    inspection_id = create_response.json()["id"]

    files = [("files", ("front.png", make_png_bytes(), "image/png"))]
    client.post(f"/api/v1/inspections/{inspection_id}/images", files=files, data={"view_types": ["FRONT"]})
    client.post(f"/api/v1/inspections/{inspection_id}/process")

    report_response = client.post(f"/api/v1/reports/inspections/{inspection_id}")
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
