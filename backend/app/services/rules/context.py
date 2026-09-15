"""Types shared between the rule engine and its evaluators."""

import uuid
from dataclasses import dataclass

from app.models.enums import ValidationStatus


@dataclass
class FieldSnapshot:
    field_name: str
    value: str | None
    normalized_value: str | None
    confidence: float
    validation_status: ValidationStatus
    source_image_id: uuid.UUID | None
    manually_verified: bool


@dataclass
class RuleEvaluationInput:
    fields_by_name: dict[str, FieldSnapshot]
    # False when overall image/OCR quality for the inspection was poor —
    # steers "field missing" toward NEEDS_REVIEW instead of
    # POTENTIAL_NON_COMPLIANCE (spec section 52).
    extraction_reliable: bool


@dataclass
class RuleEvaluationOutcome:
    status: str  # InspectionStatus value
    reason: str
    detected_value: str | None
    confidence: float | None
    evidence_image_id: uuid.UUID | None
