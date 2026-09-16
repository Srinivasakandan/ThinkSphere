"""Image quality combination — app.services.processing_service._worse_quality.

Upload-time blur checks and OCR-confidence-based checks are two
independent signals for the same "was this image good enough" question;
neither should silently overwrite a worse finding from the other.
"""

from app.services.processing_service import _quality_for_confidence, _worse_quality


def test_worse_quality_prefers_poor_over_good():
    assert _worse_quality("POOR", "GOOD") == "POOR"
    assert _worse_quality("GOOD", "POOR") == "POOR"


def test_worse_quality_prefers_fair_over_good():
    assert _worse_quality("FAIR", "GOOD") == "FAIR"


def test_worse_quality_unknown_never_wins():
    assert _worse_quality("UNKNOWN", "FAIR") == "FAIR"
    assert _worse_quality("POOR", "UNKNOWN") == "POOR"


def test_quality_for_confidence_thresholds():
    assert _quality_for_confidence(0.95) == "GOOD"
    assert _quality_for_confidence(0.6) == "FAIR"
    assert _quality_for_confidence(0.1) == "POOR"
