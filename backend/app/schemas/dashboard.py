"""Dashboard summary/trend schemas."""

from datetime import date

from pydantic import BaseModel

from app.schemas.inspection import InspectionSummary


class DashboardSummaryResponse(BaseModel):
    total: int
    passed: int
    potential_non_compliance: int
    needs_review: int


class TrendPoint(BaseModel):
    date: date
    inspections: int


class DashboardTrendsResponse(BaseModel):
    points: list[TrendPoint]


class RecentInspectionsResponse(BaseModel):
    items: list[InspectionSummary]
