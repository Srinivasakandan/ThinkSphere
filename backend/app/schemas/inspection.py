"""Inspection schemas — the primary aggregate resource."""

import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel

from app.models.enums import InspectionStage, InspectionStatus
from app.schemas.common import ORMModel
from app.schemas.extraction import ExtractedFieldResponse
from app.schemas.image import ImageResponse
from app.schemas.product import ProductCreate, ProductResponse
from app.schemas.rule_result import RuleResultResponse


class InspectorResponse(ORMModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: str
    badge_id: str | None


class InspectionCreate(ProductCreate):
    inspection_location: str | None = None
    notes: str | None = None


class InspectionCreateResponse(BaseModel):
    id: uuid.UUID
    stage: InspectionStage


class InspectionSummary(BaseModel):
    id: uuid.UUID
    product_name: str | None
    category: str | None
    stage: InspectionStage
    overall_status: InspectionStatus
    inspector_name: str
    created_at: datetime


class InspectionDetail(BaseModel):
    id: uuid.UUID
    stage: InspectionStage
    overall_status: InspectionStatus
    inspector: InspectorResponse
    product: ProductResponse | None
    images: list[ImageResponse]
    extracted_fields: list[ExtractedFieldResponse]
    rule_results: list[RuleResultResponse]
    inspection_location: str | None
    notes: str | None
    processing_error: str | None
    created_at: datetime
    updated_at: datetime
    finalized_at: datetime | None


class ProcessingPipelineStage(StrEnum):
    UPLOADING = "UPLOADING"
    OCR = "OCR"
    EXTRACTION = "EXTRACTION"
    VALIDATION = "VALIDATION"
    RULE_EVALUATION = "RULE_EVALUATION"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ProcessingStatusResponse(BaseModel):
    inspection_id: uuid.UUID
    stage: ProcessingPipelineStage
    progress: int
    status: str
    error: str | None = None


class FinalizeInspectionRequest(BaseModel):
    final_notes: str | None = None


class FinalizeInspectionResponse(BaseModel):
    can_finalize: bool
    reason: str | None = None
    inspection: InspectionDetail | None = None


class ResultsSummary(BaseModel):
    total: int
    passed: int
    potential_non_compliance: int
    needs_review: int


class InspectionResultsResponse(BaseModel):
    inspection_id: uuid.UUID
    product: ProductResponse | None
    overall_status: InspectionStatus
    summary: ResultsSummary
    rules: list[RuleResultResponse]
