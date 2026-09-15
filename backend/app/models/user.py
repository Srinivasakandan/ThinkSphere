"""Local inspector profile, mirroring the Supabase Auth user by id.

Supabase Auth owns credentials; this table only stores the profile
fields the application needs to join against (name, role, badge).
"""

import uuid

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, new_uuid
from app.models.enums import UserRole


class Inspector(Base, TimestampMixin):
    __tablename__ = "inspectors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default=UserRole.INSPECTOR.value)
    badge_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
