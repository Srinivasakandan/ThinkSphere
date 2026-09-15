"""Rules repository (reference browsing) and per-inspection rule results."""

import uuid

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_inspector, get_db
from app.models.user import Inspector
from app.repositories import rule_repository
from app.schemas.rule import RuleResponse
from app.schemas.rule_result import RuleResultsResponse
from app.services import inspection_service

router = APIRouter(tags=["rules"])


@router.get("/api/rules", response_model=list[RuleResponse], summary="List the rules repository")
def list_rules(
    db=Depends(get_db),
    _: Inspector = Depends(get_current_inspector),
) -> list[RuleResponse]:
    return [RuleResponse.model_validate(rule) for rule in rule_repository.list_all(db)]


@router.get(
    "/api/inspections/{inspection_id}/rules",
    response_model=RuleResultsResponse,
    summary="Get rule evaluation results for an inspection",
)
def get_inspection_rules(
    inspection_id: uuid.UUID,
    db=Depends(get_db),
    _: Inspector = Depends(get_current_inspector),
) -> RuleResultsResponse:
    inspection = inspection_service.get_inspection_or_404(db, inspection_id)
    return RuleResultsResponse(
        rules=[inspection_service.to_rule_result_response(r) for r in inspection.rule_results]
    )
