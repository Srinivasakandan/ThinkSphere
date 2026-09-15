"""Structured extraction schemas.

Note the naming: `confidence` here is always an *extraction* confidence
signal, never a legal compliance score. See app/utils/confidence.py.
"""

import uuid

from pydantic import BaseModel, Field

from app.models.enums import ConfidenceLevel, ValidationStatus
from app.schemas.common import ORMModel


class ExtractedFieldResponse(ORMModel):
    id: uuid.UUID
    inspection_id: uuid.UUID
    field_name: str
    value: str | None
    normalized_value: str | None
    confidence: float
    confidence_level: ConfidenceLevel
    validation_status: ValidationStatus
    validation_reason: str | None
    source_image_id: uuid.UUID | None
    source_text: str | None
    manually_verified: bool
    manually_edited: bool


class ExtractedFieldsResponse(BaseModel):
    fields: list[ExtractedFieldResponse]


class ExtractedFieldUpdateRequest(BaseModel):
    value: str | None = None
    manually_verified: bool = Field(default=True)
    note: str | None = None
