"""Data access for Inspection aggregates (inspection + product + images +
extracted fields + audit log). Keeps query construction out of the
service layer.
"""

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.audit_log import AuditLog
from app.models.enums import InspectionStage
from app.models.extracted_field import ExtractedField
from app.models.inspection import Inspection
from app.models.product import Product
from app.models.product_image import ProductImage


def create(db: Session, *, inspector_id: uuid.UUID) -> Inspection:
    inspection = Inspection(inspector_id=inspector_id, stage=InspectionStage.CREATED.value)
    db.add(inspection)
    db.flush()
    return inspection


def get(db: Session, inspection_id: uuid.UUID) -> Inspection | None:
    stmt = (
        select(Inspection)
        .where(Inspection.id == inspection_id)
        .options(
            joinedload(Inspection.product),
            joinedload(Inspection.images),
            joinedload(Inspection.extracted_fields),
            joinedload(Inspection.rule_results),
            joinedload(Inspection.inspector),
        )
    )
    return db.execute(stmt).unique().scalar_one_or_none()


def list_inspections(
    db: Session,
    *,
    search: str | None = None,
    status: str | None = None,
    category: str | None = None,
    inspector_id: uuid.UUID | None = None,
    date_from=None,
    date_to=None,
    page: int = 1,
    page_size: int = 20,
    exclude_stages: tuple[str, ...] = (InspectionStage.CREATED.value,),
) -> tuple[list[Inspection], int]:
    stmt = (
        select(Inspection)
        .join(Product, Product.inspection_id == Inspection.id, isouter=True)
        .options(joinedload(Inspection.product), joinedload(Inspection.inspector))
    )

    if exclude_stages:
        stmt = stmt.where(Inspection.stage.notin_(exclude_stages))
    if status:
        stmt = stmt.where(Inspection.overall_status == status)
    if inspector_id:
        stmt = stmt.where(Inspection.inspector_id == inspector_id)
    if category:
        stmt = stmt.where(Product.category == category)
    if date_from:
        stmt = stmt.where(Inspection.created_at >= date_from)
    if date_to:
        stmt = stmt.where(Inspection.created_at <= date_to)
    if search:
        like = f"%{search.lower()}%"
        stmt = stmt.where(
            func.lower(Product.product_name).like(like) | func.lower(Inspection.id.cast(str)).like(like)
        )

    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = db.execute(count_stmt).scalar_one()

    stmt = stmt.order_by(Inspection.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = db.execute(stmt).unique().scalars().all()
    return list(items), total


def add_extracted_fields(
    db: Session, *, inspection_id: uuid.UUID, fields: list[dict[str, Any]]
) -> list[ExtractedField]:
    # Idempotency: replace any existing extracted fields for this inspection
    # rather than accumulating duplicates on repeated processing.
    existing = (
        db.execute(select(ExtractedField).where(ExtractedField.inspection_id == inspection_id))
        .scalars()
        .all()
    )
    for row in existing:
        db.delete(row)
    db.flush()

    created = []
    for field_data in fields:
        field = ExtractedField(inspection_id=inspection_id, **field_data)
        db.add(field)
        created.append(field)
    db.flush()
    return created


def get_extracted_field(db: Session, field_id: uuid.UUID) -> ExtractedField | None:
    return db.get(ExtractedField, field_id)


def list_images(db: Session, inspection_id: uuid.UUID) -> list[ProductImage]:
    stmt = (
        select(ProductImage)
        .where(ProductImage.inspection_id == inspection_id)
        .order_by(ProductImage.created_at)
    )
    return list(db.execute(stmt).scalars().all())


def add_audit_log(
    db: Session,
    *,
    inspection_id: uuid.UUID | None,
    user_id: uuid.UUID | None,
    action: str,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    log = AuditLog(
        inspection_id=inspection_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        event_metadata=metadata,
    )
    db.add(log)
    db.flush()
    return log
