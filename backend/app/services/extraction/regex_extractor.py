"""Regex-based extraction for predictable, pattern-shaped declarations.

Every extractor here is *content*-based: it looks for a value shaped
like an MRP/date/phone number and then checks the surrounding text for
a confirming keyword (e.g. "MRP", "Net Qty", "Customer Care"). A bare
number is never assumed to be an MRP just because of its position on
the package (see spec section 12) — the confidence score instead
reflects how strong that contextual confirmation is.
"""

import re
import uuid

from app.services.extraction.candidate import ExtractionCandidate
from app.services.extraction.fields import (
    BATCH_NUMBER,
    BEST_BEFORE,
    CONSUMER_CARE,
    COUNTRY_OF_ORIGIN,
    MANUFACTURING_DATE,
    MRP,
    NET_QUANTITY,
    PACKING_DATE,
)
from app.utils.dates import parse_month_year
from app.utils.money import parse_money
from app.utils.quantities import parse_quantity

_CONTEXT_WINDOW = 28

_MRP_KEYWORDS = ("mrp", "maximum retail price")
_NET_QTY_KEYWORDS = ("net qty", "net quantity", "net wt", "net weight", "net vol", "net content")
_MFG_KEYWORDS = ("mfd", "manufactured", "mfg date", "manufacturing date", "packed on")
_PACKING_KEYWORDS = ("pkd", "packing date", "packed:", "packed ")
_BEST_BEFORE_KEYWORDS = ("best before", "use before", "expiry", "exp date")
_CARE_KEYWORDS = ("customer care", "consumer care", "consumer complaints", "care no")
_COUNTRY_KEYWORDS = ("country of origin", "made in", "product of")

_PHONE_PATTERN = re.compile(r"\b(1800[-\s]?\d{3,4}(?:[-\s]?\d{3,4})?)\b")
_BATCH_PATTERN = re.compile(
    r"(?:batch\s*(?:no\.?|number)?|b\.?\s*no\.?|lot\s*(?:no\.?|number)?)\s*[:#]?\s*([A-Z0-9\-]{3,20})",
    re.IGNORECASE,
)
_COUNTRY_PATTERN = re.compile(
    r"(?:country of origin|made in|product of)\s*[:\-]?\s*([A-Z][a-zA-Z]{2,20})",
    re.IGNORECASE,
)


def _has_nearby_keyword(text: str, start: int, keywords: tuple[str, ...]) -> bool:
    window = text[max(0, start - _CONTEXT_WINDOW) : start].lower()
    return any(kw in window for kw in keywords)


def extract(text: str, source_image_id: uuid.UUID) -> list[ExtractionCandidate]:
    candidates: list[ExtractionCandidate] = []

    money = parse_money(text)
    if money:
        start = text.find(money.raw)
        has_context = start >= 0 and _has_nearby_keyword(text, start, _MRP_KEYWORDS)
        confidence = money.confidence if has_context else money.confidence - 0.2
        candidates.append(
            ExtractionCandidate(
                field_name=MRP,
                value=money.normalized,
                normalized_value=money.normalized,
                source_image_id=source_image_id,
                source_text=money.raw,
                confidence=max(0.3, min(1.0, confidence)),
                method="REGEX",
            )
        )

    quantity = parse_quantity(text)
    if quantity:
        start = text.find(quantity.raw)
        has_context = start >= 0 and _has_nearby_keyword(text, start, _NET_QTY_KEYWORDS)
        confidence = quantity.confidence if has_context else quantity.confidence - 0.25
        candidates.append(
            ExtractionCandidate(
                field_name=NET_QUANTITY,
                value=quantity.normalized,
                normalized_value=quantity.normalized,
                source_image_id=source_image_id,
                source_text=quantity.raw,
                confidence=max(0.25, min(1.0, confidence)),
                method="REGEX",
            )
        )

    date_result = parse_month_year(text)
    if date_result:
        start = text.find(date_result.raw)
        window_text = text[max(0, start - _CONTEXT_WINDOW) : start].lower() if start >= 0 else ""
        if any(kw in window_text for kw in _PACKING_KEYWORDS):
            field_name = PACKING_DATE
        elif any(kw in window_text for kw in _BEST_BEFORE_KEYWORDS):
            field_name = BEST_BEFORE
        else:
            field_name = MANUFACTURING_DATE  # default assumption per spec section 16

        confidence = date_result.confidence
        if date_result.is_uncertain:
            confidence = min(confidence, 0.4)

        candidates.append(
            ExtractionCandidate(
                field_name=field_name,
                value=date_result.raw,
                normalized_value=date_result.normalized,
                source_image_id=source_image_id,
                source_text=date_result.raw,
                confidence=confidence,
                method="REGEX",
            )
        )

    phone_match = _PHONE_PATTERN.search(text)
    if phone_match:
        phone_value = phone_match.group(1).strip()
        has_context = _has_nearby_keyword(text, phone_match.start(), _CARE_KEYWORDS)
        candidates.append(
            ExtractionCandidate(
                field_name=CONSUMER_CARE,
                value=phone_value,
                normalized_value=phone_value,
                source_image_id=source_image_id,
                source_text=phone_match.group(0),
                confidence=0.85 if has_context else 0.55,
                method="REGEX",
            )
        )

    batch_match = _BATCH_PATTERN.search(text)
    if batch_match:
        candidates.append(
            ExtractionCandidate(
                field_name=BATCH_NUMBER,
                value=batch_match.group(1),
                normalized_value=batch_match.group(1).upper(),
                source_image_id=source_image_id,
                source_text=batch_match.group(0),
                confidence=0.8,
                method="REGEX",
            )
        )

    country_match = _COUNTRY_PATTERN.search(text)
    if country_match:
        candidates.append(
            ExtractionCandidate(
                field_name=COUNTRY_OF_ORIGIN,
                value=country_match.group(1).strip(),
                normalized_value=country_match.group(1).strip().title(),
                source_image_id=source_image_id,
                source_text=country_match.group(0),
                confidence=0.8,
                method="REGEX",
            )
        )

    return candidates
