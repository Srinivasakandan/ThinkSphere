"""Rules repository schemas."""

import uuid
from datetime import date

from app.models.enums import RuleConditionType
from app.schemas.common import ORMModel


class RuleResponse(ORMModel):
    id: uuid.UUID
    rule_code: str
    title: str
    description: str
    category: str
    field_name: str
    condition_type: RuleConditionType
    expected_value: str | None
    expected_unit: str | None
    applicable_category: str
    legal_source: str
    version: str
    effective_from: date | None
    effective_to: date | None
    active: bool
    is_demo: bool
