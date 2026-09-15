"""Inspector review request schemas."""

from pydantic import BaseModel


class RuleReviewRequest(BaseModel):
    reviewed: bool = True
    inspector_note: str | None = None
    corrected_value: str | None = None
