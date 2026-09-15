#!/usr/bin/env python
"""Seed the database with demo data: inspectors, the demo rules
repository, and several inspections covering PASS, POTENTIAL_NON_COMPLIANCE
and NEEDS_REVIEW outcomes.

All rules inserted here are marked `is_demo=True` and clearly labeled as
DEMO DATA — they are schema/sample content, not verified Legal
Metrology legal text. Run with:

    python scripts/seed.py
"""

import asyncio
import io
import sys
import uuid
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image as PILImage  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.enums import (  # noqa: E402
    ConfidenceLevel,
    ImageQuality,
    InspectionStage,
    RuleConditionType,
    UserRole,
    ValidationStatus,
)
from app.models.extracted_field import ExtractedField  # noqa: E402
from app.models.inspection import Inspection  # noqa: E402
from app.models.ocr_result import OCRResult  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.product_image import ProductImage  # noqa: E402
from app.models.rule import Rule  # noqa: E402
from app.models.rule_result import RuleResult  # noqa: E402
from app.models.user import Inspector  # noqa: E402
from app.repositories import inspection_repository, rule_repository  # noqa: E402
from app.services.storage import get_storage_service  # noqa: E402

DEMO_SOURCE = (
    "DEMO DATA — Legal Metrology (Packaged Commodities) Rules, 2011 "
    "(sample only, not verified against authoritative legal text)"
)

INSPECTOR_A = uuid.UUID("00000000-0000-0000-0000-000000000001")
INSPECTOR_B = uuid.UUID("00000000-0000-0000-0000-000000000002")


def _placeholder_png(label: str, seed: int) -> bytes:
    hue = (seed * 47) % 255
    img = PILImage.new("RGB", (400, 500), color=(hue, 200, 220))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def seed_inspectors(db: Session) -> None:
    inspectors = [
        Inspector(
            id=INSPECTOR_A,
            email="arjun.mehta@legalmetrology.gov.in",
            full_name="Arjun Mehta",
            role=UserRole.INSPECTOR.value,
            badge_id="LM-INS-1042",
        ),
        Inspector(
            id=INSPECTOR_B,
            email="priya.nair@legalmetrology.gov.in",
            full_name="Priya Nair",
            role=UserRole.SUPERVISOR.value,
            badge_id="LM-SUP-0231",
        ),
    ]
    for inspector in inspectors:
        existing = db.get(Inspector, inspector.id)
        if existing is None:
            db.add(inspector)
    db.commit()


