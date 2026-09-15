"""OCR service factory — the only place that knows which concrete
engine is active.
"""

from app.core.config import Settings
from app.services.ocr.base import OCRResultData, OCRService
from app.services.ocr.local_ocr import MockOCRService, TesseractOCRService

__all__ = ["OCRResultData", "OCRService", "get_ocr_service"]


def get_ocr_service(settings: Settings) -> OCRService:
    if settings.ocr_provider.lower() == "tesseract":
        return TesseractOCRService()
    return MockOCRService()
