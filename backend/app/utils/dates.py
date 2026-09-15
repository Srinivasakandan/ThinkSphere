"""Date parsing for Legal Metrology declarations (manufacturing / packing
/ best-before dates), which are almost always printed as month/year.

OCR frequently confuses visually similar characters (O/0, l/I/1, S/5,
B/8). Rather than silently "fixing" an ambiguous read, this module
surfaces it as `is_uncertain=True` so the field is routed to
NEEDS_REVIEW instead of being trusted outright.
"""

import re
from dataclasses import dataclass

_MONTH_NAMES = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}

# Characters OCR commonly confuses with digits, mapped to their likely
# intended digit.
_AMBIGUOUS_CHAR_MAP = {"O": "0", "o": "0", "I": "1", "l": "1", "S": "5", "B": "8"}

_NUMERIC_MM_YYYY = re.compile(r"\b(\d{1,2}|[OoIlSB0-9]{1,2})\s*[/\-.]\s*(\d{4}|[OoIlSB\d]{4})\b")
_MONTH_NAME_YYYY = re.compile(r"\b(" + "|".join(_MONTH_NAMES) + r")[a-z]*\.?\s+(\d{4})\b", re.IGNORECASE)


@dataclass
class ParsedDate:
    raw: str
    normalized: str | None  # "YYYY-MM"
    is_uncertain: bool
    uncertainty_reason: str | None
    confidence: float


def _has_ambiguous_chars(token: str) -> bool:
    return any(c in _AMBIGUOUS_CHAR_MAP for c in token)


def _resolve_ambiguous(token: str) -> str:
    return "".join(_AMBIGUOUS_CHAR_MAP.get(c, c) for c in token)


def parse_month_year(text: str) -> ParsedDate | None:
    """Find and parse the first month/year date in `text`, if any."""

    match = _NUMERIC_MM_YYYY.search(text)
    if match:
        month_token, year_token = match.group(1), match.group(2)
        raw = match.group(0)
        ambiguous = _has_ambiguous_chars(month_token) or _has_ambiguous_chars(year_token)

        month_str = _resolve_ambiguous(month_token)
        year_str = _resolve_ambiguous(year_token)

        try:
            month, year = int(month_str), int(year_str)
        except ValueError:
            return ParsedDate(
                raw=raw,
                normalized=None,
                is_uncertain=True,
                uncertainty_reason="Could not parse a valid month/year from the detected text.",
                confidence=0.2,
            )

        if not (1 <= month <= 12) or not (1990 <= year <= 2100):
            return ParsedDate(
                raw=raw,
                normalized=None,
                is_uncertain=True,
                uncertainty_reason="Detected value is outside a plausible date range.",
                confidence=0.2,
            )

        if ambiguous:
            return ParsedDate(
                raw=raw,
                normalized=f"{year:04d}-{month:02d}",
                is_uncertain=True,
                uncertainty_reason=(
                    "One or more characters could be an OCR misread "
                    "(e.g. 'O' for '0'). Please verify against the original image."
                ),
                confidence=0.35,
            )

        return ParsedDate(
            raw=raw,
            normalized=f"{year:04d}-{month:02d}",
            is_uncertain=False,
            uncertainty_reason=None,
            confidence=0.92,
        )

    name_match = _MONTH_NAME_YYYY.search(text)
    if name_match:
        month_name, year_str = name_match.group(1).lower(), name_match.group(2)
        month_number = _MONTH_NAMES.get(month_name)
        if month_number is None:
            return None
        return ParsedDate(
            raw=name_match.group(0),
            normalized=f"{int(year_str):04d}-{month_number:02d}",
            is_uncertain=False,
            uncertainty_reason=None,
            confidence=0.9,
        )

    return None


def format_month_year(normalized: str) -> str:
    """ "YYYY-MM" -> "MM/YYYY" for display."""

    year, month = normalized.split("-")
    return f"{month}/{year}"
