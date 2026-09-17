"""OpenCV-based image preprocessing: auto-rotate, deskew, enhance.

Runs ahead of OCR so the extraction pipeline reads whatever the
inspector actually photographed or scanned rather than a raw, possibly
tilted or low-contrast capture. Every step is best-effort: if OpenCV
isn't installed or a step fails on a particular image, the original
bytes are returned unchanged rather than raising — a preprocessing
failure must degrade OCR confidence, never crash the pipeline (the same
contract as app.services.ocr.base.OCRService).
"""

import io
from dataclasses import dataclass

from PIL import Image, ImageOps

_MAX_DIMENSION = 2400  # upscaling/downscaling beyond this rarely helps Tesseract

# Laplacian variance is resolution-dependent (more pixels -> more edges
# by chance), so blur is always scored on a grayscale image resized to
# this fixed width — otherwise the same photo at two resolutions would
# get different quality grades.
_BLUR_RESIZE_WIDTH = 800
_BLUR_POOR_THRESHOLD = 60.0
_BLUR_FAIR_THRESHOLD = 150.0

# Shared, user-facing copy for any image graded POOR — whether that's
# from this module's blur score or from low OCR confidence
# (app.services.processing_service) — so the message an inspector sees
# is the same regardless of which check caught the problem.
POOR_IMAGE_QUALITY_NOTE = (
    "This image appears blurry or low quality. For reliable automatic extraction, "
    "retake or upload a clearer photo — or proceed and mark this item for manual inspection."
)


@dataclass
class BlurAssessment:
    variance: float  # Laplacian variance — higher means sharper
    quality: str  # "GOOD" | "FAIR" | "POOR" (mirrors app.models.enums.ImageQuality)


def _correct_exif_orientation(image: Image.Image) -> Image.Image:
    # Phone/scanner captures commonly carry an EXIF orientation tag rather
    # than storing pixels already rotated — apply it before any further
    # processing so "auto-rotate" matches what the inspector saw on screen.
    return ImageOps.exif_transpose(image) or image


def _deskew(gray) -> tuple:
    import cv2

    # Binarize (inverted so the label's text/print is foreground) and find
    # the minimum-area rectangle enclosing all foreground pixels — its
    # angle approximates the page/label skew for a fairly flat label photo.
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
    coords = cv2.findNonZero(thresh)
    if coords is None or len(coords) < 50:
        return gray, 0.0

    angle = cv2.minAreaRect(coords)[-1]
    angle = -(90 + angle) if angle < -45 else -angle

    # Small angles are OCR noise, not real skew — rotating on them would
    # hurt more than help.
    if abs(angle) < 0.5 or abs(angle) > 20:
        return gray, 0.0

    (h, w) = gray.shape[:2]
    center = (w // 2, h // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        gray, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )
    return rotated, angle


def compute_blur_score(image_bytes: bytes) -> BlurAssessment | None:
    """Scores how blurry an image is via Laplacian variance — the
    standard, well-tested "variance of edges" heuristic: a sharp photo
    has strong edges (high variance in the second derivative), a blurry
    one has soft, washed-out transitions (low variance).

    Runs on the image as originally captured, before any of this
    module's own denoising/enhancement — those steps would themselves
    soften edges and mask exactly the blur this is meant to detect.

    Returns None (no signal — never treat as "sharp") when OpenCV isn't
    installed or the image can't be decoded.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        return None

    try:
        with Image.open(io.BytesIO(image_bytes)) as pil_image:
            pil_image = _correct_exif_orientation(pil_image.convert("L"))
            gray = np.array(pil_image)
    except Exception:
        return None

    try:
        h, w = gray.shape[:2]
        if w > 0 and w != _BLUR_RESIZE_WIDTH:
            scale = _BLUR_RESIZE_WIDTH / w
            gray = cv2.resize(
                gray, (_BLUR_RESIZE_WIDTH, max(1, int(h * scale))), interpolation=cv2.INTER_AREA
            )
        variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    except Exception:
        return None

    if variance < _BLUR_POOR_THRESHOLD:
        quality = "POOR"
    elif variance < _BLUR_FAIR_THRESHOLD:
        quality = "FAIR"
    else:
        quality = "GOOD"
    return BlurAssessment(variance=variance, quality=quality)


def preprocess_for_ocr(image_bytes: bytes, mime_type: str) -> bytes:
    """Auto-rotate (EXIF), deskew, denoise and contrast-enhance an image
    for OCR. Returns the original bytes unchanged on any failure or when
    OpenCV isn't installed.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        return image_bytes

    try:
        with Image.open(io.BytesIO(image_bytes)) as pil_image:
            pil_image = _correct_exif_orientation(pil_image.convert("RGB"))
            rgb = np.array(pil_image)
    except Exception:
        return image_bytes

    try:
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

        h, w = bgr.shape[:2]
        longest = max(h, w)
        if longest > _MAX_DIMENSION:
            scale = _MAX_DIMENSION / longest
            bgr = cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        gray, _angle = _deskew(gray)

        # CLAHE improves local contrast on unevenly lit labels far more
        # than a global histogram equalization would.
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        denoised = cv2.fastNlMeansDenoising(enhanced, h=7)

        ok, encoded = cv2.imencode(".png", denoised)
        if not ok:
            return image_bytes
        return encoded.tobytes()
    except Exception:
        return image_bytes
