"""Shared FastAPI dependencies: DB session, current user, current
inspector profile (auto-provisioned on first authenticated request).
"""

from collections.abc import Generator

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, UserRole, get_current_user, require_roles
from app.db.session import SessionLocal
from app.models.user import Inspector

__all__ = [
    "CurrentUser",
    "UserRole",
    "get_current_inspector",
    "get_current_user",
    "get_db",
    "require_roles",
]


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_inspector(
    db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)
) -> Inspector:
    """Resolve (and lazily provision) the local Inspector profile row for
    the authenticated Supabase user. Supabase owns credentials; this row
    only exists so other tables have something to foreign-key against.
    """

    inspector = db.get(Inspector, user.id)
    if inspector is None:
        inspector = Inspector(
            id=user.id,
            email=user.email or f"{user.id}@unknown.local",
            full_name=(user.email.split("@")[0].replace(".", " ").title() if user.email else "Inspector"),
            role=user.role.value,
        )
        db.add(inspector)
        db.commit()
        db.refresh(inspector)
    return inspector
