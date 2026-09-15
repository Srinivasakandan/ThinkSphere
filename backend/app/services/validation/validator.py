"""Validation: structured extraction results -> Valid / Invalid / Conflict / Uncertain.

Validation never converts an uncertain read into a confirmed problem.
An ambiguous OCR result (e.g. a date that might say "06/2026" or could
be a misread) is UNCERTAIN, never INVALID and never silently
"corrected"; disagreement between images is CONFLICT, never a silently
picked winner — see spec sections 19, 51-53.
"""

import re
from dataclasses import dataclass

from app.models.enums import ValidationStatus
from app.services.extraction.candidate import ExtractionResult
from app.services.extraction.fields import (
    BATCH_NUMBER,
    CONSUMER_CARE,
    MRP,
    NET_QUANTITY,
)

LOW_CONFIDENCE_THRESHOLD = 0.5

_MRP_PATTERN = re.compile(r"^₹\d+(\.\d{1,2})?$")
_QUANTITY_PATTERN = re.compile(r"^\d+(\.\d+)?\s+[a-zA-Z]+$")
_PHONE_PATTERN = re.compile(r"^1800[-\s]?\d{3,4}(?:[-\s]?\d{3,4})?$")
_BATCH_PATTERN = re.compile(r"^[A-Za-z0-9\-]{3,20}$")


@dataclass
class ValidationOutcome:
    status: ValidationStatus
    reason: str | None


def _format_check(field_name: str, value: str) -> ValidationOutcome:
    if field_name == MRP:
        if not _MRP_PATTERN.match(value):
            return ValidationOutcome(
                ValidationStatus.INVALID, "Detected value is not a recognizable currency amount."
            )
        if float(value.replace("₹", "")) <= 0:
            return ValidationOutcome(ValidationStatus.INVALID, "MRP must be a positive amount.")
    elif field_name == NET_QUANTITY:
        if not _QUANTITY_PATTERN.match(value):
            return ValidationOutcome(
                ValidationStatus.INVALID, "Detected value is not a recognizable quantity."
            )
        amount = float(value.split()[0])
        if amount <= 0:
            return ValidationOutcome(ValidationStatus.INVALID, "Net quantity must be a positive amount.")
    elif field_name == CONSUMER_CARE:
        if not _PHONE_PATTERN.match(value):
            return ValidationOutcome(
                ValidationStatus.UNCERTAIN,
                "Detected value does not match a standard consumer care number format.",
            )
    elif field_name == BATCH_NUMBER:
        if not _BATCH_PATTERN.match(value):
            return ValidationOutcome(
                ValidationStatus.UNCERTAIN,
                "Detected value does not match a standard batch/lot number format.",
            )

    return ValidationOutcome(ValidationStatus.VALID, None)


def validate(result: ExtractionResult) -> ValidationOutcome:
    if result.has_conflict:
        candidates = ", ".join(result.conflict_values)
        return ValidationOutcome(
            ValidationStatus.CONFLICT,
            f"Different values were detected for {result.field_name} across product images: {candidates}.",
        )

    if not result.value:
        return ValidationOutcome(ValidationStatus.UNCERTAIN, "No reliable value could be extracted.")

    if result.confidence < LOW_CONFIDENCE_THRESHOLD:
        return ValidationOutcome(
            ValidationStatus.UNCERTAIN,
            "Extraction confidence is low. Please verify this value against the original image.",
        )

    return _format_check(result.field_name, result.value)
