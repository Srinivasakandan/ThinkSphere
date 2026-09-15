"""InspectorReview — append-only history of inspector review actions.

`rule_results.reviewed` / `.inspector_note` and `extracted_fields
.manually_verified` hold the *current* state for fast reads; this table
holds the full history of who decided what and when, independent of
audit_logs (which is a broader, system-wide event log).
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ReviewDecision, ReviewTargetType

if TYPE_CHECKING:
    from app.models.inspection import Inspection
    from app.models.user import Inspector


class InspectorReview(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "inspector_reviews"

    inspection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inspections.id"), nullable=False, index=True
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inspectors.id"), nullable=False
    )

    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    decision: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    inspection: Mapped["Inspection"] = relationship()
    reviewer: Mapped["Inspector"] = relationship(lazy="joined")


__all__ = ["InspectorReview", "ReviewTargetType", "ReviewDecision"]
