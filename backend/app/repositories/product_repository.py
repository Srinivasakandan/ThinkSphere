"""Data access for the single Product a given inspection describes."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product


def get_by_inspection(db: Session, inspection_id: uuid.UUID) -> Product | None:
    stmt = select(Product).where(Product.inspection_id == inspection_id)
    return db.execute(stmt).scalar_one_or_none()


def upsert(db: Session, *, inspection_id: uuid.UUID, data: dict[str, Any]) -> Product:
    product = get_by_inspection(db, inspection_id)
    if product is None:
        product = Product(inspection_id=inspection_id, **data)
        db.add(product)
    else:
        for key, value in data.items():
            if value is not None:
                setattr(product, key, value)
    db.flush()
    return product
