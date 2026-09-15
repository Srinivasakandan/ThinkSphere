"""Inspector review workflow: editing/verifying extracted fields and
reviewing rule findings. Every action here is attributed to the
authenticated inspector and recorded twice — once as the current state
(on the field/result row) and once as an immutable history entry
(InspectorReview) — plus a system-wide audit log entry.
"""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.enums import AuditAction, ReviewDecision, ReviewTargetType, ValidationStatus
from app.models.extracted_field import ExtractedField
from app.models.inspection import Inspection
from app.models.review import InspectorReview
from app.models.rule_result import RuleResult
from app.repositories import inspection_repository, result_repository
from app.schemas.extraction import ExtractedFieldUpdateRequest
from app.schemas.review import RuleReviewRequest
from app.services.rules.status import calculate_overall_status


def _record_review(
    db: Session,
    *,
    inspection_id: uuid.UUID,
    reviewer_id: uuid.UUID,
    target_type: str,
    target_id: uuid.UUID,
    decision: str,
    note: str | None,
    previous_value: str | None,
    new_value: str | None,
) -> None:
    db.add(
        InspectorReview(
            inspection_id=inspection_id,
            reviewer_id=reviewer_id,
            target_type=target_type,
            target_id=target_id,
            decision=decision,
            note=note,
            previous_value=previous_value,
            new_value=new_value,
        )
    )


def update_extracted_field(
    db: Session,
    *,
    inspection: Inspection,
    field_id: uuid.UUID,
    data: ExtractedFieldUpdateRequest,
    reviewer_id: uuid.UUID,
) -> ExtractedField:
    field = inspection_repository.get_extracted_field(db, field_id)
    if field is None or field.inspection_id != inspection.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "FIELD_NOT_FOUND",
                    "message": "Extracted field could not be found on this inspection.",
                }
            },
        )

    previous_value = field.value
    value_changed = data.value is not None and data.value != previous_value

    if data.value is not None:
        field.value = data.value
        field.normalized_value = data.value
        field.manually_edited = True
    field.manually_verified = data.manually_verified
    field.validation_status = ValidationStatus.VALID.value
    field.validation_reason = None
    field.confidence = 1.0
    field.candidates = None

    _record_review(
        db,
        inspection_id=inspection.id,
        reviewer_id=reviewer_id,
        target_type=ReviewTargetType.EXTRACTED_FIELD.value,
        target_id=field.id,
        decision=(ReviewDecision.CORRECTED.value if value_changed else ReviewDecision.VERIFIED.value),
        note=data.note,
        previous_value=previous_value,
        new_value=field.value,
    )

    inspection_repository.add_audit_log(
        db,
        inspection_id=inspection.id,
        user_id=reviewer_id,
        action=(AuditAction.FIELD_EDITED.value if value_changed else AuditAction.FIELD_VERIFIED.value),
        entity_type="ExtractedField",
        entity_id=field.id,
        metadata={"field_name": field.field_name},
    )

    db.commit()
    db.refresh(field)
    return field


def review_rule_result(
    db: Session,
    *,
    inspection: Inspection,
    rule_result_id: uuid.UUID,
    data: RuleReviewRequest,
    reviewer_id: uuid.UUID,
) -> RuleResult:
    rule_result = result_repository.get(db, rule_result_id)
    if rule_result is None or rule_result.inspection_id != inspection.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RULE_RESULT_NOT_FOUND",
                    "message": "Rule result could not be found on this inspection.",
                }
            },
        )

    previous_status = rule_result.status
    now = datetime.now(UTC)

    if data.corrected_value is not None:
        decision = ReviewDecision.CORRECTED.value
        rule_result.detected_value = data.corrected_value
        rule_result.status = "PASS"
        rule_result.reason = "Value corrected and verified by inspector."

        matching_field = next(
            (f for f in inspection.extracted_fields if f.field_name == rule_result.field_name), None
        )
        if matching_field is not None:
            matching_field.value = data.corrected_value
            matching_field.normalized_value = data.corrected_value
            matching_field.manually_edited = True
            matching_field.manually_verified = True
            matching_field.validation_status = ValidationStatus.VALID.value
            matching_field.confidence = 1.0
    else:
        decision = ReviewDecision.CONFIRMED.value
        if data.reviewed and previous_status == "NEEDS_REVIEW":
            # NEEDS_REVIEW exists precisely to gate on inspector sign-off —
            # confirming it (with no correction needed) resolves it to PASS.
            rule_result.status = "PASS"
            rule_result.reason = "Reviewed and confirmed correct by the inspector."
        # A confirmed POTENTIAL_NON_COMPLIANCE finding is not "fixed" by
        # confirmation alone — it stays flagged, now with human sign-off
        # recorded via `reviewed`/`inspector_note`. Never silently promote
        # it to PASS or relabel it a "confirmed violation" (spec section 26).

    rule_result.reviewed = data.reviewed
    rule_result.reviewer_id = reviewer_id
    rule_result.reviewed_at = now
    rule_result.inspector_note = data.inspector_note

    _record_review(
        db,
        inspection_id=inspection.id,
        reviewer_id=reviewer_id,
        target_type=ReviewTargetType.RULE_RESULT.value,
        target_id=rule_result.id,
        decision=decision,
        note=data.inspector_note,
        previous_value=previous_status,
        new_value=rule_result.status,
    )

    inspection_repository.add_audit_log(
        db,
        inspection_id=inspection.id,
        user_id=reviewer_id,
        action=AuditAction.RULE_REVIEWED.value,
        entity_type="RuleResult",
        entity_id=rule_result.id,
        metadata={"rule_id": str(rule_result.rule_id), "decision": decision},
    )

    inspection.overall_status = calculate_overall_status([r.status for r in inspection.rule_results])

    db.commit()
    db.refresh(rule_result)
    return rule_result