def seed_rules(db: Session) -> list[Rule]:
    rules_data = [
        dict(
            rule_code="R001",
            title="MRP Declaration",
            field_name="MRP",
            description="Retail sale price (MRP) inclusive of all taxes must be declared.",
            category="MRP Declaration",
            condition_type=RuleConditionType.REQUIRED.value,
        ),
        dict(
            rule_code="R002",
            title="Net Quantity",
            field_name="NET_QUANTITY",
            description="Net quantity of the commodity must be declared in standard units.",
            category="Net Quantity",
            condition_type=RuleConditionType.REQUIRED.value,
        ),
        dict(
            rule_code="R003",
            title="Manufacturer Details",
            field_name="MANUFACTURER",
            description="Name and address of the manufacturer/packer/importer must be declared.",
            category="Manufacturer Details",
            condition_type=RuleConditionType.REQUIRED.value,
        ),
        dict(
            rule_code="R004",
            title="Consumer Care",
            field_name="CONSUMER_CARE",
            description="Consumer care contact details must be declared.",
            category="Consumer Care",
            condition_type=RuleConditionType.REQUIRED.value,
        ),
        dict(
            rule_code="R005",
            title="Manufacturing Date",
            field_name="MANUFACTURING_DATE",
            description="Month and year of manufacture or packing must be declared.",
            category="Manufacturing Date",
            condition_type=RuleConditionType.DATE.value,
        ),
        dict(
            rule_code="R006",
            title="Country of Origin",
            field_name="COUNTRY_OF_ORIGIN",
            description="Country of origin must be declared for imported packages.",
            category="Country of Origin",
            condition_type=RuleConditionType.CONDITIONAL.value,
            expected_value="IMPORTER:present",
            applicable_category="Imported Packaged Commodity",
        ),
        dict(
            rule_code="R007",
            title="Unit Sale Price",
            field_name="UNIT_SALE_PRICE",
            description="Unit sale price must be declared where applicable.",
            category="Unit Sale Price",
            condition_type=RuleConditionType.OPTIONAL.value,
        ),
        dict(
            rule_code="R008",
            title="Generic / Product Name",
            field_name="PRODUCT_NAME",
            description="Common or generic name of the commodity must be declared.",
            category="Generic Name",
            condition_type=RuleConditionType.REQUIRED.value,
        ),
        dict(
            rule_code="R009",
            title="Batch/Lot Number",
            field_name="BATCH_NUMBER",
            description="Batch or lot number should be declared where applicable.",
            category="Batch Number",
            condition_type=RuleConditionType.OPTIONAL.value,
        ),
        dict(
            rule_code="R011",
            title="Declaration Legibility",
            field_name="LEGIBILITY",
            description="Mandatory declarations must be legible and conspicuous.",
            category="Declaration Legibility",
            condition_type=RuleConditionType.MANUAL_REVIEW.value,
        ),
        dict(
            rule_code="R012",
            title="Best Before / Expiry",
            field_name="BEST_BEFORE",
            description="Best before or expiry date must be declared for time-sensitive commodities.",
            category="Best Before / Expiry",
            condition_type=RuleConditionType.DATE.value,
            applicable_category="Food & Beverage",
        ),
    ]

    rules = []
    for data in rules_data:
        data.setdefault("applicable_category", "Packaged Commodity")
        rule = rule_repository.upsert_by_code(
            db,
            rule_code=data.pop("rule_code"),
            data={
                **data,
                "legal_source": DEMO_SOURCE,
                "version": "demo-1.0",
                "effective_from": date(2011, 11, 14),
                "active": True,
                "is_demo": True,
            },
        )
        rules.append(rule)
    db.commit()
    return rules


@dataclass
class DemoField:
    field_name: str
    value: str | None
    confidence: float
    validation_status: str = ValidationStatus.VALID.value
    manually_verified: bool = False
    source_view: str | None = None


@dataclass
class DemoInspection:
    product_name: str
    brand: str
    category: str
    batch_number: str
    location: str
    inspector_id: uuid.UUID
    finalized: bool
    fields: list[DemoField] = field(default_factory=list)
    views: list[str] = field(default_factory=lambda: ["FRONT", "BACK"])


