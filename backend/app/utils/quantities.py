"""Net-quantity parsing: weight, volume, length or count declarations."""

import re
from dataclasses import dataclass

_UNIT_ALIASES = {
    "g": "g",
    "gm": "g",
    "gms": "g",
    "gram": "g",
    "grams": "g",
    "kg": "kg",
    "kgs": "kg",
    "kilogram": "kg",
    "kilograms": "kg",
    "mg": "mg",
    "ml": "ml",
    "mls": "ml",
    "millilitre": "ml",
    "milliliter": "ml",
    "l": "L",
    "ltr": "L",
    "ltrs": "L",
    "litre": "L",
    "liter": "L",
    "litres": "L",
    "cm": "cm",
    "mm": "mm",
    "m": "m",
    "unit": "unit",
    "units": "unit",
    "pc": "unit",
    "pcs": "unit",
    "piece": "unit",
    "pieces": "unit",
    "n": "unit",
}

_QUANTITY_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(kgs?|gms?|grams?|kilograms?|mgs?|mls?|litres?|liters?|ltrs?|l|g|cm|mm|m|units?|pieces?|pcs?)\b",
    re.IGNORECASE,
)


@dataclass
class ParsedQuantity:
    raw: str
    amount: float
    unit: str
    normalized: str
    confidence: float


def parse_quantity(text: str) -> ParsedQuantity | None:
    match = _QUANTITY_PATTERN.search(text)
    if not match:
        return None

    amount_str, unit_token = match.groups()
    unit = _UNIT_ALIASES.get(unit_token.lower())
    if unit is None:
        return None

    amount = float(amount_str)
    normalized = f"{amount:g} {unit}"

    return ParsedQuantity(raw=match.group(0), amount=amount, unit=unit, normalized=normalized, confidence=0.9)
