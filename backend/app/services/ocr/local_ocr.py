"""Local OCR adapters.

`TesseractOCRService` runs real open-source OCR (Tesseract) when it is
installed — the preferred path for local development per the build
spec. `MockOCRService` needs no external engine at all and produces
deterministic, realistic packaged-commodity label text so the full
extraction/validation/rule pipeline can be exercised in demo mode —
used only when OCR_PROVIDER=mock is set explicitly, a disclosed,
deliberate developer choice. `UnavailableOCRService` is what OCR_PROVIDER
=auto (the default) falls back to instead when no real engine is
installed: it reports "no text detected" rather than ever inventing
plausible-looking label content, because unlike MockOCRService's caller
that choice wasn't disclosed or deliberate — fabricated brand names and
prices presented as real extraction results would be actively dangerous
in a compliance tool.
"""

import hashlib
import io
from dataclasses import dataclass

from app.services.imaging import preprocess_for_ocr
from app.services.ocr.base import OCRResultData, OCRService, WordBox


class TesseractUnavailableError(RuntimeError):
    """Raised when the tesseract binary itself (not just the pytesseract
    Python wrapper) cannot be found — distinct from a bad input image."""


class UnavailableOCRService(OCRService):
    """No real OCR engine could be found. Reports zero-confidence, empty
    text for every image — never invents plausible label content — so
    the pipeline correctly extracts nothing and routes every requirement
    to NEEDS_REVIEW rather than presenting fabricated values as findings.
    """

    async def process_image(
        self,
        image_bytes: bytes,
        *,
        mime_type: str,
        original_filename: str,
        view_type: str,
    ) -> OCRResultData:
        return OCRResultData(raw_text="", confidence=0.0, engine_available=False)


class TesseractOCRService(OCRService):
    """Real OCR via the Tesseract engine (python binding: pytesseract).

    Images are first run through OpenCV preprocessing (auto-rotate,
    deskew, contrast enhancement — app.services.imaging) so OCR reads
    the label as photographed, not a raw, possibly tilted capture.
    """

    async def process_image(
        self,
        image_bytes: bytes,
        *,
        mime_type: str,
        original_filename: str,
        view_type: str,
    ) -> OCRResultData:
        try:
            import pytesseract
            from PIL import Image
        except ImportError:
            return OCRResultData(raw_text="", confidence=0.0)

        preprocessed = preprocess_for_ocr(image_bytes, mime_type)

        try:
            image = Image.open(io.BytesIO(preprocessed))
            image.load()
        except Exception:
            # Not a readable image — surface as a zero-confidence result
            # rather than raising, so processing can route to NEEDS_REVIEW.
            return OCRResultData(raw_text="", confidence=0.0)

        try:
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
        except pytesseract.TesseractNotFoundError as exc:
            raise TesseractUnavailableError(
                "The tesseract-ocr binary is not installed or not on PATH."
            ) from exc

        raw_parts: list[str] = []
        words: list[WordBox] = []
        confidences: list[float] = []
        cursor = 0
        n = len(data.get("text", []))
        for i in range(n):
            text = data["text"][i].strip()
            if not text:
                continue
            if raw_parts:
                cursor += 1  # the joining space added below
            start = cursor
            raw_parts.append(text)
            cursor += len(text)
            words.append(
                WordBox(
                    text=text,
                    start_char=start,
                    end_char=cursor,
                    left=int(data["left"][i]),
                    top=int(data["top"][i]),
                    width=int(data["width"][i]),
                    height=int(data["height"][i]),
                )
            )
            conf = data.get("conf", [])[i] if i < len(data.get("conf", [])) else -1
            if conf not in ("-1", -1):
                confidences.append(float(conf))

        raw_text = " ".join(raw_parts)
        avg_conf = (sum(confidences) / len(confidences) / 100.0) if confidences else 0.0

        return OCRResultData(
            raw_text=raw_text,
            confidence=max(0.0, min(1.0, avg_conf)),
            words=words,
            image_width=image.width,
            image_height=image.height,
        )


@dataclass
class _MockLabel:
    text: str
    confidence: float


_FRONT_TEMPLATES = [
    "{brand}\n{product_name}\nNet Qty {net_qty}\nMRP {mrp} (incl. of all taxes)",
    "{product_name}\nby {brand}\nMaximum Retail Price: {mrp}\nNet Weight {net_qty}",
]
_BACK_TEMPLATES = [
    (
        "Ingredients: Wheat Flour, Sugar, Edible Vegetable Oil\n"
        "Manufactured by {brand} Industries Pvt Ltd, Mumbai, India\n"
        "Customer Care: 1800-{phone}\n"
        "Mfd: {mfg_date}\n"
        "Best Before 6 months from packaging"
    ),
    (
        "Marketed by {brand} Ltd.\n"
        "Consumer Complaints: 1800-{phone}\n"
        "Packed: {mfg_date}\n"
        "Country of Origin: India"
    ),
]

_SAMPLE_BRANDS = ["Britannia", "Nestle", "Amul", "Tata", "Parle"]
_SAMPLE_PRODUCTS = ["Marie Gold", "Good Day", "Classic Salted", "Digestive", "Hide & Seek"]


def _stable_hash(*parts: str) -> int:
    digest = hashlib.sha256("|".join(parts).encode()).hexdigest()
    return int(digest[:8], 16)


class MockOCRService(OCRService):
    """Deterministic mock OCR — same input always yields the same output,
    so repeated processing (idempotency) and tests are reproducible.
    """

    async def process_image(
        self,
        image_bytes: bytes,
        *,
        mime_type: str,
        original_filename: str,
        view_type: str,
    ) -> OCRResultData:
        seed = _stable_hash(original_filename, view_type, str(len(image_bytes)))

        brand = _SAMPLE_BRANDS[seed % len(_SAMPLE_BRANDS)]
        product_name = _SAMPLE_PRODUCTS[(seed // 7) % len(_SAMPLE_PRODUCTS)]
        net_qty = ["100 g", "150 g", "250 g", "500 g"][(seed // 11) % 4]
        mrp = f"₹{[10, 20, 30, 50, 99][(seed // 13) % 5]}"
        phone = f"{1000 + (seed % 8999):04d}"
        mfg_date = ["06/2026", "07/2026", "0" + "6/2O26", "11/2025"][(seed // 17) % 4]

        # A small, deterministic fraction of images simulate poor image
        # quality (garbled/low-confidence OCR) so NEEDS_REVIEW paths are
        # exercised without any manual test fixture wiring.
        is_poor_quality = seed % 5 == 4

        view = view_type.upper()
        if view in ("FRONT", "TOP"):
            template = _FRONT_TEMPLATES[seed % len(_FRONT_TEMPLATES)]
            text = template.format(brand=brand, product_name=product_name, net_qty=net_qty, mrp=mrp)
            base_confidence = 0.93
        elif view in ("BACK", "LEFT", "RIGHT", "BOTTOM"):
            template = _BACK_TEMPLATES[seed % len(_BACK_TEMPLATES)]
            text = template.format(brand=brand, phone=phone, mfg_date=mfg_date)
            base_confidence = 0.88
        else:
            text = f"{brand} {product_name}"
            base_confidence = 0.7

        if is_poor_quality:
            # Simulate degraded OCR: partial text, characters dropped.
            text = text[: max(10, len(text) // 3)] + " ...[illegible]"
            base_confidence = 0.28

        return OCRResultData(raw_text=text, confidence=base_confidence)
