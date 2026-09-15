"""Shared schema building blocks."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMModel(BaseModel):
    """Base for response schemas built from SQLAlchemy ORM instances."""

    model_config = ConfigDict(from_attributes=True)


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class Page(ORMModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
