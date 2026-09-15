"""OCR service abstraction.

Nothing outside this package should import a concrete OCR engine
directly. Swapping engines (mock -> Tesseract -> a commercial API) means
adding one adapter here and pointing `OCR_PROVIDER` at it — no other
code changes.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class OCRResultData:
    raw_text: str
    confidence: float  # 0.0-1.0, OCR engine confidence — not compliance.


class OCRService(ABC):
    @abstractmethod
    async def process_image(
        self,
        image_bytes: bytes,
        *,
        mime_type: str,
        original_filename: str,
        view_type: str,
    ) -> OCRResultData:
        """Extract raw text from a single image. Implementations must not
        raise for a low-quality/unreadable image — they should instead
        return a low-confidence, possibly empty, result so the pipeline
        can route the inspection to NEEDS_REVIEW rather than crash.
        """
        raise NotImplementedError
