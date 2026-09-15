"""Shared candidate type produced by every extractor and consumed by the
conflict-resolution/orchestration step in extractor.py.
"""

import uuid
from dataclasses import dataclass, field


@dataclass
class ExtractionCandidate:
    field_name: str
    value: str
    normalized_value: str | None
    source_image_id: uuid.UUID
    source_text: str
    confidence: float
    method: str  # "REGEX" | "CONTEXT"


@dataclass
class ImageOCRInput:
    image_id: uuid.UUID
    raw_text: str
    ocr_confidence: float
    view_type: str


@dataclass
class ConflictCandidate:
    value: str
    source_image_id: uuid.UUID | None


@dataclass
class ExtractionResult:
    field_name: str
    value: str | None
    normalized_value: str | None
    confidence: float
    source_image_id: uuid.UUID | None
    source_text: str | None
    has_conflict: bool
    conflict_values: list[str]
    candidates: list[ConflictCandidate] = field(default_factory=list)
