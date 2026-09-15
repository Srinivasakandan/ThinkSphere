"""Auth behavior: mock mode by default, real bearer-token enforcement
when Supabase is configured (spec section 39)."""

from app.core.config import Settings, get_settings
from app.main import app


def test_mock_mode_allows_requests_without_a_token(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "demo.inspector@legalmetrology.gov.in"


def test_requires_bearer_token_when_supabase_configured(client):
    def configured_settings() -> Settings:
        return Settings(
            supabase_url="https://example.supabase.co",
            supabase_jwt_secret="test-secret",
            allow_mock_auth=False,
        )

    app.dependency_overrides[get_settings] = configured_settings
    try:
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"
    finally:
        del app.dependency_overrides[get_settings]


def test_rejects_invalid_bearer_token_when_supabase_configured(client):
    def configured_settings() -> Settings:
        return Settings(
            supabase_url="https://example.supabase.co",
            supabase_jwt_secret="test-secret",
            allow_mock_auth=False,
        )

    app.dependency_overrides[get_settings] = configured_settings
    try:
        response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "INVALID_TOKEN"
    finally:
        del app.dependency_overrides[get_settings]


def test_accepts_valid_signed_token_when_supabase_configured(client):
    from jose import jwt

    secret = "test-secret"

    def configured_settings() -> Settings:
        return Settings(
            supabase_url="https://example.supabase.co",
            supabase_jwt_secret=secret,
            allow_mock_auth=False,
        )

    token = jwt.encode(
        {
            "sub": "11111111-1111-1111-1111-111111111111",
            "email": "real.inspector@example.com",
            "aud": "authenticated",
        },
        secret,
        algorithm="HS256",
    )

    app.dependency_overrides[get_settings] = configured_settings
    try:
        response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert response.json()["email"] == "real.inspector@example.com"
    finally:
        del app.dependency_overrides[get_settings]
