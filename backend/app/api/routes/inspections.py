"""Inspection CRUD, listing, finalization and results."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_inspector, get_db
from app.core.config import Settings, get_settings
from app.models.user import Inspector
from app.repositories import inspection_repository
from app.schemas.common import Page
from app.schemas.inspection import (
    FinalizeInspectionRequest,
    FinalizeInspectionResponse,
    InspectionCreate,
    InspectionCreateResponse,
    InspectionDetail,
    InspectionResultsResponse,
    InspectionSummary,
)
from app.services import inspection_service
from app.services.storage import get_storage_service

router = APIRouter(prefix="/api/inspections", tags=["inspections"])


@router.post("", response_model=InspectionCreateResponse, status_code=201, summary="Create an inspection")
def create_inspection(
    payload: InspectionCreate,
    db: Session = Depends(get_db),
    inspector: Inspector = Depends(get_current_inspector),
) -> InspectionCreateResponse:
    inspection = inspection_service.create_inspection(db, inspector_id=inspector.id, data=payload)
    return InspectionCreateResponse(id=inspection.id, stage=inspection.stage)


@router.get("", response_model=Page[InspectionSummary], summary="List inspections")
def list_inspections(
    db: Session = Depends(get_db),
    _: Inspector = Depends(get_current_inspector),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    category: str | None = None,
    search: str | None = None,
    inspector_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> Page[InspectionSummary]:
    items, total = inspection_repository.list_inspections(
        db,
        search=search,
        status=status,
        category=category,
        inspector_id=inspector_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return Page(
        items=[inspection_service.to_summary(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{inspection_id}", response_model=InspectionDetail, summary="Get inspection detail")
def get_inspection(
    inspection_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: Inspector = Depends(get_current_inspector),
    settings: Settings = Depends(get_settings),
) -> InspectionDetail:
    inspection = inspection_service.get_inspection_or_404(db, inspection_id)
    storage = get_storage_service(settings)
    return inspection_service.to_detail(inspection, storage)


@router.get(
    "/{inspection_id}/results",
    response_model=InspectionResultsResponse,
    summary="Get final results",
)
def get_results(
    inspection_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: Inspector = Depends(get_current_inspector),
) -> InspectionResultsResponse:
    inspection = inspection_service.get_inspection_or_404(db, inspection_id)
    return inspection_service.to_results(inspection)


@router.post(
    "/{inspection_id}/finalize",
    response_model=FinalizeInspectionResponse,
    summary="Finalize an inspection",
)
def finalize_inspection(
    inspection_id: uuid.UUID,
    payload: FinalizeInspectionRequest,
    db: Session = Depends(get_db),
    inspector: Inspector = Depends(get_current_inspector),
    settings: Settings = Depends(get_settings),
) -> FinalizeInspectionResponse:
    inspection = inspection_service.get_inspection_or_404(db, inspection_id)
    return inspection_service.finalize_inspection(
        db,
        inspection=inspection,
        inspector_id=inspector.id,
        final_notes=payload.final_notes,
        settings=settings,
    )
