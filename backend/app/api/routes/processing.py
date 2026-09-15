"""Trigger and poll the OCR -> extraction -> validation -> rule
evaluation pipeline for an inspection."""

import uuid

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_inspector, get_db
from app.core.config import Settings, get_settings
from app.models.user import Inspector
from app.repositories import inspection_repository
from app.schemas.inspection import InspectionDetail, ProcessingStatusResponse
from app.schemas.ocr import OCRResultResponse, OCRResultsResponse
from app.services import inspection_service, processing_service
from app.services.ocr import get_ocr_service
from app.services.storage import get_storage_service

router = APIRouter(prefix="/api/v1/inspections", tags=["processing"])


@router.post("/{inspection_id}/process", response_model=InspectionDetail, summary="Start processing")
async def start_processing(
    inspection_id: uuid.UUID,
    db=Depends(get_db),
    inspector: Inspector = Depends(get_current_inspector),
    settings: Settings = Depends(get_settings),
) -> InspectionDetail:
    inspection = inspection_service.get_inspection_or_404(db, inspection_id)
    storage = get_storage_service(settings)
    ocr_service = get_ocr_service(settings)

    inspection = await processing_service.run_processing(
        db, inspection=inspection, ocr_service=ocr_service, storage=storage, user_id=inspector.id
    )
    return inspection_service.to_detail(inspection, storage)


@router.get(
    "/{inspection_id}/processing-status",
    response_model=ProcessingStatusResponse,
    summary="Get processing status",
)
def get_processing_status(
    inspection_id: uuid.UUID,
    db=Depends(get_db),
    _: Inspector = Depends(get_current_inspector),
) -> ProcessingStatusResponse:
    inspection = inspection_service.get_inspection_or_404(db, inspection_id)
    return processing_service.get_processing_status(inspection)


@router.get(
    "/{inspection_id}/ocr",
    response_model=OCRResultsResponse,
    summary="Get raw OCR results for every image in an inspection",
)
def get_ocr_results(
    inspection_id: uuid.UUID,
    db=Depends(get_db),
    _: Inspector = Depends(get_current_inspector),
) -> OCRResultsResponse:
    inspection_service.get_inspection_or_404(db, inspection_id)
    results = inspection_repository.list_ocr_results(db, inspection_id)
    return OCRResultsResponse(items=[OCRResultResponse.model_validate(r) for r in results])
