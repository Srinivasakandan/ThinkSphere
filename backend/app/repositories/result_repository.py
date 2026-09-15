"""Data access for RuleResult rows (the rule engine's output)."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.rule_result import RuleResult


def replace_for_inspection(
    db: Session, *, inspection_id: uuid.UUID, results: list[dict[str, Any]]
) -> list[RuleResult]:
    """Idempotent: re-running rule evaluation replaces prior results rather
    than accumulating duplicates (see spec section 48, idempotency).
    """

    existing = db.execute(select(RuleResult).where(RuleResult.inspection_id == inspection_id)).scalars().all()
    for row in existing:
        db.delete(row)
    db.flush()

    created = []
    for result_data in results:
        result = RuleResult(inspection_id=inspection_id, **result_data)
        db.add(result)
        created.append(result)
    db.flush()
    return created


def list_for_inspection(db: Session, inspection_id: uuid.UUID) -> list[RuleResult]:
    stmt = (
        select(RuleResult)
        .where(RuleResult.inspection_id == inspection_id)
        .options(joinedload(RuleResult.rule))
        .order_by(RuleResult.created_at)
    )
    return list(db.execute(stmt).scalars().all())


def get(db: Session, rule_result_id: uuid.UUID) -> RuleResult | None:
    stmt = select(RuleResult).where(RuleResult.id == rule_result_id).options(joinedload(RuleResult.rule))
    return db.execute(stmt).scalar_one_or_none()


def mark_reviewed(
    db: Session,
    *,
    rule_result: RuleResult,
    reviewer_id: uuid.UUID,
    inspector_note: str | None,
    reviewed_at: datetime,
) -> RuleResult:
    rule_result.reviewed = True
    rule_result.reviewer_id = reviewer_id
    rule_result.inspector_note = inspector_note
    rule_result.reviewed_at = reviewed_at
    db.flush()
    return rule_result
