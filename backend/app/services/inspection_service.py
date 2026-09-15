"""Inspection lifecycle orchestration and response assembly.

Response schemas are built here (not inline in routes) so every route
that returns an inspection produces an identical shape.
"""

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.enums import AuditAction, InspectionStage
from app.models.inspection import Inspection
from app.repositories import inspection_repository, product_repository
from app.schemas.image import ImageResponse
from app.schemas.inspection import (
    FinalizeInspectionResponse,
    InspectionCreate,
    InspectionDetail,
    InspectionResultsResponse,
    InspectionSummary,
    InspectorResponse,
    ResultsSummary,
)
from app.schemas.product import ProductResponse
from app.schemas.rule_result import RuleResultResponse
from app.services.rules.status import calculate_overall_status
from app.services.storage import StorageService, get_storage_service


def create_inspection(db: Session, *, inspector_id: uuid.UUID, data: InspectionCreate) -> Inspection:
    inspection = inspection_repository.create(db, inspector_id=inspector_id)
    product_repository.upsert(
        db,
        inspection_id=inspection.id,
        data={
            "product_name": data.product_name,
            "brand": data.brand,
            "category": data.category,
            "batch_number": data.batch_number,
        },
    )
    inspection.inspection_location = data.inspection_location
    inspection.notes = data.notes

    inspection_repository.add_audit_log(
        db,
        inspection_id=inspection.id,
        user_id=inspector_id,
        action=AuditAction.INSPECTION_CREATED.value,
    )
    db.commit()
    db.refresh(inspection)
    return inspection


def get_inspection_or_404(db: Session, inspection_id: uuid.UUID) -> Inspection:
    inspection = inspection_repository.get(db, inspection_id)
    if inspection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "INSPECTION_NOT_FOUND",
                    "message": "Inspection could not be found.",
                }
            },
        )
    return inspection


def to_image_response(image, storage: StorageService) -> ImageResponse:
    return ImageResponse(
        id=image.id,
        inspection_id=image.inspection_id,
        view_type=image.view_type,
        original_filename=image.original_filename,
        mime_type=image.mime_type,
        file_size=image.file_size,
        image_quality=image.image_quality,
        quality_note=image.quality_note,
        processing_status=image.processing_status,
        url=storage.get_file_url(path=image.storage_path),
        created_at=image.created_at,
    )


def to_rule_result_response(rule_result) -> RuleResultResponse:
    return RuleResultResponse(
        id=rule_result.id,
        inspection_id=rule_result.inspection_id,
        rule_id=rule_result.rule_id,
        rule_code=rule_result.rule.rule_code,
        requirement=rule_result.rule.title,
        field_name=rule_result.field_name,
        detected_value=rule_result.detected_value,
        status=rule_result.status,
        reason=rule_result.reason,
        confidence=rule_result.confidence,
        evidence_image_id=rule_result.evidence_image_id,
        reviewed=rule_result.reviewed,
        reviewer_id=rule_result.reviewer_id,
        reviewed_at=rule_result.reviewed_at,
        inspector_note=rule_result.inspector_note,
    )


def to_detail(inspection: Inspection, storage: StorageService) -> InspectionDetail:
    return InspectionDetail(
        id=inspection.id,
        stage=inspection.stage,
        overall_status=inspection.overall_status,
        inspector=InspectorResponse.model_validate(inspection.inspector),
        product=ProductResponse.model_validate(inspection.product) if inspection.product else None,
        images=[to_image_response(img, storage) for img in inspection.images],
        extracted_fields=list(inspection.extracted_fields),
        rule_results=[to_rule_result_response(r) for r in inspection.rule_results],
        inspection_location=inspection.inspection_location,
        notes=inspection.notes,
        processing_error=inspection.processing_error,
        created_at=inspection.created_at,
        updated_at=inspection.updated_at,
        finalized_at=inspection.finalized_at,
    )


def to_summary(inspection: Inspection) -> InspectionSummary:
    return InspectionSummary(
        id=inspection.id,
        product_name=inspection.product.product_name if inspection.product else None,
        category=inspection.product.category if inspection.product else None,
        stage=inspection.stage,
        overall_status=inspection.overall_status,
        inspector_name=inspection.inspector.full_name,
        created_at=inspection.created_at,
    )


def to_results(inspection: Inspection) -> InspectionResultsResponse:
    rule_results = [to_rule_result_response(r) for r in inspection.rule_results]
    total = len(rule_results)
    passed = sum(1 for r in rule_results if r.status == "PASS")
    non_compliant = sum(1 for r in rule_results if r.status == "POTENTIAL_NON_COMPLIANCE")
    needs_review = sum(1 for r in rule_results if r.status == "NEEDS_REVIEW")

    return InspectionResultsResponse(
        inspection_id=inspection.id,
        product=ProductResponse.model_validate(inspection.product) if inspection.product else None,
        overall_status=inspection.overall_status,
        summary=ResultsSummary(
            total=total,
            passed=passed,
            potential_non_compliance=non_compliant,
            needs_review=needs_review,
        ),
        rules=rule_results,
    )


def finalize_inspection(
    db: Session,
    *,
    inspection: Inspection,
    inspector_id: uuid.UUID,
    final_notes: str | None,
    settings: Settings,
) -> FinalizeInspectionResponse:
    if inspection.stage == InspectionStage.FINALIZED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "ALREADY_FINALIZED",
                    "message": "This inspection has already been finalized.",
                }
            },
        )
    if inspection.stage not in (
        InspectionStage.RULE_EVALUATION_COMPLETED.value,
        InspectionStage.READY_FOR_REVIEW.value,
    ):
        return FinalizeInspectionResponse(
            can_finalize=False,
            reason="This inspection has not completed processing yet.",
        )

    unresolved = [r for r in inspection.rule_results if r.status != "PASS" and not r.reviewed]
    if unresolved:
        return FinalizeInspectionResponse(
            can_finalize=False,
            reason=f"{len(unresolved)} item(s) require review before this inspection can be finalized.",
        )

    inspection.overall_status = calculate_overall_status([r.status for r in inspection.rule_results])
    inspection.stage = InspectionStage.FINALIZED.value
    inspection.finalized_at = datetime.now(UTC)
    if final_notes:
        inspection.notes = final_notes

    inspection_repository.add_audit_log(
        db,
        inspection_id=inspection.id,
        user_id=inspector_id,
        action=AuditAction.INSPECTION_FINALIZED.value,
        metadata={"overall_status": inspection.overall_status},
    )
    db.commit()
    db.refresh(inspection)

    storage = get_storage_service(settings)
    return FinalizeInspectionResponse(can_finalize=True, inspection=to_detail(inspection, storage))
