"""Product image schemas."""

import uuid
from datetime import datetime

from app.models.enums import ImageProcessingStatus, ImageQuality, ImageViewType
from app.schemas.common import ORMModel


class ImageResponse(ORMModel):
    id: uuid.UUID
    inspection_id: uuid.UUID
    view_type: ImageViewType
    original_filename: str
    mime_type: str
    file_size: int
    image_quality: ImageQuality
    quality_note: str | None
    processing_status: ImageProcessingStatus
    url: str
    created_at: datetime
