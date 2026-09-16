"""Maps an extracted field's source text back to a pixel region on its
source image, so the UI can highlight exactly what the rule engine
read rather than only naming the source image (see
components/inspection/image-viewer.tsx's "Bounding box overlays ..."
placeholder on the frontend).
"""

from app.services.ocr.base import WordBox


def locate_bounding_box(
    *,
    words: list[WordBox],
    raw_text: str,
    source_text: str | None,
    image_width: int,
    image_height: int,
) -> dict | None:
    """Returns a normalized (0-1 fraction of image width/height) bounding
    box spanning every OCR word overlapping `source_text`'s position in
    `raw_text`, or None when it can't be located (no source text, no
    OCR word data for this image, or the text isn't found — e.g. a
    field derived by combining text from multiple images).
    """
    if not source_text or not words or image_width <= 0 or image_height <= 0:
        return None

    start = raw_text.find(source_text)
    if start < 0:
        return None
    end = start + len(source_text)

    matching = [w for w in words if w.start_char < end and w.end_char > start]
    if not matching:
        return None

    left = min(w.left for w in matching)
    top = min(w.top for w in matching)
    right = max(w.left + w.width for w in matching)
    bottom = max(w.top + w.height for w in matching)

    return {
        "x": max(0.0, min(1.0, left / image_width)),
        "y": max(0.0, min(1.0, top / image_height)),
        "width": max(0.0, min(1.0, (right - left) / image_width)),
        "height": max(0.0, min(1.0, (bottom - top) / image_height)),
    }
