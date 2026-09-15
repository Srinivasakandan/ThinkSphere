"""MRP / currency value parsing."""

import re
from dataclasses import dataclass

_MONEY_PATTERN = re.compile(
    r"(?:₹|rs\.?|inr)\s*(\d+(?:[.,]\d{1,2})?)",
    re.IGNORECASE,
)


@dataclass
class ParsedMoney:
    raw: str
    amount: float
    normalized: str
    confidence: float


def parse_money(text: str) -> ParsedMoney | None:
    match = _MONEY_PATTERN.search(text)
    if not match:
        return None

    amount_str = match.group(1).replace(",", "")
    amount = float(amount_str)
    normalized = f"₹{amount:g}"

    return ParsedMoney(raw=match.group(0), amount=amount, normalized=normalized, confidence=0.9)
