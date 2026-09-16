"""Application configuration.

All configuration is sourced from environment variables (see .env.example).
The application must start and run in "mock mode" when Supabase/OCR
credentials are absent, so local and frontend development are never
blocked on external services.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_env: str = "development"
    api_title: str = "ThinkSphere Legal Metrology Inspection API"
    api_version: str = "1.0.0"

    database_url: str = "postgresql+psycopg://thinksphere:thinksphere@localhost:5432/thinksphere"

    frontend_url: str = "http://localhost:3000"

    # Supabase Auth / Storage. Left blank => mock mode.
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_storage_bucket: str = "inspection-images"

    # OCR provider selection: "auto" (default) uses real Tesseract OCR
    # when the tesseract-ocr binary is installed and transparently falls
    # back to deterministic mock text otherwise, so the same deployment
    # works in a demo sandbox and in production. Force "tesseract" or
    # "mock" to pin one explicitly.
    ocr_provider: str = "auto"

    # Local filesystem fallback for storage when Supabase is not configured.
    local_storage_dir: str = "./storage_mock"

    # This API's own publicly-reachable base URL (e.g.
    # https://api.example.com or http://localhost:8000). Required
    # whenever the frontend runs on a different origin than this API —
    # without it, local-storage image/report URLs are returned as a bare
    # "/media/..." path, which resolves against the *frontend's* origin
    # in the browser and 404s. Leave blank only when frontend and API
    # share an origin (e.g. reverse-proxied under one host).
    backend_public_url: str = ""

    # Auth: when true, unauthenticated requests are treated as a demo
    # inspector. Only ever enabled outside production.
    allow_mock_auth: bool = True

    max_image_size_mb: int = 10
    max_images_per_inspection: int = 10

    @property
    def is_supabase_configured(self) -> bool:
        return bool(self.supabase_url and (self.supabase_jwt_secret or self.supabase_anon_key))

    @property
    def is_production(self) -> bool:
        return self.api_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