DEMO_INSPECTIONS = [
    DemoInspection(
        product_name="Marie Gold",
        brand="Britannia",
        category="Food",
        batch_number="BSC-22841",
        location="Andheri West, Mumbai",
        inspector_id=INSPECTOR_A,
        finalized=True,
        views=["FRONT", "BACK"],
        fields=[
            DemoField("PRODUCT_NAME", "Marie Gold", 0.95, source_view="FRONT"),
            DemoField("MRP", "₹50", 0.93, source_view="FRONT"),
            DemoField("NET_QUANTITY", "250 g", 0.92, source_view="BACK"),
            DemoField("MANUFACTURER", "Britannia Industries Ltd", 0.9, source_view="BACK"),
            DemoField("CONSUMER_CARE", "1800-121-6551", 0.88, source_view="BACK"),
            DemoField("MANUFACTURING_DATE", "2026-04", 0.9, source_view="BACK"),
        ],
    ),
    DemoInspection(
        product_name="Fortune Sunlite Refined Sunflower Oil",
        brand="Adani Wilmar",
        category="Food",
        batch_number="OIL-11298",
        location="Dadar, Mumbai",
        inspector_id=INSPECTOR_A,
        finalized=False,
        views=["FRONT", "BACK"],
        fields=[
            DemoField("PRODUCT_NAME", "Sunlite Refined Sunflower Oil", 0.9, source_view="FRONT"),
            DemoField("MRP", "₹185", 0.92, source_view="FRONT"),
            DemoField("NET_QUANTITY", "1 L", 0.91, source_view="FRONT"),
            DemoField("MANUFACTURER", "Adani Wilmar Ltd", 0.75, source_view="BACK"),
            # Consumer care intentionally absent -> POTENTIAL_NON_COMPLIANCE.
        ],
    ),
    DemoInspection(
        product_name="Dettol Original Soap",
        brand="Reckitt",
        category="Personal Care",
        batch_number="PC-55210",
        location="Powai, Mumbai",
        inspector_id=INSPECTOR_A,
        finalized=False,
        views=["FRONT", "BACK"],
        fields=[
            DemoField("PRODUCT_NAME", "Dettol Original Soap", 0.9, source_view="FRONT"),
            DemoField("MRP", "₹45", 0.9, source_view="FRONT"),
            DemoField("NET_QUANTITY", "75 g", 0.88, source_view="FRONT"),
            DemoField("MANUFACTURER", "Reckitt Benckiser (India) Pvt Ltd", 0.87, source_view="BACK"),
            DemoField("CONSUMER_CARE", "1800-419-5000", 0.85, source_view="BACK"),
            # Manufacturing date OCR is ambiguous ("O" could be "0") — the
            # only uncertain declaration, so this inspection is a clean
            # NEEDS_REVIEW example with no potential non-compliance.
            DemoField(
                "MANUFACTURING_DATE",
                "06/2O26",
                0.35,
                ValidationStatus.NEEDS_REVIEW.value,
                source_view="BACK",
            ),
        ],
    ),
    DemoInspection(
        product_name="Amul Taaza Toned Milk",
        brand="Amul",
        category="Beverage",
        batch_number="BEV-88213",
        location="Vikhroli, Mumbai",
        inspector_id=INSPECTOR_B,
        finalized=True,
        views=["FRONT", "BACK"],
        fields=[
            DemoField("PRODUCT_NAME", "Amul Taaza Toned Milk", 0.93, source_view="FRONT"),
            DemoField("MRP", "₹33", 0.93, source_view="FRONT"),
            DemoField("NET_QUANTITY", "500 ml", 0.92, source_view="FRONT"),
            DemoField(
                "MANUFACTURER",
                "Gujarat Cooperative Milk Marketing Federation",
                0.85,
                source_view="BACK",
            ),
            DemoField("BEST_BEFORE", "2026-09", 0.85, source_view="BACK"),
        ],
    ),
    DemoInspection(
        product_name="Colgate Strong Teeth Toothpaste",
        brand="Colgate-Palmolive",
        category="Personal Care",
        batch_number="PC-60932",
        location="Malad West, Mumbai",
        inspector_id=INSPECTOR_B,
        finalized=False,
        views=["FRONT", "BACK"],
        fields=[
            DemoField("PRODUCT_NAME", "Colgate Strong Teeth", 0.91, source_view="FRONT"),
            DemoField("MRP", "₹99", 0.9, source_view="FRONT"),
            DemoField("NET_QUANTITY", "150 g", 0.89, source_view="FRONT"),
            DemoField("MANUFACTURER", "Colgate-Palmolive (India) Ltd", 0.8, source_view="BACK"),
            DemoField("MANUFACTURING_DATE", "2025-11", 0.7, source_view="BACK"),
            # Consumer care absent, but generally reliable extraction -> POTENTIAL_NON_COMPLIANCE
        ],
    ),
]


