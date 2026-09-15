"""Rules repository (reference browsing) and per-inspection rule results."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_current_inspector, get_db
from app.models.user import Inspector
from app.repositories import result_repository, rule_repository
from app.schemas.common import Page
from app.schemas.rule import RuleResponse
from app.schemas.rule_result import RuleResultDetailResponse, RuleResultsResponse
from app.services import inspection_service

router = APIRouter(tags=["rules"])


@router.get("/api/v1/rules", response_model=Page[RuleResponse], summary="List the rules repository")
def list_rules(
    db=Depends(get_db),
    _: Inspector = Depends(get_current_inspector),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = None,
    active: bool | None = None,
    search: str | None = None,
) -> Page[RuleResponse]:
    items, total = rule_repository.list_paginated(
        db, page=page, page_size=page_size, category=category, active=active, search=search
    )
    return Page(
        items=[RuleResponse.model_validate(rule) for rule in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/api/v1/rules/{rule_id}", response_model=RuleResponse, summary="Get a single rule")
def get_rule(
    rule_id: uuid.UUID,
    db=Depends(get_db),
    _: Inspector = Depends(get_current_inspector),
) -> RuleResponse:
    rule = rule_repository.get(db, rule_id)
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "RULE_NOT_FOUND", "message": "Rule could not be found."}},
        )
    return RuleResponse.model_validate(rule)


@router.get(
    "/api/v1/inspections/{inspection_id}/rules",
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


@router.get(
    "/api/v1/inspections/{inspection_id}/rules/{rule_result_id}",
    response_model=RuleResultDetailResponse,
    summary="Get complete detail for one rule result",
)
def get_rule_result_detail(
    inspection_id: uuid.UUID,
    rule_result_id: uuid.UUID,
    db=Depends(get_db),
    _: Inspector = Depends(get_current_inspector),
) -> RuleResultDetailResponse:
    inspection_service.get_inspection_or_404(db, inspection_id)
    rule_result = result_repository.get(db, rule_result_id)
    if rule_result is None or rule_result.inspection_id != inspection_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "RULE_NOT_FOUND",
                    "message": "Rule result could not be found on this inspection.",
                }
            },
        )
    return inspection_service.to_rule_result_detail(rule_result)
