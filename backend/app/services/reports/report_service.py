"""PDF inspection report generation.

The report is a record of what the system detected and what the
inspector reviewed — never a declaration of confirmed legal violation.
See the mandatory disclaimer rendered at the top of every report.
"""

import io
import uuid

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.inspection import Inspection
from app.schemas.report import ReportGenerateResponse
from app.services.storage import StorageService

_DISCLAIMER = (
    "This report reflects automated OCR/extraction results and rule-engine findings, "
    "reviewed by the inspector named below. It is an inspection-assistance record, not "
    "an independent legal determination. Any “Potential Non-Compliance” finding "
    "requires the inspecting authority's own verification before any enforcement action."
)

_STATUS_COLORS = {
    "PASS": colors.HexColor("#15803d"),
    "POTENTIAL_NON_COMPLIANCE": colors.HexColor("#b91c1c"),
    "NEEDS_REVIEW": colors.HexColor("#b45309"),
}


def _build_pdf(inspection: Inspection) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    disclaimer_style = ParagraphStyle(
        "Disclaimer", parent=styles["BodyText"], textColor=colors.HexColor("#334155"), fontSize=8.5
    )

    story = [
        Paragraph("Legal Metrology Inspection Report", styles["Title"]),
        Paragraph(_DISCLAIMER, disclaimer_style),
        Spacer(1, 0.5 * cm),
    ]

    product = inspection.product
    meta_rows = [
        ["Inspection ID", str(inspection.id)],
        ["Inspector", inspection.inspector.full_name],
        ["Date", inspection.created_at.strftime("%d %b %Y")],
        ["Product", product.product_name if product and product.product_name else "—"],
        ["Brand", product.brand if product and product.brand else "—"],
        ["Category", product.category if product and product.category else "—"],
        ["Location", inspection.inspection_location or "—"],
        ["Overall Status", inspection.overall_status.replace("_", " ").title()],
        [
            "Finalized",
            (
                inspection.finalized_at.strftime("%d %b %Y %H:%M")
                if inspection.finalized_at
                else "Not finalized"
            ),
        ],
    ]
    meta_table = Table(meta_rows, colWidths=[4 * cm, 11 * cm])
    meta_table.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#475569")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 0.6 * cm))

    story.append(Paragraph("Extracted Information", styles["Heading2"]))
    field_rows = [["Field", "Value", "Confidence", "Status"]]
    for field in inspection.extracted_fields:
        field_rows.append(
            [
                field.field_name.replace("_", " ").title(),
                field.value or "Not detected",
                field.confidence_level,
                field.validation_status,
            ]
        )
    field_table = Table(field_rows, colWidths=[4 * cm, 6 * cm, 2.5 * cm, 2.5 * cm], repeatRows=1)
    field_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(field_table)
    story.append(Spacer(1, 0.6 * cm))

    story.append(Paragraph("Rule Evaluation", styles["Heading2"]))
    rule_rows = [["Rule", "Requirement", "Detected Value", "Status", "Reason"]]
    for result in inspection.rule_results:
        rule_rows.append(
            [
                result.rule.rule_code,
                result.rule.title,
                result.detected_value or "Not detected",
                result.status.replace("_", " ").title(),
                result.reason,
            ]
        )
    rule_table = Table(rule_rows, colWidths=[1.8 * cm, 3.4 * cm, 3 * cm, 2.8 * cm, 4 * cm], repeatRows=1)
    style_commands = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
    for row_idx, result in enumerate(inspection.rule_results, start=1):
        color = _STATUS_COLORS.get(result.status)
        if color:
            style_commands.append(("TEXTCOLOR", (3, row_idx), (3, row_idx), color))
    rule_table.setStyle(TableStyle(style_commands))
    story.append(rule_table)

    if inspection.notes:
        story.append(Spacer(1, 0.6 * cm))
        story.append(Paragraph("Inspector Notes", styles["Heading2"]))
        story.append(Paragraph(inspection.notes, styles["BodyText"]))

    doc.build(story)
    return buffer.getvalue()


async def generate_inspection_report(
    inspection: Inspection, storage: StorageService
) -> ReportGenerateResponse:
    pdf_bytes = _build_pdf(inspection)
    report_id = uuid.uuid4()
    path = f"reports/{inspection.id}/{report_id}.pdf"
    stored = await storage.upload_file(path=path, content=pdf_bytes, content_type="application/pdf")
    return ReportGenerateResponse(
        report_id=report_id, inspection_id=inspection.id, file_path=stored.path, url=stored.url
    )
