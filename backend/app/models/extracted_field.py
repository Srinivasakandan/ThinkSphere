"""ExtractedField — structured product information derived from OCR text.

`field_name` is deliberately a free string (see app.models.enums module
docstring) so new declaration types never require a migration.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ConfidenceLevel, ValidationStatus

if TYPE_CHECKING:
    from app.models.inspection import Inspection


class ExtractedField(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "extracted_fields"

    inspection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inspections.id"), nullable=False, index=True
    )

    field_name: Mapped[str] = mapped_column(String(60), index=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    normalized_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    confidence_level: Mapped[str] = mapped_column(String(10), default=ConfidenceLevel.LOW.value)
    validation_status: Mapped[str] = mapped_column(String(20), default=ValidationStatus.NOT_VALIDATED.value)
    validation_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    source_image_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_images.id"), nullable=True
    )
    source_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pixel region on the source image this value was read from, as
    # fractions of image width/height ({"x", "y", "width", "height"},
    # each 0-1) — lets the UI highlight the evidence, not just name the
    # image. None when it couldn't be located (see app.services.evidence).
    bounding_box: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Populated only when validation_status == CONFLICT: every distinct
    # value detected across images, each with its source, e.g.
    # [{"value": "₹50", "source_image_id": "..."}, ...]. Never
    # silently collapsed to a single "winning" value.
    candidates: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)

    manually_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    manually_edited: Mapped[bool] = mapped_column(Boolean, default=False)

    inspection: Mapped["Inspection"] = relationship(back_populates="extracted_fields")
