/**
 * Adapters from the raw backend contract (@/types/api) to the UI-facing
 * domain model (@/types) that every existing page/component already
 * consumes. Keeping this mapping in one place means the rest of the
 * frontend never has to know whether it's looking at mock data or a
 * real backend response.
 */
import { titleCase } from "@/lib/format";
import type {
  ExtractedField,
  Inspection,
  Inspector,
  ProductCategory,
  ProductImage,
  RuleResult,
} from "@/types";
import type {
  ApiExtractedFieldResponse,
  ApiImageResponse,
  ApiInspectionDetail,
  ApiInspectionStage,
  ApiInspectionSummary,
  ApiInspectorResponse,
  ApiRuleResultResponse,
} from "@/types/api";

const STAGE_MAP: Record<ApiInspectionStage, Inspection["stage"]> = {
  CREATED: "DRAFT",
  IMAGES_UPLOADED: "UPLOADING",
  PROCESSING: "PROCESSING",
  OCR_COMPLETED: "PROCESSING",
  EXTRACTION_COMPLETED: "EXTRACTED",
  VALIDATION_COMPLETED: "EXTRACTED",
  RULE_EVALUATION_COMPLETED: "RULES_EVALUATED",
  READY_FOR_REVIEW: "UNDER_REVIEW",
  FINALIZED: "FINALIZED",
  // The UI model has no distinct failed stage — the processing page
  // surfaces the failure via the thrown ApiError instead (see
  // lib/api/inspections.ts runProcessing).
  PROCESSING_FAILED: "PROCESSING",
};

export function mapStage(stage: ApiInspectionStage): Inspection["stage"] {
  return STAGE_MAP[stage];
}

const ROLE_MAP: Record<string, Inspector["role"]> = {
  INSPECTOR: "Inspector",
  SUPERVISOR: "Supervisor",
  ADMIN: "Administrator",
};

export function mapInspector(api: ApiInspectorResponse): Inspector {
  return {
    id: api.id,
    name: api.full_name,
    email: api.email,
    role: ROLE_MAP[api.role] ?? "Inspector",
    badgeId: api.badge_id ?? undefined,
  };
}

export function mapImage(img: ApiImageResponse): ProductImage {
  return {
    id: img.id,
    inspectionId: img.inspection_id,
    url: img.url,
    fileName: img.original_filename,
    viewType: img.view_type,
    // UNKNOWN means OCR hasn't run yet — leave quality unset rather than
    // guessing, existing components already treat a missing quality as
    // "no signal yet" (see components/inspection/image-grid.tsx).
    quality: img.image_quality === "UNKNOWN" ? undefined : img.image_quality,
    qualityNote: img.quality_note ?? undefined,
    uploadedAt: img.created_at,
  };
}

export function mapExtractedField(f: ApiExtractedFieldResponse): ExtractedField {
  return {
    id: f.id,
    field: f.field_name,
    label: titleCase(f.field_name),
    value: f.value,
    confidence: f.confidence_level,
    sourceImageId: f.source_image_id ?? undefined,
    boundingBox: f.bounding_box ?? undefined,
    validated: f.manually_verified || f.validation_status === "VALID",
    manuallyEdited: f.manually_edited,
    explanation: f.validation_reason ?? undefined,
  };
}

export function mapRuleResult(r: ApiRuleResultResponse): RuleResult {
  return {
    id: r.id,
    ruleId: r.rule_id,
    requirement: r.requirement,
    field: r.field_name,
    detectedValue: r.detected_value,
    status: r.status,
    reason: r.reason,
    evidenceImageId: r.evidence_image_id ?? undefined,
    reviewed: r.reviewed,
    inspectorNote: r.inspector_note ?? undefined,
    inspectorDecision: r.reviewed ? "CONFIRMED" : undefined,
  };
}

export function mapInspectionDetail(d: ApiInspectionDetail): Inspection {
  return {
    id: d.id,
    productName: d.product?.product_name ?? undefined,
    brand: d.product?.brand ?? undefined,
    category: (d.product?.category as ProductCategory | undefined) ?? undefined,
    batchNumber: d.product?.batch_number ?? undefined,
    location: d.inspection_location ?? undefined,
    notes: d.notes ?? undefined,
    stage: mapStage(d.stage),
    images: d.images.map(mapImage),
    extractedFields: d.extracted_fields.map(mapExtractedField),
    ruleResults: d.rule_results.map(mapRuleResult),
    overallStatus: d.overall_status,
    inspectorId: d.inspector.id,
    inspectorName: d.inspector.full_name,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    finalizedAt: d.finalized_at ?? undefined,
    // The audit log isn't exposed on this endpoint (see
    // docs/API_CONTRACT.md) — history pages built against real data
    // simply render an empty trail today.
    auditTrail: [],
  };
}

/** Summary-only projection (list/dashboard views) — the fields the
 * inspection list & recent-inspections widgets actually render. */
export function mapInspectionSummary(s: ApiInspectionSummary): Inspection {
  return {
    id: s.id,
    productName: s.product_name ?? undefined,
    category: (s.category as ProductCategory | undefined) ?? undefined,
    stage: mapStage(s.stage),
    images: [],
    extractedFields: [],
    ruleResults: [],
    overallStatus: s.overall_status,
    inspectorId: "",
    inspectorName: s.inspector_name,
    createdAt: s.created_at,
    updatedAt: s.created_at,
    auditTrail: [],
  };
}