async def _seed_one(db: Session, storage, spec: DemoInspection) -> None:
    inspection = Inspection(
        inspector_id=spec.inspector_id,
        stage=InspectionStage.CREATED.value,
    )
    db.add(inspection)
    db.flush()

    db.add(
        Product(
            inspection_id=inspection.id,
            product_name=spec.product_name,
            brand=spec.brand,
            category=spec.category,
            batch_number=spec.batch_number,
        )
    )
    inspection.inspection_location = spec.location
    db.flush()

    images_by_view: dict[str, ProductImage] = {}
    for idx, view in enumerate(spec.views):
        content = _placeholder_png(spec.product_name, idx)
        path = f"inspections/{inspection.id}/{uuid.uuid4()}/original.png"
        await storage.upload_file(path=path, content=content, content_type="image/png")
        image = ProductImage(
            inspection_id=inspection.id,
            storage_path=path,
            original_filename=f"{view.lower()}.png",
            view_type=view,
            mime_type="image/png",
            file_size=len(content),
            image_quality=ImageQuality.GOOD.value,
            processing_status="PROCESSED",
        )
        db.add(image)
        db.flush()
        db.add(
            OCRResult(
                image_id=image.id,
                raw_text=f"[demo OCR text for {spec.product_name} {view}]",
                ocr_confidence=0.9,
            )
        )
        images_by_view[view] = image

    inspection.stage = InspectionStage.OCR_COMPLETED.value
    db.flush()

    field_rows: dict[str, ExtractedField] = {}
    for demo_field in spec.fields:
        source_image = images_by_view.get(demo_field.source_view) if demo_field.source_view else None
        ef = ExtractedField(
            inspection_id=inspection.id,
            field_name=demo_field.field_name,
            value=demo_field.value,
            normalized_value=demo_field.value,
            confidence=demo_field.confidence,
            confidence_level=(
                ConfidenceLevel.HIGH.value
                if demo_field.confidence >= 0.85
                else (
                    ConfidenceLevel.MEDIUM.value
                    if demo_field.confidence >= 0.6
                    else ConfidenceLevel.LOW.value
                )
            ),
            validation_status=demo_field.validation_status,
            source_image_id=source_image.id if source_image else None,
            manually_verified=demo_field.manually_verified,
        )
        db.add(ef)
        field_rows[demo_field.field_name] = ef
    inspection.stage = InspectionStage.VALIDATION_COMPLETED.value
    db.flush()

    from app.services.rules.context import FieldSnapshot, RuleEvaluationInput
    from app.services.rules.rule_engine import evaluate_all
    from app.services.rules.rule_selector import select_applicable_rules
    from app.services.rules.status import calculate_overall_status

    applicable = select_applicable_rules(db, category=spec.category)
    fields_by_name = {
        name: FieldSnapshot(
            field_name=name,
            value=ef.value,
            normalized_value=ef.normalized_value,
            confidence=ef.confidence,
            validation_status=ValidationStatus(ef.validation_status),
            source_image_id=ef.source_image_id,
            manually_verified=ef.manually_verified,
        )
        for name, ef in field_rows.items()
    }
    context = RuleEvaluationInput(fields_by_name=fields_by_name, extraction_reliable=True)
    evaluations = evaluate_all(applicable, context)

    final_statuses = []
    for rule, outcome in evaluations:
        status_value = outcome.status
        reason = outcome.reason
        if spec.finalized and status_value == "NEEDS_REVIEW":
            # Mirrors review_service: confirming a NEEDS_REVIEW finding
            # (no correction needed) resolves it to PASS.
            status_value = "PASS"
            reason = "Reviewed and confirmed correct by the inspector."
        final_statuses.append(status_value)
        db.add(
            RuleResult(
                inspection_id=inspection.id,
                rule_id=rule.id,
                field_name=rule.field_name,
                detected_value=outcome.detected_value,
                status=status_value,
                reason=reason,
                confidence=outcome.confidence,
                evidence_image_id=outcome.evidence_image_id,
                reviewed=spec.finalized,
                reviewer_id=spec.inspector_id if spec.finalized else None,
            )
        )

    inspection.overall_status = calculate_overall_status(final_statuses)
    inspection.stage = (
        InspectionStage.FINALIZED.value if spec.finalized else InspectionStage.READY_FOR_REVIEW.value
    )
    if spec.finalized:
        from datetime import UTC, datetime

        inspection.finalized_at = datetime.now(UTC)
    db.flush()

    inspection_repository.add_audit_log(
        db, inspection_id=inspection.id, user_id=spec.inspector_id, action="INSPECTION_CREATED"
    )
    inspection_repository.add_audit_log(
        db,
        inspection_id=inspection.id,
        user_id=spec.inspector_id,
        action="RULES_EVALUATED",
        metadata={"rules_checked": len(evaluations)},
    )
    if spec.finalized:
        inspection_repository.add_audit_log(
            db,
            inspection_id=inspection.id,
            user_id=spec.inspector_id,
            action="INSPECTION_FINALIZED",
            metadata={"overall_status": inspection.overall_status},
        )


async def seed_inspections(db: Session) -> None:
    settings = get_settings()
    storage = get_storage_service(settings)

    for spec in DEMO_INSPECTIONS:
        await _seed_one(db, storage, spec)
    db.commit()


def main() -> None:
    db = SessionLocal()
    try:
        print("Seeding inspectors...")
        seed_inspectors(db)
        print("Seeding demo rules repository (DEMO DATA)...")
        seed_rules(db)
        print("Seeding demo inspections...")
        asyncio.run(seed_inspections(db))
        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
