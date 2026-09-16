"""OCR service factory — the only place that knows which concrete
engine is active.
"""

from functools import lru_cache

from app.core.config import Settings
from app.core.logging import get_logger
from app.services.ocr.base import OCRResultData, OCRService, WordBox
from app.services.ocr.local_ocr import MockOCRService, TesseractOCRService, UnavailableOCRService

__all__ = ["OCRResultData", "OCRService", "WordBox", "get_ocr_service"]

logger = get_logger(__name__)


@lru_cache
def _tesseract_binary_available() -> bool:
    try:
        import pytesseract

        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def get_ocr_service(settings: Settings) -> OCRService:
    provider = settings.ocr_provider.lower()

    if provider == "mock":
        return MockOCRService()

    if provider == "tesseract":
        return TesseractOCRService()

    # "auto" (the default): read whatever was actually photographed/scanned
    # when the real OCR engine is installed. When it isn't, report "no
    # text detected" (UnavailableOCRService) rather than start without
    # crashing but silently. MockOCRService's fabricated demo content is
    # reserved for OCR_PROVIDER=mock, an explicit, disclosed choice — an
    # unnoticed missing Tesseract install must never be indistinguishable
    # from a real, working extraction pipeline.
    if _tesseract_binary_available():
        return TesseractOCRService()

    logger.warning(
        "ocr_engine_unavailable",
        reason="tesseract binary not found on PATH — install tesseract-ocr for real OCR",
    )
    return UnavailableOCRService()
