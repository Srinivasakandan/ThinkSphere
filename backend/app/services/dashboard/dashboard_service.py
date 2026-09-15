"""Dashboard aggregate queries."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.enums import InspectionStage, InspectionStatus
from app.models.inspection import Inspection
from app.schemas.dashboard import DashboardSummaryResponse, DashboardTrendsResponse, TrendPoint
from app.services.inspection_service import to_summary

_EVALUATED_STAGES = (
    InspectionStage.RULE_EVALUATION_COMPLETED.value,
    InspectionStage.READY_FOR_REVIEW.value,
    InspectionStage.FINALIZED.value,
)


def get_summary(db: Session) -> DashboardSummaryResponse:
    stmt = (
        select(Inspection.overall_status, func.count())
        .where(Inspection.stage.in_(_EVALUATED_STAGES))
        .group_by(Inspection.overall_status)
    )
    counts: dict[str, int] = dict(db.execute(stmt).all())  # type: ignore[arg-type]

    return DashboardSummaryResponse(
        total=sum(counts.values()),
        passed=counts.get(InspectionStatus.PASS.value, 0),
        potential_non_compliance=counts.get(InspectionStatus.POTENTIAL_NON_COMPLIANCE.value, 0),
        needs_review=counts.get(InspectionStatus.NEEDS_REVIEW.value, 0),
    )


def get_trends(db: Session, *, days: int = 30) -> DashboardTrendsResponse:
    since = datetime.now(UTC) - timedelta(days=days)
    day_col = func.date(Inspection.created_at)
    stmt = (
        select(day_col.label("day"), func.count())
        .where(Inspection.stage.in_(_EVALUATED_STAGES), Inspection.created_at >= since)
        .group_by(day_col)
        .order_by(day_col)
    )
    rows = db.execute(stmt).all()
    return DashboardTrendsResponse(points=[TrendPoint(date=row[0], inspections=row[1]) for row in rows])


def get_recent(db: Session, *, limit: int = 6):
    stmt = (
        select(Inspection)
        .where(Inspection.stage.in_(_EVALUATED_STAGES))
        .options(joinedload(Inspection.product), joinedload(Inspection.inspector))
        .order_by(Inspection.created_at.desc())
        .limit(limit)
    )
    inspections = db.execute(stmt).unique().scalars().all()
    return [to_summary(i) for i in inspections]
