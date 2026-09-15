"""Raw OCR result schemas — kept separate from structured extraction."""

import uuid

from app.models.enums import ImageProcessingStatus
from app.schemas.common import ORMModel


class OCRResultResponse(ORMModel):
    image_id: uuid.UUID
    raw_text: str
    ocr_confidence: float
    processing_status: ImageProcessingStatus


class OCRResultsResponse(ORMModel):
    items: list[OCRResultResponse]
