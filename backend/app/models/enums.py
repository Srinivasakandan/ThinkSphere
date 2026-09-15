"""Shared enumerations for the inspection domain.

Field names (MRP, NET_QUANTITY, ...) are intentionally NOT an enum — the
extraction system must remain extensible without a migration for every
new declaration type. They are validated loosely at the service layer
against `app.services.extraction.fields.KNOWN_FIELDS`, which is a
reference list, not a hard constraint.
"""

from enum import StrEnum


class UserRole(StrEnum):
    INSPECTOR = "INSPECTOR"
    SUPERVISOR = "SUPERVISOR"
    ADMIN = "ADMIN"


class InspectionStage(StrEnum):
    """Workflow/processing state — distinct from compliance status."""

    CREATED = "CREATED"
    IMAGES_UPLOADED = "IMAGES_UPLOADED"
    PROCESSING = "PROCESSING"
    OCR_COMPLETED = "OCR_COMPLETED"
    EXTRACTION_COMPLETED = "EXTRACTION_COMPLETED"
    VALIDATION_COMPLETED = "VALIDATION_COMPLETED"
    RULE_EVALUATION_COMPLETED = "RULE_EVALUATION_COMPLETED"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    FINALIZED = "FINALIZED"
    PROCESSING_FAILED = "PROCESSING_FAILED"


class InspectionStatus(StrEnum):
    """Compliance status — never a legal determination on its own."""

    PASS = "PASS"
    POTENTIAL_NON_COMPLIANCE = "POTENTIAL_NON_COMPLIANCE"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class ImageViewType(StrEnum):
    FRONT = "FRONT"
    BACK = "BACK"
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    TOP = "TOP"
    BOTTOM = "BOTTOM"
    OTHER = "OTHER"


class ImageProcessingStatus(StrEnum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"


class ImageQuality(StrEnum):
    GOOD = "GOOD"
    FAIR = "FAIR"
    POOR = "POOR"
    UNKNOWN = "UNKNOWN"


class ConfidenceLevel(StrEnum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ValidationStatus(StrEnum):
    VALID = "VALID"
    INVALID = "INVALID"
    # Multiple images disagree on this field's value — never silently
    # resolved to a winner (spec: extraction conflicts).
    CONFLICT = "CONFLICT"
    # A value was detected but confidence is too low to trust as-is, or
    # nothing reliable was detected at all (spec: low OCR quality).
    UNCERTAIN = "UNCERTAIN"
    NOT_VALIDATED = "NOT_VALIDATED"


class RuleConditionType(StrEnum):
    REQUIRED = "REQUIRED"
    OPTIONAL = "OPTIONAL"
    FORMAT = "FORMAT"
    VALUE = "VALUE"
    UNIT = "UNIT"
    DATE = "DATE"
    RANGE = "RANGE"
    CONDITIONAL = "CONDITIONAL"
    MANUAL_REVIEW = "MANUAL_REVIEW"


class ReviewTargetType(StrEnum):
    EXTRACTED_FIELD = "EXTRACTED_FIELD"
    RULE_RESULT = "RULE_RESULT"


class ReviewDecision(StrEnum):
    CONFIRMED = "CONFIRMED"
    CORRECTED = "CORRECTED"
    VERIFIED = "VERIFIED"


class AuditAction(StrEnum):
    INSPECTION_CREATED = "INSPECTION_CREATED"
    IMAGE_UPLOADED = "IMAGE_UPLOADED"
    IMAGE_DELETED = "IMAGE_DELETED"
    OCR_COMPLETED = "OCR_COMPLETED"
    EXTRACTION_COMPLETED = "EXTRACTION_COMPLETED"
    RULES_EVALUATED = "RULES_EVALUATED"
    FIELD_EDITED = "FIELD_EDITED"
    FIELD_VERIFIED = "FIELD_VERIFIED"
    RULE_REVIEWED = "RULE_REVIEWED"
    INSPECTION_FINALIZED = "INSPECTION_FINALIZED"
    PROCESSING_FAILED = "PROCESSING_FAILED"
