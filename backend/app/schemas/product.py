"""Product schemas."""

import uuid

from pydantic import BaseModel

from app.schemas.common import ORMModel


class ProductCreate(BaseModel):
    product_name: str | None = None
    brand: str | None = None
    category: str | None = None
    batch_number: str | None = None


class ProductResponse(ORMModel):
    id: uuid.UUID
    product_name: str | None
    brand: str | None
    category: str | None
    batch_number: str | None
