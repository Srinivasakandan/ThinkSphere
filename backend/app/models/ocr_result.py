"""OCRResult — raw OCR output for one image, kept separate from the
structured `ExtractedField` values derived from it. Raw OCR text is
never treated as structured product information on its own.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ImageProcessingStatus

if TYPE_CHECKING:
    from app.models.product_image import ProductImage


class OCRResult(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "ocr_results"

    image_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_images.id"), unique=True, nullable=False, index=True
    )

    raw_text: Mapped[str] = mapped_column(Text, default="")
    ocr_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    processing_status: Mapped[str] = mapped_column(String(20), default=ImageProcessingStatus.PROCESSED.value)

    image: Mapped["ProductImage"] = relationship(back_populates="ocr_result")
