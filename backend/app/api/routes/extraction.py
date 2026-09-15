"""Structured extraction results and inspector corrections."""

import uuid

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_inspector, get_db
from app.models.user import Inspector
from app.schemas.extraction import (
    ExtractedFieldResponse,
    ExtractedFieldsResponse,
    ExtractedFieldUpdateRequest,
)
from app.services import inspection_service
from app.services.review import review_service

router = APIRouter(prefix="/api/inspections", tags=["extraction"])


@router.get(
    "/{inspection_id}/extracted",
    response_model=ExtractedFieldsResponse,
    summary="Get extracted fields",
)
def get_extracted_fields(
    inspection_id: uuid.UUID,
    db=Depends(get_db),
    _: Inspector = Depends(get_current_inspector),
) -> ExtractedFieldsResponse:
    inspection = inspection_service.get_inspection_or_404(db, inspection_id)
    return ExtractedFieldsResponse(fields=list(inspection.extracted_fields))


@router.patch(
    "/{inspection_id}/fields/{field_id}",
    response_model=ExtractedFieldResponse,
    summary="Correct/verify an extracted field",
)
def update_extracted_field(
    inspection_id: uuid.UUID,
    field_id: uuid.UUID,
    payload: ExtractedFieldUpdateRequest,
    db=Depends(get_db),
    inspector: Inspector = Depends(get_current_inspector),
) -> ExtractedFieldResponse:
    inspection = inspection_service.get_inspection_or_404(db, inspection_id)
    field = review_service.update_extracted_field(
        db, inspection=inspection, field_id=field_id, data=payload, reviewer_id=inspector.id
    )
    return ExtractedFieldResponse.model_validate(field)
