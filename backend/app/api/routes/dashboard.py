"""Dashboard summary/trend/recent-inspection endpoints."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_inspector, get_db
from app.models.user import Inspector
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    DashboardTrendsResponse,
    RecentInspectionsResponse,
)
from app.services.dashboard import dashboard_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse, summary="Dashboard summary counts")
def get_summary(
    db=Depends(get_db), _: Inspector = Depends(get_current_inspector)
) -> DashboardSummaryResponse:
    return dashboard_service.get_summary(db)


@router.get("/trends", response_model=DashboardTrendsResponse, summary="Inspection counts over time")
def get_trends(
    db=Depends(get_db), _: Inspector = Depends(get_current_inspector), days: int = 30
) -> DashboardTrendsResponse:
    return dashboard_service.get_trends(db, days=days)


@router.get(
    "/recent-inspections",
    response_model=RecentInspectionsResponse,
    summary="Most recent inspections",
)
def get_recent_inspections(
    db=Depends(get_db), _: Inspector = Depends(get_current_inspector), limit: int = 6
) -> RecentInspectionsResponse:
    return RecentInspectionsResponse(items=dashboard_service.get_recent(db, limit=limit))
