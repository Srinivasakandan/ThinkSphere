"""Processing orchestration: OCR -> extraction -> validation -> rule
selection -> rule engine -> overall status.

Each phase updates `inspection.stage` and commits, so the state machine
in app.models.enums.InspectionStage is always an honest reflection of
progress — this is what lets `run_processing` move from a synchronous
call (today) to a background worker (spec section 46) without changing
its contract: callers only ever read `inspection.stage`.
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.enums import (
    AuditAction,
    ImageQuality,
    InspectionStage,
    ValidationStatus,
)
from app.models.inspection import Inspection
from app.models.ocr_result import OCRResult
from app.repositories import inspection_repository, result_repository
from app.schemas.inspection import ProcessingPipelineStage, ProcessingStatusResponse
from app.services.evidence import locate_bounding_box
from app.services.extraction.candidate import ImageOCRInput
from app.services.extraction.extractor import extract_product_information
from app.services.imaging import POOR_IMAGE_QUALITY_NOTE
from app.services.ocr import OCRService
from app.services.rules.context import FieldSnapshot, RuleEvaluationInput
from app.services.rules.rule_engine import evaluate_all
from app.services.rules.rule_selector import select_applicable_rules
from app.services.rules.status import calculate_overall_status
from app.services.validation.validator import validate as validate_field
from app.utils.confidence import level_for_score

POOR_QUALITY_THRESHOLD = 0.5
FAIR_QUALITY_THRESHOLD = 0.8
UNRELIABLE_POOR_FRACTION = 0.5


class ProcessingError(RuntimeError):
    pass


_QUALITY_RANK = {ImageQuality.POOR.value: 0, ImageQuality.FAIR.value: 1, ImageQuality.GOOD.value: 2}


def _quality_for_confidence(confidence: float) -> str:
    if confidence >= FAIR_QUALITY_THRESHOLD:
        return ImageQuality.GOOD.value
    if confidence >= POOR_QUALITY_THRESHOLD:
        return ImageQuality.FAIR.value
    return ImageQuality.POOR.value


def _worse_quality(a: str, b: str) -> str:
    # UNKNOWN (no prior signal, e.g. blur check unavailable) never wins
    # over an actual grade in either direction.
    if a not in _QUALITY_RANK:
        return b
    if b not in _QUALITY_RANK:
        return a
    return a if _QUALITY_RANK[a] <= _QUALITY_RANK[b] else b


async def run_processing(
    db: Session,
    *,
    inspection: Inspection,
    ocr_service: OCRService,
    storage,
    user_id: uuid.UUID,
) -> Inspection:
    # Re-fetch under a row lock so two concurrent /process calls for the
    # same inspection serialize rather than both starting the pipeline.
    locked = inspection_repository.get_for_update(db, inspection.id)
    if locked is not None:
        inspection = locked

    if inspection.stage == InspectionStage.FINALIZED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "INSPECTION_FINALIZED",
                    "message": "A finalized inspection cannot be reprocessed.",
                }
            },
        )
    if inspection.stage == InspectionStage.PROCESSING.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "ALREADY_PROCESSING",
                    "message": "This inspection is already being processed.",
                }
            },
        )

    images = inspection_repository.list_images(db, inspection.id)
    if not images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "NO_IMAGES",
                    "message": "At least one image is required before processing.",
                }
            },
        )

    inspection.stage = InspectionStage.PROCESSING.value
    inspection.processing_error = None
    db.commit()

    try:
        # --- OCR -------------------------------------------------------
        ocr_inputs: list[ImageOCRInput] = []
        for image in images:
            content = await storage.read_file(path=image.storage_path)
            ocr_result_data = await ocr_service.process_image(
                content,
                mime_type=image.mime_type,
                original_filename=image.original_filename,
                view_type=image.view_type,
            )

            existing = db.query(OCRResult).filter(OCRResult.image_id == image.id).one_or_none()
            if existing:
                db.delete(existing)
                db.flush()
            db.add(
                OCRResult(
                    image_id=image.id,
                    raw_text=ocr_result_data.raw_text,
                    ocr_confidence=ocr_result_data.confidence,
                )
            )
            # Combine with whatever quality signal was already set at
            # upload time (the blur check in image_service.upload_images)
            # — a real "this photo is blurry" finding is never silently
            # overwritten by a decent OCR confidence score, and vice
            # versa: the worse of the two grades wins.
            ocr_quality = _quality_for_confidence(ocr_result_data.confidence)
            image.image_quality = _worse_quality(image.image_quality, ocr_quality)
            image.quality_note = (
                POOR_IMAGE_QUALITY_NOTE if image.image_quality == ImageQuality.POOR.value else None
            )
            image.processing_status = "PROCESSED"

            ocr_inputs.append(
                ImageOCRInput(
                    image_id=image.id,
                    raw_text=ocr_result_data.raw_text,
                    ocr_confidence=ocr_result_data.confidence,
                    view_type=image.view_type,
                    words=ocr_result_data.words,
                    image_width=ocr_result_data.image_width,
                    image_height=ocr_result_data.image_height,
                )
            )

        inspection.stage = InspectionStage.OCR_COMPLETED.value
        db.commit()
        inspection_repository.add_audit_log(
            db, inspection_id=inspection.id, user_id=user_id, action=AuditAction.OCR_COMPLETED.value
        )
        db.commit()

        # --- Extraction --------------------------------------------------
        extraction_results = extract_product_information(ocr_inputs)
        inspection.stage = InspectionStage.EXTRACTION_COMPLETED.value
        db.commit()
        inspection_repository.add_audit_log(
            db,
            inspection_id=inspection.id,
            user_id=user_id,
            action=AuditAction.EXTRACTION_COMPLETED.value,
            metadata={"fields_extracted": len(extraction_results)},
        )
        db.commit()

        # --- Validation ----------------------------------------------------
        ocr_inputs_by_image = {inp.image_id: inp for inp in ocr_inputs}
        field_rows = []
        for result in extraction_results:
            outcome = validate_field(result)
            source_ocr = ocr_inputs_by_image.get(result.source_image_id) if result.source_image_id else None
            bounding_box = (
                locate_bounding_box(
                    words=source_ocr.words,
                    raw_text=source_ocr.raw_text,
                    source_text=result.source_text,
                    image_width=source_ocr.image_width,
                    image_height=source_ocr.image_height,
                )
                if source_ocr
                else None
            )
            field_rows.append(
                {
                    "field_name": result.field_name,
                    "value": result.value,
                    "normalized_value": result.normalized_value,
                    "confidence": result.confidence,
                    "confidence_level": level_for_score(result.confidence).value,
                    "validation_status": outcome.status.value,
                    "validation_reason": outcome.reason,
                    "source_image_id": result.source_image_id,
                    "source_text": result.source_text,
                    "bounding_box": bounding_box,
                    "manually_verified": False,
                    "manually_edited": False,
                    "candidates": (
                        [
                            {
                                "value": c.value,
                                "source_image_id": (str(c.source_image_id) if c.source_image_id else None),
                            }
                            for c in result.candidates
                        ]
                        if result.has_conflict
                        else None
                    ),
                }
            )
        stored_fields = inspection_repository.add_extracted_fields(
            db, inspection_id=inspection.id, fields=field_rows
        )
        inspection.stage = InspectionStage.VALIDATION_COMPLETED.value
        db.commit()

        # --- Rule selection + rule engine -----------------------------
        category = inspection.product.category if inspection.product else None
        applicable_rules = select_applicable_rules(db, category=category)

        poor_count = sum(1 for img in images if img.image_quality == ImageQuality.POOR.value)
        extraction_reliable = (poor_count / len(images)) < UNRELIABLE_POOR_FRACTION

        fields_by_name = {
            field.field_name: FieldSnapshot(
                field_name=field.field_name,
                value=field.value,
                normalized_value=field.normalized_value,
                confidence=field.confidence,
                validation_status=ValidationStatus(field.validation_status),
                source_image_id=field.source_image_id,
                manually_verified=field.manually_verified,
            )
            for field in stored_fields
        }
        context = RuleEvaluationInput(fields_by_name=fields_by_name, extraction_reliable=extraction_reliable)
        evaluations = evaluate_all(applicable_rules, context)

        result_rows = [
            {
                "rule_id": rule.id,
                "field_name": rule.field_name,
                "detected_value": outcome.detected_value,
                "status": outcome.status,
                "reason": outcome.reason,
                "confidence": outcome.confidence,
                "evidence_image_id": outcome.evidence_image_id,
                "reviewed": False,
            }
            for rule, outcome in evaluations
        ]
        result_repository.replace_for_inspection(db, inspection_id=inspection.id, results=result_rows)

        inspection.stage = InspectionStage.RULE_EVALUATION_COMPLETED.value
        db.commit()
        inspection_repository.add_audit_log(
            db,
            inspection_id=inspection.id,
            user_id=user_id,
            action=AuditAction.RULES_EVALUATED.value,
            metadata={"rules_checked": len(result_rows)},
        )

        inspection.overall_status = calculate_overall_status([str(row["status"]) for row in result_rows])
        inspection.stage = InspectionStage.READY_FOR_REVIEW.value
        db.commit()

    except HTTPException:
        raise
    except (
        Exception
    ) as exc:  # noqa: BLE001 — deliberately broad: any pipeline failure must be recorded, not crash the request
        inspection.stage = InspectionStage.PROCESSING_FAILED.value
        inspection.processing_error = str(exc)
        db.commit()
        inspection_repository.add_audit_log(
            db,
            inspection_id=inspection.id,
            user_id=user_id,
            action=AuditAction.PROCESSING_FAILED.value,
            metadata={"error": str(exc)},
        )
        db.commit()
        raise ProcessingError(str(exc)) from exc

    db.refresh(inspection)
    return inspection


_STAGE_TO_PIPELINE = {
    InspectionStage.CREATED.value: (ProcessingPipelineStage.UPLOADING, 5, "PENDING"),
    InspectionStage.IMAGES_UPLOADED.value: (ProcessingPipelineStage.UPLOADING, 15, "PENDING"),
    InspectionStage.PROCESSING.value: (ProcessingPipelineStage.OCR, 40, "PROCESSING"),
    InspectionStage.OCR_COMPLETED.value: (ProcessingPipelineStage.OCR, 55, "PROCESSING"),
    InspectionStage.EXTRACTION_COMPLETED.value: (
        ProcessingPipelineStage.EXTRACTION,
        70,
        "PROCESSING",
    ),
    InspectionStage.VALIDATION_COMPLETED.value: (
        ProcessingPipelineStage.VALIDATION,
        85,
        "PROCESSING",
    ),
    InspectionStage.RULE_EVALUATION_COMPLETED.value: (
        ProcessingPipelineStage.RULE_EVALUATION,
        95,
        "PROCESSING",
    ),
    InspectionStage.READY_FOR_REVIEW.value: (ProcessingPipelineStage.COMPLETED, 100, "COMPLETED"),
    InspectionStage.FINALIZED.value: (ProcessingPipelineStage.COMPLETED, 100, "COMPLETED"),
    InspectionStage.PROCESSING_FAILED.value: (ProcessingPipelineStage.FAILED, 100, "FAILED"),
}


def get_processing_status(inspection: Inspection) -> ProcessingStatusResponse:
    stage, progress, status_label = _STAGE_TO_PIPELINE.get(
        inspection.stage, (ProcessingPipelineStage.UPLOADING, 0, "PENDING")
    )
    return ProcessingStatusResponse(
        inspection_id=inspection.id,
        stage=stage,
        progress=progress,
        status=status_label,
        error=inspection.processing_error,
    )
