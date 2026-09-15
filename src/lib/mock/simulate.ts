import type { ExtractedField, Inspection, ProductImage, RuleResult } from "@/types";
import { calculateOverallStatus } from "@/lib/inspection/status";

function findImage(images: ProductImage[], view: ProductImage["viewType"]) {
  return images.find((i) => i.viewType === view) ?? images[0];
}

/**
 * Deterministic mock "OCR + extraction + rule engine" pass, standing in for
 * the FastAPI processing pipeline. Produces a realistic mix of confident
 * passes plus one low-confidence field and one missing declaration so the
 * review/finalize flow has something to demonstrate, regardless of what the
 * inspector uploaded or typed in during Step 1.
 */
export function runMockExtraction(inspection: Inspection): {
  extractedFields: ExtractedField[];
  ruleResults: RuleResult[];
} {
  const { images, id } = inspection;
  const front = findImage(images, "FRONT");
  const back = findImage(images, "BACK") ?? front;
  const poorQualityImage = images.find((i) => i.quality === "POOR");
  const dateSourceImage = poorQualityImage ?? back;

  const productName = inspection.productName?.trim() || "Unlabeled Product";
  const mrp = "₹" + (Math.round(Math.random() * 40 + 20) * 5 - 3);
  const netQuantity = ["100 g", "200 g", "250 g", "500 ml", "1 L", "1 kg"][
    Math.floor(Math.random() * 6)
  ];
  const manufacturer = inspection.brand
    ? `${inspection.brand} Industries Pvt. Ltd.`
    : "Manufacturer name detected on back panel";

  const extractedFields: ExtractedField[] = [
    {
      id: `${id}-field-productName`,
      field: "productName",
      label: "Product Name",
      value: productName,
      confidence: "HIGH",
      sourceImageId: front?.id,
      validated: true,
      manuallyEdited: false,
    },
    {
      id: `${id}-field-mrp`,
      field: "mrp",
      label: "MRP",
      value: mrp,
      confidence: "HIGH",
      sourceImageId: front?.id,
      validated: true,
      manuallyEdited: false,
    },
    {
      id: `${id}-field-netQuantity`,
      field: "netQuantity",
      label: "Net Quantity",
      value: netQuantity,
      confidence: "HIGH",
      sourceImageId: back?.id,
      validated: true,
      manuallyEdited: false,
    },
    {
      id: `${id}-field-manufacturer`,
      field: "manufacturer",
      label: "Manufacturer",
      value: manufacturer,
      confidence: "MEDIUM",
      sourceImageId: back?.id,
      validated: false,
      manuallyEdited: false,
    },
    {
      id: `${id}-field-manufacturingDate`,
      field: "manufacturingDate",
      label: "Manufacturing Date",
      value: poorQualityImage ? "0?/2026" : "07/2026",
      confidence: "LOW",
      sourceImageId: dateSourceImage?.id,
      validated: false,
      manuallyEdited: false,
      explanation:
        "The system could not reliably read the manufacturing date from the source image. Please verify this value against the original image.",
    },
    {
      id: `${id}-field-consumerCare`,
      field: "consumerCare",
      label: "Consumer Care",
      value: null,
      confidence: "LOW",
      sourceImageId: undefined,
      validated: false,
      manuallyEdited: false,
      explanation: "No consumer care declaration was detected in the available images.",
    },
  ];

  const ruleResults: RuleResult[] = [
    {
      id: `${id}-rule-R001`,
      ruleId: "R001",
      requirement: "MRP must be declared",
      field: "mrp",
      detectedValue: mrp,
      status: "PASS",
      reason: "MRP declaration was clearly detected on the front image.",
      evidenceImageId: front?.id,
      reviewed: false,
    },
    {
      id: `${id}-rule-R002`,
      ruleId: "R002",
      requirement: "Net quantity must be declared",
      field: "netQuantity",
      detectedValue: netQuantity,
      status: "PASS",
      reason: "Net quantity declaration was clearly detected.",
      evidenceImageId: back?.id,
      reviewed: false,
    },
    {
      id: `${id}-rule-R003`,
      ruleId: "R003",
      requirement: "Manufacturer information required",
      field: "manufacturer",
      detectedValue: manufacturer,
      status: "PASS",
      reason: "Manufacturer details were detected, though with moderate confidence.",
      evidenceImageId: back?.id,
      reviewed: false,
    },
    {
      id: `${id}-rule-R004`,
      ruleId: "R004",
      requirement: "Consumer care information required",
      field: "consumerCare",
      detectedValue: null,
      status: "POTENTIAL_NON_COMPLIANCE",
      reason: "Required declaration was not detected in the available product images.",
      evidenceImageId: undefined,
      reviewed: false,
    },
    {
      id: `${id}-rule-R005`,
      ruleId: "R005",
      requirement: "Month and year of manufacture must be declared",
      field: "manufacturingDate",
      detectedValue: poorQualityImage ? "0?/2026" : "07/2026",
      status: "NEEDS_REVIEW",
      reason:
        "A date was detected but extraction confidence is low due to image quality. Inspector verification required.",
      evidenceImageId: dateSourceImage?.id,
      reviewed: false,
    },
    {
      id: `${id}-rule-R008`,
      ruleId: "R008",
      requirement: "Generic name of the commodity must be declared",
      field: "productName",
      detectedValue: productName,
      status: "PASS",
      reason: "A generic/common name was detected on the package.",
      evidenceImageId: front?.id,
      reviewed: false,
    },
    {
      id: `${id}-rule-R011`,
      ruleId: "R011",
      requirement: "Declarations must be legible and conspicuous",
      field: "legibility",
      detectedValue: images.some((i) => i.quality === "POOR") ? "Partially legible" : "Legible",
      status: images.some((i) => i.quality === "POOR") ? "NEEDS_REVIEW" : "PASS",
      reason: images.some((i) => i.quality === "POOR")
        ? "One or more source images had reduced legibility. Inspector verification recommended."
        : "Mandatory declarations appear legible across the submitted images.",
      evidenceImageId: poorQualityImage?.id ?? back?.id,
      reviewed: false,
    },
  ];

  return { extractedFields, ruleResults };
}

export function applyOverallStatus(inspection: Inspection): Inspection {
  return {
    ...inspection,
    overallStatus: calculateOverallStatus(inspection.ruleResults),
  };
}
