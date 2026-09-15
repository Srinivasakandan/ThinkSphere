import type {
  AuditEvent,
  ExtractedField,
  Inspection,
  ProductImage,
  RuleResult,
} from "@/types";
import { calculateOverallStatus } from "@/lib/inspection/status";
import { placeholderImage } from "@/lib/mock/placeholder";
import { MOCK_INSPECTORS } from "@/lib/mock/inspectors";

let imgSeed = 1;

function img(
  inspectionId: string,
  productLabel: string,
  viewType: ProductImage["viewType"],
  quality: ProductImage["quality"],
  qualityNote?: string
): ProductImage {
  const seed = imgSeed++;
  return {
    id: `${inspectionId}-img-${viewType.toLowerCase()}`,
    inspectionId,
    url: placeholderImage(productLabel, viewType, seed),
    fileName: `${productLabel.replace(/\s+/g, "_").toLowerCase()}_${viewType.toLowerCase()}.jpg`,
    viewType,
    quality,
    qualityNote,
    uploadedAt: new Date().toISOString(),
  };
}

function field(
  inspectionId: string,
  fieldKey: string,
  label: string,
  value: string | null,
  confidence: ExtractedField["confidence"],
  sourceImageId?: string,
  opts?: { validated?: boolean; manuallyEdited?: boolean; explanation?: string }
): ExtractedField {
  return {
    id: `${inspectionId}-field-${fieldKey}`,
    field: fieldKey,
    label,
    value,
    confidence,
    sourceImageId,
    validated: opts?.validated ?? confidence === "HIGH",
    manuallyEdited: opts?.manuallyEdited ?? false,
    explanation: opts?.explanation,
  };
}

function rule(
  inspectionId: string,
  ruleId: string,
  requirement: string,
  fieldKey: string,
  detectedValue: string | null | undefined,
  status: RuleResult["status"],
  reason: string,
  evidenceImageId?: string,
  reviewed = false
): RuleResult {
  return {
    id: `${inspectionId}-rule-${ruleId}`,
    ruleId,
    requirement,
    field: fieldKey,
    detectedValue,
    status,
    reason,
    evidenceImageId,
    reviewed,
  };
}

function audit(actor: string, action: string, detail?: string, minutesAgo = 0, base = Date.now()): AuditEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date(base - minutesAgo * 60_000).toISOString(),
    actor,
    action,
    detail,
  };
}

const [inspectorA, inspectorB, , ] = MOCK_INSPECTORS;

