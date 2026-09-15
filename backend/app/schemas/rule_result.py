"""Rule evaluation result schemas."""

import uuid
from datetime import datetime

from app.models.enums import InspectionStatus
from app.schemas.common import ORMModel


class RuleResultResponse(ORMModel):
    id: uuid.UUID
    inspection_id: uuid.UUID
    rule_id: uuid.UUID
    rule_code: str
    requirement: str
    field_name: str
    detected_value: str | None
    status: InspectionStatus
    reason: str
    confidence: float | None
    evidence_image_id: uuid.UUID | None
    reviewed: bool
    reviewer_id: uuid.UUID | None
    reviewed_at: datetime | None
    inspector_note: str | None


class RuleResultsResponse(ORMModel):
    rules: list[RuleResultResponse]


class RuleSummary(ORMModel):
    rule_code: str
    title: str
    description: str
    legal_source: str


class RuleResultDetailResponse(ORMModel):
    rule_result_id: uuid.UUID
    rule: RuleSummary
    field_name: str
    detected_value: str | None
    status: InspectionStatus
    reason: str
    confidence: float | None
    evidence_image_id: uuid.UUID | None
    reviewed: bool
    reviewer_id: uuid.UUID | None
    reviewed_at: datetime | None
    inspector_note: str | None
