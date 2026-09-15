"""Rule — a single entry in the compliance rules repository.

Real Legal Metrology rules must be populated and verified from
authoritative sources. `is_demo=True` rows are schema-only sample data
and must never be presented as authoritative legal requirements (see
app.services.rules.rule_selector and the frontend Rules page).
"""

from datetime import date

from sqlalchemy import Boolean, Date, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import RuleConditionType


class Rule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "rules"

    rule_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(100))

    field_name: Mapped[str] = mapped_column(String(60), index=True)
    condition_type: Mapped[str] = mapped_column(String(20), default=RuleConditionType.REQUIRED.value)
    expected_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expected_unit: Mapped[str | None] = mapped_column(String(50), nullable=True)

    applicable_category: Mapped[str] = mapped_column(String(100), default="Packaged Commodity")

    legal_source: Mapped[str] = mapped_column(String(500))
    version: Mapped[str] = mapped_column(String(20), default="1.0")
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
