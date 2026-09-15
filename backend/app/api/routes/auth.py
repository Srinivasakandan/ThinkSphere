"""Auth-adjacent endpoints. Credential authentication itself is owned by
Supabase Auth on the frontend; this only exposes the resolved profile
for the currently authenticated inspector.
"""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_inspector
from app.models.user import Inspector
from app.schemas.inspection import InspectorResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=InspectorResponse, summary="Current inspector profile")
def read_current_inspector(inspector: Inspector = Depends(get_current_inspector)) -> Inspector:
    return inspector
