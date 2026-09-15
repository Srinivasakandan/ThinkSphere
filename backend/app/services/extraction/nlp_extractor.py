"""Context-based extraction.

Identifies declarations by keyword/context rather than fixed position —
"Manufactured by", "Marketed by", "Packed by", "Imported by" and the
first line of a front-view image (a common but *not guaranteed*
position for the product name). This module is a clean seam for
swapping in a real NLP/LLM adapter later: only `extract()`'s
implementation would change, not its callers or return type.
"""

import re
import uuid

from app.services.extraction.candidate import ExtractionCandidate
from app.services.extraction.fields import BRAND, IMPORTER, MANUFACTURER, PRODUCT_NAME

_MANUFACTURER_PATTERN = re.compile(
    r"(?:manufactured by|packed by|mfd by)\s+([A-Z][\w&.,'\- ]{2,80}?)(?:[.\n]|,\s*(?:mumbai|delhi|india)|$)",
    re.IGNORECASE,
)
_MARKETED_BY_PATTERN = re.compile(
    r"marketed by\s+([A-Z][\w&.,'\- ]{2,80}?)(?:[.\n]|,\s*(?:mumbai|delhi|india)|$)", re.IGNORECASE
)
_IMPORTED_BY_PATTERN = re.compile(
    r"imported by\s+([A-Z][\w&.,'\- ]{2,80}?)(?:[.\n]|,\s*(?:mumbai|delhi|india)|$)", re.IGNORECASE
)
_BY_LINE_PATTERN = re.compile(r"^by\s+(.+)$", re.IGNORECASE)


def _clean(value: str) -> str:
    return value.strip(" .,")


def extract(text: str, source_image_id: uuid.UUID, view_type: str) -> list[ExtractionCandidate]:
    candidates: list[ExtractionCandidate] = []

    manufacturer_match = _MANUFACTURER_PATTERN.search(text)
    if manufacturer_match:
        value = _clean(manufacturer_match.group(1))
        candidates.append(
            ExtractionCandidate(
                field_name=MANUFACTURER,
                value=value,
                normalized_value=value,
                source_image_id=source_image_id,
                source_text=manufacturer_match.group(0),
                confidence=0.85,
                method="CONTEXT",
            )
        )
    else:
        marketed_match = _MARKETED_BY_PATTERN.search(text)
        if marketed_match:
            value = _clean(marketed_match.group(1))
            candidates.append(
                ExtractionCandidate(
                    field_name=MANUFACTURER,
                    value=value,
                    normalized_value=value,
                    source_image_id=source_image_id,
                    source_text=marketed_match.group(0),
                    confidence=0.6,
                    method="CONTEXT",
                )
            )

    importer_match = _IMPORTED_BY_PATTERN.search(text)
    if importer_match:
        value = _clean(importer_match.group(1))
        candidates.append(
            ExtractionCandidate(
                field_name=IMPORTER,
                value=value,
                normalized_value=value,
                source_image_id=source_image_id,
                source_text=importer_match.group(0),
                confidence=0.85,
                method="CONTEXT",
            )
        )

    if view_type.upper() in ("FRONT", "TOP"):
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        for idx, line in enumerate(lines):
            by_match = _BY_LINE_PATTERN.match(line)
            if by_match:
                brand_value = _clean(by_match.group(1))
                candidates.append(
                    ExtractionCandidate(
                        field_name=BRAND,
                        value=brand_value,
                        normalized_value=brand_value,
                        source_image_id=source_image_id,
                        source_text=line,
                        confidence=0.75,
                        method="CONTEXT",
                    )
                )
                if idx > 0:
                    product_line = lines[idx - 1]
                    candidates.append(
                        ExtractionCandidate(
                            field_name=PRODUCT_NAME,
                            value=product_line,
                            normalized_value=product_line,
                            source_image_id=source_image_id,
                            source_text=product_line,
                            confidence=0.65,
                            method="CONTEXT",
                        )
                    )
                break
        else:
            if lines:
                candidates.append(
                    ExtractionCandidate(
                        field_name=PRODUCT_NAME,
                        value=lines[0],
                        normalized_value=lines[0],
                        source_image_id=source_image_id,
                        source_text=lines[0],
                        confidence=0.5,
                        method="CONTEXT",
                    )
                )

    return candidates
