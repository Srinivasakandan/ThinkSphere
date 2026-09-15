"""Extraction pipeline tests — spec sections 50-52."""

import uuid

from app.services.extraction.candidate import ImageOCRInput
from app.services.extraction.extractor import extract_product_information


def result_by_field(results, field_name):
    return next((r for r in results if r.field_name == field_name), None)


class TestBasicExtraction:
    SAMPLE_TEXT = (
        "MARIE GOLD\n"
        "NET QUANTITY 250 g\n"
        "MRP ₹50\n"
        "Manufactured by Britannia Industries Ltd.\n"
        "Customer Care: 1800-1234"
    )

    def test_extracts_all_expected_fields(self):
        image_id = uuid.uuid4()
        results = extract_product_information(
            [
                ImageOCRInput(
                    image_id=image_id,
                    raw_text=self.SAMPLE_TEXT,
                    ocr_confidence=0.9,
                    view_type="FRONT",
                )
            ]
        )

        mrp = result_by_field(results, "MRP")
        assert mrp is not None
        assert mrp.value == "₹50"

        qty = result_by_field(results, "NET_QUANTITY")
        assert qty is not None
        assert qty.normalized_value == "250 g"

        manufacturer = result_by_field(results, "MANUFACTURER")
        assert manufacturer is not None
        assert "Britannia" in manufacturer.value

        care = result_by_field(results, "CONSUMER_CARE")
        assert care is not None
        assert care.value == "1800-1234"


class TestMRPVariations:
    def _mrp_value(self, text: str) -> str | None:
        results = extract_product_information(
            [ImageOCRInput(image_id=uuid.uuid4(), raw_text=text, ocr_confidence=0.9, view_type="BACK")]
        )
        field = result_by_field(results, "MRP")
        return field.value if field else None

    def test_rs_dot(self):
        assert self._mrp_value("MRP Rs. 50") == "₹50"

    def test_colon_symbol(self):
        assert self._mrp_value("MRP: ₹50") == "₹50"

    def test_maximum_retail_price_phrase(self):
        assert self._mrp_value("Maximum Retail Price ₹50") == "₹50"


class TestNetQuantityVariations:
    def _qty(self, text: str) -> str | None:
        results = extract_product_information(
            [ImageOCRInput(image_id=uuid.uuid4(), raw_text=text, ocr_confidence=0.9, view_type="BACK")]
        )
        field = result_by_field(results, "NET_QUANTITY")
        return field.normalized_value if field else None

    def test_net_qty(self):
        assert self._qty("Net Qty 250g") == "250 g"

    def test_net_weight(self):
        assert self._qty("Net Wt. 250 g") == "250 g"


class TestConflictResolution:
    """Spec section 51: two images disagreeing on MRP must surface a
    conflict, never silently pick a winner."""

    def test_conflicting_mrp_across_images(self):
        image1, image2 = uuid.uuid4(), uuid.uuid4()
        results = extract_product_information(
            [
                ImageOCRInput(image_id=image1, raw_text="MRP ₹50", ocr_confidence=0.9, view_type="FRONT"),
                ImageOCRInput(image_id=image2, raw_text="MRP ₹55", ocr_confidence=0.9, view_type="BACK"),
            ]
        )
        mrp = result_by_field(results, "MRP")
        assert mrp is not None
        assert mrp.has_conflict is True
        assert set(mrp.conflict_values) == {"₹50", "₹55"}

    def test_identical_value_across_images_is_not_a_conflict(self):
        image1, image2 = uuid.uuid4(), uuid.uuid4()
        results = extract_product_information(
            [
                ImageOCRInput(image_id=image1, raw_text="MRP ₹50", ocr_confidence=0.9, view_type="FRONT"),
                ImageOCRInput(image_id=image2, raw_text="MRP ₹50", ocr_confidence=0.9, view_type="BACK"),
            ]
        )
        mrp = result_by_field(results, "MRP")
        assert mrp is not None
        assert mrp.has_conflict is False
        # Corroboration across two images should not reduce confidence.
        assert mrp.confidence >= 0.9


class TestLowQuality:
    """Spec section 52: unreadable/low-quality OCR must degrade
    confidence, never fabricate a confident-looking value."""

    def test_low_ocr_confidence_propagates_to_field_confidence(self):
        image_id = uuid.uuid4()
        results = extract_product_information(
            [ImageOCRInput(image_id=image_id, raw_text="MRP ₹50", ocr_confidence=0.15, view_type="FRONT")]
        )
        mrp = result_by_field(results, "MRP")
        assert mrp is not None
        assert mrp.confidence <= 0.3

    def test_empty_text_yields_no_candidates(self):
        results = extract_product_information(
            [ImageOCRInput(image_id=uuid.uuid4(), raw_text="", ocr_confidence=0.1, view_type="FRONT")]
        )
        assert results == []


class TestMultiImageContext:
    """A declaration on one image and another on a different image must
    both be captured — extraction always runs across the whole
    inspection, never a single image in isolation (spec section 14)."""

    def test_front_and_back_declarations_combine(self):
        front_id, back_id = uuid.uuid4(), uuid.uuid4()
        results = extract_product_information(
            [
                ImageOCRInput(image_id=front_id, raw_text="MRP ₹50", ocr_confidence=0.9, view_type="FRONT"),
                ImageOCRInput(
                    image_id=back_id,
                    raw_text="Customer Care: 1800-5555",
                    ocr_confidence=0.9,
                    view_type="BACK",
                ),
            ]
        )
        assert result_by_field(results, "MRP") is not None
        assert result_by_field(results, "CONSUMER_CARE") is not None
