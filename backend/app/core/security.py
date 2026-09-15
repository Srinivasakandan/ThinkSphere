"""Authentication and authorization.

The frontend sends `Authorization: Bearer <supabase-access-token>`. We
verify that token's signature against the Supabase project's JWT secret
(HS256) rather than trusting any inspector_id supplied in a request body.

When Supabase is not configured (local/demo development), requests fall
back to a fixed mock inspector so the API remains usable end to end. Mock
auth is refused outside of `allow_mock_auth` so it can never silently
apply in a real deployment.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import Settings, get_settings

bearer_scheme = HTTPBearer(auto_error=False)


class UserRole(StrEnum):
    INSPECTOR = "INSPECTOR"
    SUPERVISOR = "SUPERVISOR"
    ADMIN = "ADMIN"


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    role: UserRole


MOCK_USER = CurrentUser(
    id="00000000-0000-0000-0000-000000000001",
    email="demo.inspector@legalmetrology.gov.in",
    role=UserRole.INSPECTOR,
)


def _role_from_claims(payload: dict) -> UserRole:
    app_metadata = payload.get("app_metadata") or {}
    user_metadata = payload.get("user_metadata") or {}
    raw_role = app_metadata.get("role") or user_metadata.get("role") or UserRole.INSPECTOR.value
    try:
        return UserRole(str(raw_role).upper())
    except ValueError:
        return UserRole.INSPECTOR


def decode_supabase_token(token: str, settings: Settings) -> CurrentUser:
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": bool(settings.supabase_jwt_secret)},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "INVALID_TOKEN", "message": "Could not validate credentials."}},
        ) from exc

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "INVALID_TOKEN", "message": "Token is missing a subject."}},
        )

    return CurrentUser(id=subject, email=payload.get("email"), role=_role_from_claims(payload))


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    if not settings.is_supabase_configured:
        if not settings.allow_mock_auth:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": {
                        "code": "AUTH_NOT_CONFIGURED",
                        "message": "Authentication is not configured.",
                    }
                },
            )
        return MOCK_USER

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "NOT_AUTHENTICATED",
                    "message": "Authentication credentials were not provided.",
                }
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    return decode_supabase_token(credentials.credentials, settings)


def require_roles(*allowed: UserRole):
    """Dependency factory enforcing role-based authorization server-side.

    Frontend role checks are cosmetic only — this is the real boundary.
    """

    def dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": {
                        "code": "FORBIDDEN",
                        "message": f"Role '{user.role.value}' is not permitted to perform this action.",
                    }
                },
            )
        return user

    return dependency
