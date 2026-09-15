"""Confidence scoring helpers.

Confidence is a statement about extraction reliability, never about
legal compliance. A HIGH confidence MRP reading does not mean "the MRP
is legally correct" — only that the system is fairly sure it read the
printed value correctly.
"""

from app.models.enums import ConfidenceLevel

HIGH_THRESHOLD = 0.85
MEDIUM_THRESHOLD = 0.6


def level_for_score(score: float) -> ConfidenceLevel:
    if score >= HIGH_THRESHOLD:
        return ConfidenceLevel.HIGH
    if score >= MEDIUM_THRESHOLD:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW


def combine_scores(*scores: float) -> float:
    """Combine several independent confidence signals (e.g. OCR quality
    and pattern-match strength) into one score, conservatively.

    Uses the minimum rather than the average: a pipeline is only as
    confident as its weakest signal.
    """

    values = [s for s in scores if s is not None]
    if not values:
        return 0.0
    return max(0.0, min(1.0, min(values)))


def clamp(score: float) -> float:
    return max(0.0, min(1.0, score))
