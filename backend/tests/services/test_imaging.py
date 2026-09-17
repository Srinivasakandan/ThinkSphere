"""Blur/quality scoring — app.services.imaging.preprocess.compute_blur_score."""

import io

from PIL import Image, ImageDraw, ImageFilter

from app.services.imaging import compute_blur_score
from app.services.imaging.preprocess import BlurAssessment


def _label_image(blur_radius: float = 0.0) -> bytes:
    img = Image.new("RGB", (800, 400), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    for y in range(0, 400, 8):
        draw.line([(0, y), (800, y)], fill=(0, 0, 0), width=2)
    if blur_radius:
        img = img.filter(ImageFilter.GaussianBlur(blur_radius))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_sharp_image_scores_good() -> None:
    result = compute_blur_score(_label_image(blur_radius=0))
    assert isinstance(result, BlurAssessment)
    assert result.quality == "GOOD"


def test_heavily_blurred_image_scores_poor() -> None:
    result = compute_blur_score(_label_image(blur_radius=6))
    assert isinstance(result, BlurAssessment)
    assert result.quality == "POOR"


def test_unreadable_bytes_return_none() -> None:
    assert compute_blur_score(b"not an image") is None
