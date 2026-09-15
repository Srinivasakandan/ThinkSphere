"""Liveness check — no auth required."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/api/health", summary="Health check")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
