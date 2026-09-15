"""Liveness check — no auth required."""

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health", summary="Health check")
def health_check(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    return {
        "status": "ok",
        "service": "legal-metrology-backend",
        "version": settings.api_version,
    }
