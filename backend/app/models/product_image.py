"""ProductImage — one of several images belonging to a single inspection."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ImageProcessingStatus, ImageViewType

if TYPE_CHECKING:
    from app.models.inspection import Inspection
    from app.models.ocr_result import OCRResult


class ProductImage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "product_images"

    inspection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inspections.id"), nullable=False, index=True
    )

    storage_path: Mapped[str] = mapped_column(String(500))
    original_filename: Mapped[str] = mapped_column(String(255))
    view_type: Mapped[str] = mapped_column(String(20), default=ImageViewType.OTHER.value)
    mime_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer)

    image_quality: Mapped[str | None] = mapped_column(String(20), nullable=True)
    quality_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    processing_status: Mapped[str] = mapped_column(String(20), default=ImageProcessingStatus.UPLOADED.value)

    inspection: Mapped["Inspection"] = relationship(back_populates="images")
    ocr_result: Mapped["OCRResult | None"] = relationship(
        back_populates="image", uselist=False, cascade="all, delete-orphan"
    )
