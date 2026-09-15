"""Data access for the rules repository (compliance requirements)."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.rule import Rule


def list_active(db: Session, *, applicable_category: str | None = None) -> list[Rule]:
    stmt = select(Rule).where(Rule.active.is_(True))
    if applicable_category:
        stmt = stmt.where(
            (Rule.applicable_category == applicable_category)
            | (Rule.applicable_category == "Packaged Commodity")
        )
    stmt = stmt.order_by(Rule.rule_code)
    return list(db.execute(stmt).scalars().all())


def list_all(db: Session) -> list[Rule]:
    return list(db.execute(select(Rule).order_by(Rule.rule_code)).scalars().all())


def get(db: Session, rule_id: uuid.UUID) -> Rule | None:
    return db.get(Rule, rule_id)


def get_by_code(db: Session, rule_code: str) -> Rule | None:
    stmt = select(Rule).where(Rule.rule_code == rule_code)
    return db.execute(stmt).scalar_one_or_none()


def upsert_by_code(db: Session, *, rule_code: str, data: dict) -> Rule:
    rule = get_by_code(db, rule_code)
    if rule is None:
        rule = Rule(rule_code=rule_code, **data)
        db.add(rule)
    else:
        for key, value in data.items():
            setattr(rule, key, value)
    db.flush()
    return rule
