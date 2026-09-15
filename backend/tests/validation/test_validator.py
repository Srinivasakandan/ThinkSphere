"""Validation tests — spec sections 19, 52, 53."""

import uuid

from app.models.enums import ValidationStatus
from app.services.extraction.candidate import ExtractionResult
from app.services.validation.validator import validate


def make_result(
    field_name, value, confidence=0.9, has_conflict=False, conflict_values=None
) -> ExtractionResult:
    return ExtractionResult(
        field_name=field_name,
        value=value,
        normalized_value=value,
        confidence=confidence,
        source_image_id=uuid.uuid4() if value else None,
        source_text=value,
        has_conflict=has_conflict,
        conflict_values=conflict_values or [],
    )


def test_valid_mrp_passes():
    outcome = validate(make_result("MRP", "₹50"))
    assert outcome.status == ValidationStatus.VALID


def test_valid_quantity_passes():
    outcome = validate(make_result("NET_QUANTITY", "250 g"))
    assert outcome.status == ValidationStatus.VALID


def test_low_confidence_is_needs_review_not_invalid():
    """A weak signal is uncertain, not wrong — never silently escalated
    to INVALID/violation territory."""
    outcome = validate(make_result("MRP", "₹50", confidence=0.2))
    assert outcome.status == ValidationStatus.NEEDS_REVIEW


def test_conflict_is_needs_review_with_reason_listing_candidates():
    outcome = validate(make_result("MRP", "₹50", has_conflict=True, conflict_values=["₹50", "₹55"]))
    assert outcome.status == ValidationStatus.NEEDS_REVIEW
    assert "₹50" in outcome.reason
    assert "₹55" in outcome.reason


def test_missing_value_is_needs_review():
    outcome = validate(make_result("MRP", None))
    assert outcome.status == ValidationStatus.NEEDS_REVIEW


def test_negative_mrp_is_invalid():
    outcome = validate(make_result("MRP", "₹-5"))
    assert outcome.status == ValidationStatus.INVALID


def test_malformed_phone_is_needs_review():
    outcome = validate(make_result("CONSUMER_CARE", "12345"))
    assert outcome.status == ValidationStatus.NEEDS_REVIEW
