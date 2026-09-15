"""Inspection — the top-level record: one inspection = one physical
product, with one or more images, extracted fields and rule results.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import InspectionStage, InspectionStatus

if TYPE_CHECKING:
    from app.models.audit_log import AuditLog
    from app.models.extracted_field import ExtractedField
    from app.models.product import Product
    from app.models.product_image import ProductImage
    from app.models.rule_result import RuleResult
    from app.models.user import Inspector


class Inspection(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "inspections"

    inspector_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inspectors.id"), nullable=False, index=True
    )

    stage: Mapped[str] = mapped_column(String(40), default=InspectionStage.CREATED.value, index=True)
    overall_status: Mapped[str] = mapped_column(
        String(40), default=InspectionStatus.NEEDS_REVIEW.value, index=True
    )

    inspection_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    finalized_at: Mapped[datetime | None] = mapped_column(nullable=True)

    inspector: Mapped["Inspector"] = relationship(lazy="joined")
    product: Mapped["Product | None"] = relationship(
        back_populates="inspection", uselist=False, cascade="all, delete-orphan"
    )
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="inspection",
        cascade="all, delete-orphan",
        order_by="ProductImage.created_at",
    )
    extracted_fields: Mapped[list["ExtractedField"]] = relationship(
        back_populates="inspection", cascade="all, delete-orphan"
    )
    rule_results: Mapped[list["RuleResult"]] = relationship(
        back_populates="inspection", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        back_populates="inspection", cascade="all, delete-orphan", order_by="AuditLog.created_at"
    )
