"""Inspection report generation."""

import uuid

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_inspector, get_db
from app.core.config import Settings, get_settings
from app.models.user import Inspector
from app.schemas.report import ReportGenerateResponse
from app.services import inspection_service
from app.services.reports.report_service import generate_inspection_report
from app.services.storage import get_storage_service

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post(
    "/inspection/{inspection_id}",
    response_model=ReportGenerateResponse,
    summary="Generate an inspection report",
)
async def generate_report(
    inspection_id: uuid.UUID,
    db=Depends(get_db),
    _: Inspector = Depends(get_current_inspector),
    settings: Settings = Depends(get_settings),
) -> ReportGenerateResponse:
    inspection = inspection_service.get_inspection_or_404(db, inspection_id)
    storage = get_storage_service(settings)
    return await generate_inspection_report(inspection, storage)