function daysAgo(n: number): number {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// INS-00125 — Marie Gold biscuits — the primary demo "hero" inspection.
// ---------------------------------------------------------------------------
function buildMarieGold(): Inspection {
  const id = "INS-00125";
  const base = daysAgo(0);
  const front = img(id, "Marie Gold", "FRONT", "GOOD");
  const back = img(id, "Marie Gold", "BACK", "GOOD");
  const side = img(id, "Marie Gold", "LEFT", "POOR", "Image may be difficult to read. Consider retaking this image.");
  const top = img(id, "Marie Gold", "TOP", "FAIR");

  const extractedFields: ExtractedField[] = [
    field(id, "productName", "Product Name", "Marie Gold", "HIGH", front.id),
    field(id, "mrp", "MRP", "₹50", "HIGH", front.id),
    field(id, "netQuantity", "Net Quantity", "250 g", "HIGH", back.id),
    field(id, "manufacturer", "Manufacturer", "Britannia Industries Ltd.", "HIGH", back.id),
    field(id, "manufacturingDate", "Manufacturing Date", "06/2026", "LOW", side.id, {
      validated: false,
      explanation: "The system could not reliably read the manufacturing date from the side panel image.",
    }),
    field(id, "consumerCare", "Consumer Care", null, "LOW", undefined, {
      validated: false,
      explanation: "No consumer care declaration was detected in the available images.",
    }),
    field(id, "genericName", "Generic Name", "Biscuits", "MEDIUM", back.id),
    field(id, "countryOfOrigin", "Country of Origin", "India", "MEDIUM", back.id),
  ];

  const ruleResults: RuleResult[] = [
    rule(id, "R001", "MRP must be declared", "mrp", "₹50", "PASS", "MRP declaration was clearly detected and matches expected format.", front.id, true),
    rule(id, "R002", "Net quantity must be declared", "netQuantity", "250 g", "PASS", "Net quantity declaration was clearly detected.", back.id, true),
    rule(id, "R003", "Manufacturer information required", "manufacturer", "Britannia Industries Ltd.", "PASS", "Manufacturer name and address were detected on the back panel.", back.id, true),
    rule(id, "R008", "Generic name of the commodity must be declared", "genericName", "Biscuits", "PASS", "Generic name was detected on the back panel.", back.id, true),
    rule(id, "R006", "Country of origin must be declared for imported packages", "countryOfOrigin", "India", "PASS", "Domestic origin declared; import-specific requirement not applicable.", back.id, true),
    rule(id, "R004", "Consumer care information required", "consumerCare", null, "POTENTIAL_NON_COMPLIANCE", "Required declaration was not detected in the available product images.", undefined, false),
    rule(id, "R005", "Month and year of manufacture must be declared", "manufacturingDate", "06/2026", "NEEDS_REVIEW", "A date was detected but extraction confidence is low due to image quality. Inspector verification required.", side.id, false),
    rule(id, "R012", "Best before date must be declared", "bestBefore", null, "NEEDS_REVIEW", "No best-before declaration was confidently detected; source image quality was poor.", side.id, false),
    rule(id, "R011", "Declarations must be legible and conspicuous", "legibility", "Legible", "PASS", "Mandatory declarations appear in a single legible block on the back panel.", back.id, true),
    rule(id, "R007", "Unit sale price must be declared where applicable", "unitSalePrice", "Not applicable", "PASS", "Not applicable for this pack size/category.", back.id, true),
    rule(id, "R009", "Number of pieces or dimensions must be declared where applicable", "dimensions", "Not applicable", "PASS", "Not applicable for this commodity.", back.id, true),
    rule(id, "R010", "Net quantity must conform to permitted standard package sizes", "netQuantity", "250 g", "PASS", "Declared quantity matches a permitted standard package size.", back.id, true),
  ];

  const overallStatus = calculateOverallStatus(ruleResults);

  return {
    id,
    productName: "Marie Gold",
    brand: "Britannia",
    category: "Food",
    batchNumber: "BSC-22841",
    location: "Andheri West, Mumbai",
    notes: "Routine market surveillance check at retail outlet.",
    stage: "UNDER_REVIEW",
    images: [front, back, side, top],
    extractedFields,
    ruleResults,
    overallStatus,
    inspectorId: inspectorA.id,
    inspectorName: inspectorA.name,
    createdAt: new Date(base).toISOString(),
    updatedAt: new Date(base).toISOString(),
    auditTrail: [
      audit(inspectorA.name, "Inspection created", undefined, 40, base),
      audit(inspectorA.name, "Images uploaded", "4 images uploaded", 38, base),
      audit("System", "OCR text extraction completed", undefined, 36, base),
      audit("System", "Declarations extracted", "8 fields extracted", 35, base),
      audit("System", "Rule engine evaluated", "12 rules checked", 34, base),
    ],
  };
}

// ---------------------------------------------------------------------------
// Generic builder for the remaining catalogue of demo inspections.
// ---------------------------------------------------------------------------
interface SimpleSpec {
  id: string;
  productName: string;
  brand: string;
  category: Inspection["category"];
  batchNumber: string;
  location: string;
  daysAgoCreated: number;
  inspector: (typeof MOCK_INSPECTORS)[number];
  stage: Inspection["stage"];
  finalized?: boolean;
  fields: Array<{
    key: string;
    label: string;
    value: string | null;
    confidence: ExtractedField["confidence"];
    view: ProductImage["viewType"];
  }>;
  ruleOutcomes: Array<{
    ruleId: string;
    requirement: string;
    fieldKey: string;
    status: RuleResult["status"];
    reason: string;
  }>;
  imageQualities?: Partial<Record<ProductImage["viewType"], ProductImage["quality"]>>;
}

function buildFromSpec(spec: SimpleSpec): Inspection {
  const base = daysAgo(spec.daysAgoCreated);
  const views = Array.from(new Set(spec.fields.map((f) => f.view)));
  const images = views.map((v) =>
    img(
      spec.id,
      spec.productName,
      v,
      spec.imageQualities?.[v] ?? "GOOD",
      spec.imageQualities?.[v] === "POOR"
        ? "Image may be difficult to read. Consider retaking this image."
        : undefined
    )
  );
  const imageByView = Object.fromEntries(images.map((i) => [i.viewType, i]));

  const extractedFields = spec.fields.map((f) =>
    field(spec.id, f.key, f.label, f.value, f.confidence, imageByView[f.view]?.id, {
      validated: f.confidence !== "LOW",
    })
  );
  const fieldsByKey = Object.fromEntries(spec.fields.map((f) => [f.key, f]));

  const ruleResults = spec.ruleOutcomes.map((r) => {
    const relatedField = fieldsByKey[r.fieldKey];
    const evidenceImageId = relatedField ? imageByView[relatedField.view]?.id : undefined;
    return rule(
      spec.id,
      r.ruleId,
      r.requirement,
      r.fieldKey,
      relatedField?.value,
      r.status,
      r.reason,
      r.status === "PASS" ? evidenceImageId : r.status === "NEEDS_REVIEW" ? evidenceImageId : undefined,
      spec.finalized
    );
  });

  const overallStatus = calculateOverallStatus(ruleResults);

  const trail: AuditEvent[] = [
    audit(spec.inspector.name, "Inspection created", undefined, 60, base),
    audit(spec.inspector.name, "Images uploaded", `${images.length} images uploaded`, 55, base),
    audit("System", "OCR text extraction completed", undefined, 50, base),
    audit("System", "Declarations extracted", `${extractedFields.length} fields extracted`, 48, base),
    audit("System", "Rule engine evaluated", `${ruleResults.length} rules checked`, 45, base),
  ];
  if (spec.finalized) {
    trail.push(audit(spec.inspector.name, "Inspection finalized", `Overall status: ${overallStatus}`, 5, base));
  }

  return {
    id: spec.id,
    productName: spec.productName,
    brand: spec.brand,
    category: spec.category,
    batchNumber: spec.batchNumber,
    location: spec.location,
    stage: spec.stage,
    images,
    extractedFields,
    ruleResults,
    overallStatus,
    inspectorId: spec.inspector.id,
    inspectorName: spec.inspector.name,
    createdAt: new Date(base).toISOString(),
    updatedAt: new Date(base).toISOString(),
    finalizedAt: spec.finalized ? new Date(base + 55 * 60_000).toISOString() : undefined,
    auditTrail: trail,
  };
}

const OTHER_SPECS: SimpleSpec[] = [
  {
    id: "INS-00124",
    productName: "Good Day Cashew Cookies",
    brand: "Britannia",
    category: "Food",
    batchNumber: "BSC-22790",
    location: "Andheri West, Mumbai",
    daysAgoCreated: 3,
    inspector: inspectorA,
    stage: "FINALIZED",
    finalized: true,
    fields: [
      { key: "mrp", label: "MRP", value: "₹30", confidence: "HIGH", view: "FRONT" },
      { key: "netQuantity", label: "Net Quantity", value: "150 g", confidence: "HIGH", view: "BACK" },
      { key: "manufacturer", label: "Manufacturer", value: "Britannia Industries Ltd.", confidence: "HIGH", view: "BACK" },
      { key: "consumerCare", label: "Consumer Care", value: "1800-121-6551", confidence: "HIGH", view: "BACK" },
      { key: "manufacturingDate", label: "Manufacturing Date", value: "04/2026", confidence: "HIGH", view: "BACK" },
    ],
    ruleOutcomes: [
      { ruleId: "R001", requirement: "MRP must be declared", fieldKey: "mrp", status: "PASS", reason: "MRP clearly detected on front panel." },
      { ruleId: "R002", requirement: "Net quantity must be declared", fieldKey: "netQuantity", status: "PASS", reason: "Net quantity clearly detected." },
      { ruleId: "R003", requirement: "Manufacturer information required", fieldKey: "manufacturer", status: "PASS", reason: "Manufacturer details detected." },
      { ruleId: "R004", requirement: "Consumer care information required", fieldKey: "consumerCare", status: "PASS", reason: "Consumer care contact detected." },
      { ruleId: "R005", requirement: "Month and year of manufacture must be declared", fieldKey: "manufacturingDate", status: "PASS", reason: "Manufacturing date clearly detected." },
    ],
  },
  {
    id: "INS-00123",
    productName: "Fortune Sunlite Refined Sunflower Oil",
    brand: "Adani Wilmar",
    category: "Food",
    batchNumber: "OIL-11298",
    location: "Dadar, Mumbai",
    daysAgoCreated: 3,
    inspector: inspectorA,
    stage: "UNDER_REVIEW",
    fields: [
      { key: "mrp", label: "MRP", value: "₹185", confidence: "HIGH", view: "FRONT" },
      { key: "netQuantity", label: "Net Quantity", value: "1 L", confidence: "HIGH", view: "FRONT" },
      { key: "manufacturer", label: "Manufacturer", value: "Adani Wilmar Ltd.", confidence: "MEDIUM", view: "BACK" },
      { key: "manufacturingDate", label: "Manufacturing Date", value: null, confidence: "LOW", view: "BACK" },
      { key: "bestBefore", label: "Best Before", value: "9 months from pkg.", confidence: "MEDIUM", view: "BACK" },
    ],
    imageQualities: { BACK: "FAIR" },
    ruleOutcomes: [
      { ruleId: "R001", requirement: "MRP must be declared", fieldKey: "mrp", status: "PASS", reason: "MRP clearly detected." },
      { ruleId: "R002", requirement: "Net quantity must be declared", fieldKey: "netQuantity", status: "PASS", reason: "Net quantity clearly detected." },
      { ruleId: "R003", requirement: "Manufacturer information required", fieldKey: "manufacturer", status: "PASS", reason: "Manufacturer details detected with moderate confidence." },
      { ruleId: "R005", requirement: "Month and year of manufacture must be declared", fieldKey: "manufacturingDate", status: "NEEDS_REVIEW", reason: "The system could not reliably read the manufacturing date. Inspector verification required." },
      { ruleId: "R012", requirement: "Best before date must be declared", fieldKey: "bestBefore", status: "NEEDS_REVIEW", reason: "Best before declaration detected but wording is ambiguous. Inspector verification required." },
    ],
  },
  {
    id: "INS-00122",
    productName: "Lakme Absolute Perfect Radiance Cream",
    brand: "Lakme",
    category: "Cosmetics",
    batchNumber: "CSM-77021",
    location: "Bandra, Mumbai",
    daysAgoCreated: 5,
    inspector: inspectorB,
    stage: "FINALIZED",
    finalized: true,
    fields: [
      { key: "mrp", label: "MRP", value: "₹699", confidence: "HIGH", view: "FRONT" },
      { key: "netQuantity", label: "Net Quantity", value: "50 g", confidence: "HIGH", view: "FRONT" },
      { key: "manufacturer", label: "Manufacturer", value: "Hindustan Unilever Ltd.", confidence: "HIGH", view: "BACK" },
      { key: "consumerCare", label: "Consumer Care", value: "1800-267-7777", confidence: "HIGH", view: "BACK" },
      { key: "manufacturingDate", label: "Manufacturing Date", value: "01/2026", confidence: "HIGH", view: "BACK" },
      { key: "countryOfOrigin", label: "Country of Origin", value: "India", confidence: "HIGH", view: "BACK" },
    ],
    ruleOutcomes: [
      { ruleId: "R001", requirement: "MRP must be declared", fieldKey: "mrp", status: "PASS", reason: "MRP clearly detected." },
      { ruleId: "R002", requirement: "Net quantity must be declared", fieldKey: "netQuantity", status: "PASS", reason: "Net quantity clearly detected." },
      { ruleId: "R003", requirement: "Manufacturer information required", fieldKey: "manufacturer", status: "PASS", reason: "Manufacturer details detected." },
      { ruleId: "R004", requirement: "Consumer care information required", fieldKey: "consumerCare", status: "PASS", reason: "Consumer care contact detected." },
      { ruleId: "R005", requirement: "Month and year of manufacture must be declared", fieldKey: "manufacturingDate", status: "PASS", reason: "Manufacturing date detected." },
      { ruleId: "R006", requirement: "Country of origin must be declared for imported packages", fieldKey: "countryOfOrigin", status: "PASS", reason: "Domestic origin declared." },
    ],
  },
  {
    id: "INS-00121",
    productName: "Surf Excel Matic Liquid Detergent",
    brand: "Hindustan Unilever",
    category: "Household Goods",
    batchNumber: "HHG-33410",
    location: "Kurla, Mumbai",
    daysAgoCreated: 6,
    inspector: inspectorA,
    stage: "FINALIZED",
    finalized: true,
    fields: [
      { key: "mrp", label: "MRP", value: "₹399", confidence: "HIGH", view: "FRONT" },
      { key: "netQuantity", label: "Net Quantity", value: "1 L", confidence: "HIGH", view: "FRONT" },
      { key: "manufacturer", label: "Manufacturer", value: "Hindustan Unilever Ltd.", confidence: "HIGH", view: "BACK" },
      { key: "consumerCare", label: "Consumer Care", value: "1800-267-7000", confidence: "MEDIUM", view: "BACK" },
    ],
    ruleOutcomes: [
      { ruleId: "R001", requirement: "MRP must be declared", fieldKey: "mrp", status: "PASS", reason: "MRP clearly detected." },
      { ruleId: "R002", requirement: "Net quantity must be declared", fieldKey: "netQuantity", status: "PASS", reason: "Net quantity clearly detected." },
      { ruleId: "R003", requirement: "Manufacturer information required", fieldKey: "manufacturer", status: "PASS", reason: "Manufacturer details detected." },
      { ruleId: "R004", requirement: "Consumer care information required", fieldKey: "consumerCare", status: "PASS", reason: "Consumer care contact detected with moderate confidence." },
    ],
  },
  {
    id: "INS-00120",
    productName: "Parle-G Glucose Biscuits",
    brand: "Parle Products",
    category: "Food",
    batchNumber: "BSC-19087",
    location: "Ghatkopar, Mumbai",
    daysAgoCreated: 7,
    inspector: inspectorB,
    stage: "FINALIZED",
    finalized: true,
    fields: [
      { key: "mrp", label: "MRP", value: "₹10", confidence: "HIGH", view: "FRONT" },
      { key: "netQuantity", label: "Net Quantity", value: "70 g", confidence: "HIGH", view: "FRONT" },
      { key: "manufacturer", label: "Manufacturer", value: "Parle Products Pvt. Ltd.", confidence: "HIGH", view: "BACK" },
      { key: "manufacturingDate", label: "Manufacturing Date", value: "05/2026", confidence: "HIGH", view: "BACK" },
    ],
    ruleOutcomes: [
      { ruleId: "R001", requirement: "MRP must be declared", fieldKey: "mrp", status: "PASS", reason: "MRP clearly detected." },
      { ruleId: "R002", requirement: "Net quantity must be declared", fieldKey: "netQuantity", status: "PASS", reason: "Net quantity clearly detected." },
      { ruleId: "R003", requirement: "Manufacturer information required", fieldKey: "manufacturer", status: "PASS", reason: "Manufacturer details detected." },
      { ruleId: "R005", requirement: "Month and year of manufacture must be declared", fieldKey: "manufacturingDate", status: "PASS", reason: "Manufacturing date clearly detected." },
    ],
  },
  {
    id: "INS-00119",
    productName: "Dettol Original Soap",
    brand: "Reckitt",
    category: "Personal Care",
    batchNumber: "PC-55210",
    location: "Powai, Mumbai",
    daysAgoCreated: 8,
    inspector: inspectorA,
    stage: "UNDER_REVIEW",
    fields: [
      { key: "mrp", label: "MRP", value: "₹45", confidence: "HIGH", view: "FRONT" },
      { key: "netQuantity", label: "Net Quantity", value: "75 g", confidence: "HIGH", view: "FRONT" },
      { key: "manufacturer", label: "Manufacturer", value: null, confidence: "LOW", view: "BACK" },
      { key: "consumerCare", label: "Consumer Care", value: null, confidence: "LOW", view: "BACK" },
    ],
    imageQualities: { BACK: "POOR" },
    ruleOutcomes: [
      { ruleId: "R001", requirement: "MRP must be declared", fieldKey: "mrp", status: "PASS", reason: "MRP clearly detected." },
      { ruleId: "R002", requirement: "Net quantity must be declared", fieldKey: "netQuantity", status: "PASS", reason: "Net quantity clearly detected." },
      { ruleId: "R003", requirement: "Manufacturer information required", fieldKey: "manufacturer", status: "POTENTIAL_NON_COMPLIANCE", reason: "Required declaration was not detected in the available product images." },
      { ruleId: "R004", requirement: "Consumer care information required", fieldKey: "consumerCare", status: "NEEDS_REVIEW", reason: "Back panel image quality was poor. Inspector verification required." },
    ],
  },
  {
    id: "INS-00118",
    productName: "Amul Taaza Toned Milk (Tetra Pack)",
    brand: "Amul",
    category: "Beverage",
    batchNumber: "BEV-88213",
    location: "Vikhroli, Mumbai",
    daysAgoCreated: 9,
    inspector: inspectorB,
    stage: "FINALIZED",
    finalized: true,
    fields: [
      { key: "mrp", label: "MRP", value: "₹33", confidence: "HIGH", view: "FRONT" },
      { key: "netQuantity", label: "Net Quantity", value: "500 ml", confidence: "HIGH", view: "FRONT" },
      { key: "manufacturer", label: "Manufacturer", value: "Gujarat Cooperative Milk Marketing Federation", confidence: "HIGH", view: "BACK" },
      { key: "bestBefore", label: "Best Before", value: "6 days from pkg.", confidence: "HIGH", view: "BACK" },
    ],
    ruleOutcomes: [
      { ruleId: "R001", requirement: "MRP must be declared", fieldKey: "mrp", status: "PASS", reason: "MRP clearly detected." },
      { ruleId: "R002", requirement: "Net quantity must be declared", fieldKey: "netQuantity", status: "PASS", reason: "Net quantity clearly detected." },
      { ruleId: "R003", requirement: "Manufacturer information required", fieldKey: "manufacturer", status: "PASS", reason: "Manufacturer details detected." },
      { ruleId: "R012", requirement: "Best before date must be declared", fieldKey: "bestBefore", status: "PASS", reason: "Best before declaration clearly detected." },
    ],
  },
  {
    id: "INS-00117",
    productName: "Philips LED Bulb 9W",
    brand: "Philips",
    category: "Electrical",
    batchNumber: "ELC-40021",
    location: "Chembur, Mumbai",
    daysAgoCreated: 11,
    inspector: inspectorA,
    stage: "FINALIZED",
    finalized: true,
    fields: [
      { key: "mrp", label: "MRP", value: "₹129", confidence: "HIGH", view: "FRONT" },
      { key: "netQuantity", label: "Net Quantity", value: "1 Unit", confidence: "HIGH", view: "FRONT" },
      { key: "manufacturer", label: "Manufacturer", value: "Signify Innovations India Ltd.", confidence: "HIGH", view: "BACK" },
      { key: "consumerCare", label: "Consumer Care", value: "1800-103-3838", confidence: "HIGH", view: "BACK" },
    ],
    ruleOutcomes: [
      { ruleId: "R001", requirement: "MRP must be declared", fieldKey: "mrp", status: "PASS", reason: "MRP clearly detected." },
      { ruleId: "R002", requirement: "Net quantity must be declared", fieldKey: "netQuantity", status: "PASS", reason: "Unit count clearly detected." },
      { ruleId: "R003", requirement: "Manufacturer information required", fieldKey: "manufacturer", status: "PASS", reason: "Manufacturer details detected." },
      { ruleId: "R004", requirement: "Consumer care information required", fieldKey: "consumerCare", status: "PASS", reason: "Consumer care contact detected." },
    ],
  },
  {
    id: "INS-00116",
    productName: "Colgate Strong Teeth Toothpaste",
    brand: "Colgate-Palmolive",
    category: "Personal Care",
    batchNumber: "PC-60932",
    location: "Malad West, Mumbai",
    daysAgoCreated: 12,
    inspector: inspectorB,
    stage: "UNDER_REVIEW",
    fields: [
      { key: "mrp", label: "MRP", value: "₹99", confidence: "HIGH", view: "FRONT" },
      { key: "netQuantity", label: "Net Quantity", value: "150 g", confidence: "HIGH", view: "FRONT" },
      { key: "manufacturer", label: "Manufacturer", value: "Colgate-Palmolive (India) Ltd.", confidence: "HIGH", view: "BACK" },
      { key: "manufacturingDate", label: "Manufacturing Date", value: "11/2025", confidence: "MEDIUM", view: "BACK" },
      { key: "consumerCare", label: "Consumer Care", value: null, confidence: "LOW", view: "BACK" },
    ],
    ruleOutcomes: [
      { ruleId: "R001", requirement: "MRP must be declared", fieldKey: "mrp", status: "PASS", reason: "MRP clearly detected." },
      { ruleId: "R002", requirement: "Net quantity must be declared", fieldKey: "netQuantity", status: "PASS", reason: "Net quantity clearly detected." },
      { ruleId: "R003", requirement: "Manufacturer information required", fieldKey: "manufacturer", status: "PASS", reason: "Manufacturer details detected." },
      { ruleId: "R005", requirement: "Month and year of manufacture must be declared", fieldKey: "manufacturingDate", status: "PASS", reason: "Manufacturing date detected with moderate confidence." },
      { ruleId: "R004", requirement: "Consumer care information required", fieldKey: "consumerCare", status: "NEEDS_REVIEW", reason: "Consumer care declaration not confidently detected. Inspector verification required." },
    ],
  },
  {
    id: "INS-00115",
    productName: "Tata Salt Iodized",
    brand: "Tata Consumer Products",
    category: "Food",
    batchNumber: "FD-30044",
    location: "Goregaon, Mumbai",
    daysAgoCreated: 14,
    inspector: inspectorA,
    stage: "FINALIZED",
    finalized: true,
    fields: [
      { key: "mrp", label: "MRP", value: "₹28", confidence: "HIGH", view: "FRONT" },
      { key: "netQuantity", label: "Net Quantity", value: "1 kg", confidence: "HIGH", view: "FRONT" },
      { key: "manufacturer", label: "Manufacturer", value: "Tata Consumer Products Ltd.", confidence: "HIGH", view: "BACK" },
      { key: "consumerCare", label: "Consumer Care", value: "1800-22-8282", confidence: "HIGH", view: "BACK" },
    ],
    ruleOutcomes: [
      { ruleId: "R001", requirement: "MRP must be declared", fieldKey: "mrp", status: "PASS", reason: "MRP clearly detected." },
      { ruleId: "R002", requirement: "Net quantity must be declared", fieldKey: "netQuantity", status: "PASS", reason: "Net quantity clearly detected." },
      { ruleId: "R003", requirement: "Manufacturer information required", fieldKey: "manufacturer", status: "PASS", reason: "Manufacturer details detected." },
      { ruleId: "R004", requirement: "Consumer care information required", fieldKey: "consumerCare", status: "PASS", reason: "Consumer care contact detected." },
    ],
  },
  {
    id: "INS-00114",
    productName: "Nescafe Classic Instant Coffee",
    brand: "Nestle",
    category: "Beverage",
    batchNumber: "BEV-71298",
    location: "Borivali, Mumbai",
    daysAgoCreated: 15,
    inspector: inspectorB,
    stage: "FINALIZED",
    finalized: true,
    fields: [
      { key: "mrp", label: "MRP", value: "₹259", confidence: "HIGH", view: "FRONT" },
      { key: "netQuantity", label: "Net Quantity", value: "100 g", confidence: "HIGH", view: "FRONT" },
      { key: "manufacturer", label: "Manufacturer", value: "Nestle India Ltd.", confidence: "HIGH", view: "BACK" },
      { key: "manufacturingDate", label: "Manufacturing Date", value: "02/2026", confidence: "HIGH", view: "BACK" },
    ],
    ruleOutcomes: [
      { ruleId: "R001", requirement: "MRP must be declared", fieldKey: "mrp", status: "PASS", reason: "MRP clearly detected." },
      { ruleId: "R002", requirement: "Net quantity must be declared", fieldKey: "netQuantity", status: "PASS", reason: "Net quantity clearly detected." },
      { ruleId: "R003", requirement: "Manufacturer information required", fieldKey: "manufacturer", status: "PASS", reason: "Manufacturer details detected." },
      { ruleId: "R005", requirement: "Month and year of manufacture must be declared", fieldKey: "manufacturingDate", status: "PASS", reason: "Manufacturing date clearly detected." },
    ],
  },
];

export const MOCK_INSPECTIONS: Inspection[] = [
  buildMarieGold(),
  ...OTHER_SPECS.map(buildFromSpec),
].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export function getMockInspectionById(id: string): Inspection | undefined {
  return MOCK_INSPECTIONS.find((i) => i.id === id);
}
