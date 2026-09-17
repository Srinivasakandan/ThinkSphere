"""OCR provider selection must never let a missing engine masquerade as
a working one: OCR_PROVIDER=auto without Tesseract installed must
report "no text detected", never invent plausible label content.
"""

from app.core.config import Settings
from app.services import ocr as ocr_module
from app.services.ocr import get_ocr_service
from app.services.ocr.local_ocr import MockOCRService, TesseractOCRService, UnavailableOCRService


async def test_unavailable_ocr_service_reports_no_text_and_zero_confidence():
    result = await UnavailableOCRService().process_image(
        b"irrelevant", mime_type="image/png", original_filename="x.png", view_type="FRONT"
    )
    assert result.raw_text == ""
    assert result.confidence == 0.0
    assert result.engine_available is False


def test_explicit_mock_provider_uses_mock_service():
    assert isinstance(get_ocr_service(Settings(ocr_provider="mock")), MockOCRService)


def test_explicit_tesseract_provider_uses_tesseract_service():
    assert isinstance(get_ocr_service(Settings(ocr_provider="tesseract")), TesseractOCRService)


def test_auto_provider_falls_back_to_unavailable_not_mock(monkeypatch):
    """The regression this guards against: auto mode used to silently
    fall back to MockOCRService's fabricated demo brand/price text when
    Tesseract wasn't installed, indistinguishable from a real result."""
    monkeypatch.setattr(ocr_module, "_tesseract_binary_available", lambda: False)
    service = get_ocr_service(Settings(ocr_provider="auto"))
    assert isinstance(service, UnavailableOCRService)
    assert not isinstance(service, MockOCRService)


def test_auto_provider_uses_tesseract_when_available(monkeypatch):
    monkeypatch.setattr(ocr_module, "_tesseract_binary_available", lambda: True)
    assert isinstance(get_ocr_service(Settings(ocr_provider="auto")), TesseractOCRService)
