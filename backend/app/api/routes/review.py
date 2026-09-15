"""Inspector review of individual rule findings."""

import uuid

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_inspector, get_db
from app.models.user import Inspector
from app.schemas.review import RuleReviewRequest
from app.schemas.rule_result import RuleResultResponse
from app.services import inspection_service
from app.services.review import review_service

router = APIRouter(prefix="/api/inspections", tags=["review"])


@router.patch(
    "/{inspection_id}/rules/{rule_result_id}/review",
    response_model=RuleResultResponse,
    summary="Confirm or correct a rule finding",
)
def review_rule_result(
    inspection_id: uuid.UUID,
    rule_result_id: uuid.UUID,
    payload: RuleReviewRequest,
    db=Depends(get_db),
    inspector: Inspector = Depends(get_current_inspector),
) -> RuleResultResponse:
    inspection = inspection_service.get_inspection_or_404(db, inspection_id)
    rule_result = review_service.review_rule_result(
        db,
        inspection=inspection,
        rule_result_id=rule_result_id,
        data=payload,
        reviewer_id=inspector.id,
    )
    return inspection_service.to_rule_result_response(rule_result)
