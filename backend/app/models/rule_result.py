"""RuleResult — the outcome of evaluating one rule against one inspection's
structured, extracted product information.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import InspectionStatus

if TYPE_CHECKING:
    from app.models.inspection import Inspection
    from app.models.rule import Rule


class RuleResult(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "rule_results"

    inspection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inspections.id"), nullable=False, index=True
    )
    rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rules.id"), nullable=False, index=True
    )

    field_name: Mapped[str] = mapped_column(String(60))
    detected_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default=InspectionStatus.NEEDS_REVIEW.value)
    reason: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    evidence_image_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("product_images.id"), nullable=True
    )

    reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inspectors.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    inspector_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    inspection: Mapped["Inspection"] = relationship(back_populates="rule_results")
    rule: Mapped["Rule"] = relationship(lazy="joined")
