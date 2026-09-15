"""Rule applicability: product information -> applicable rules.

Keeps rule-selection logic out of API routes and the rule engine
itself, so it can grow more sophisticated (per-category rule sets,
scheduled-commodity logic, etc.) without touching either.
"""

from sqlalchemy.orm import Session

from app.models.rule import Rule
from app.repositories import rule_repository


def select_applicable_rules(db: Session, *, category: str | None) -> list[Rule]:
    return rule_repository.list_active(db, applicable_category=category)
