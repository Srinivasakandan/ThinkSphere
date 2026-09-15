"use client";

/**
 * API service layer for inspections.
 *
 * Every function here is async and returns data shaped exactly like the
 * eventual FastAPI response so UI code never needs to change when the mock
 * layer (lib/mock) is swapped for real HTTP calls. See each function's
 * comment for the REST endpoint it stands in for.
 */
import type {
  ExtractedField,
  ImageQuality,
  ImageViewType,
  Inspection,
  InspectionResultsResponse,
  InspectionStatus,
  ProductCategory,
  RuleResult,
} from "@/types";
import { inspectionStore } from "@/lib/mock/store";
import { runMockExtraction } from "@/lib/mock/simulate";
import { calculateOverallStatus, summarizeRuleResults } from "@/lib/inspection/status";
import { CURRENT_INSPECTOR } from "@/lib/mock/inspectors";

function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function nextInspectionId(): string {
  const max = inspectionStore
    .getAll()
    .map((i) => Number(i.id.replace("INS-", "")))
    .reduce((a, b) => Math.max(a, b), 0);
  return `INS-${String(max + 1).padStart(5, "0")}`;
}

export interface CreateInspectionInput {
  productName?: string;
  brand?: string;
  category?: ProductCategory;
  batchNumber?: string;
  location?: string;
  notes?: string;
}

export interface UploadedImageInput {
  dataUrl: string;
  fileName: string;
  viewType: ImageViewType;
  quality?: ImageQuality;
  qualityNote?: string;
}

/** POST /api/inspections */
export async function createInspection(
  input: CreateInspectionInput,
  images: UploadedImageInput[]
): Promise<Inspection> {
  const id = nextInspectionId();
  const now = new Date().toISOString();
  const inspection: Inspection = {
    id,
    productName: input.productName,
    brand: input.brand,
    category: input.category,
    batchNumber: input.batchNumber,
    location: input.location,
    notes: input.notes,
    stage: "UPLOADING",
    images: images.map((img, idx) => ({
      id: `${id}-img-${idx}`,
      inspectionId: id,
      url: img.dataUrl,
      fileName: img.fileName,
      viewType: img.viewType,
      quality: img.quality ?? (idx % 5 === 4 ? "POOR" : idx % 3 === 2 ? "FAIR" : "GOOD"),
      qualityNote:
        img.qualityNote ??
        (idx % 5 === 4
          ? "Image may be difficult to read. Consider retaking this image."
          : undefined),
      uploadedAt: now,
    })),
    extractedFields: [],
    ruleResults: [],
    overallStatus: "NEEDS_REVIEW",
    inspectorId: CURRENT_INSPECTOR.id,
    inspectorName: CURRENT_INSPECTOR.name,
    createdAt: now,
    updatedAt: now,
    auditTrail: [
      {
        id: `evt-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: now,
        actor: CURRENT_INSPECTOR.name,
        action: "Inspection created",
      },
      {
        id: `evt-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: now,
        actor: CURRENT_INSPECTOR.name,
        action: "Images uploaded",
        detail: `${images.length} images uploaded`,
      },
    ],
  };
  inspectionStore.add(inspection);
  return delay(inspection, 200);
}

/** GET /api/inspections/{id} */
export async function getInspection(id: string): Promise<Inspection | undefined> {
  return delay(inspectionStore.getById(id), 200);
}

export interface GetInspectionsParams {
  search?: string;
  status?: InspectionStatus | "ALL";
  category?: string;
  inspectorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedInspections {
  items: Inspection[];
  total: number;
  page: number;
  pageSize: number;
}

/** GET /api/inspections */
export async function getInspections(
  params: GetInspectionsParams = {}
): Promise<PaginatedInspections> {
  const {
    search,
    status,
    category,
    inspectorId,
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 10,
  } = params;

  let items = inspectionStore.getAll().filter((i) => i.stage !== "DRAFT" && i.stage !== "UPLOADING");

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (i) =>
        i.id.toLowerCase().includes(q) ||
        i.productName?.toLowerCase().includes(q) ||
        i.brand?.toLowerCase().includes(q)
    );
  }
  if (status && status !== "ALL") {
    items = items.filter((i) => i.overallStatus === status);
  }
  if (category && category !== "ALL") {
    items = items.filter((i) => i.category === category);
  }
  if (inspectorId && inspectorId !== "ALL") {
    items = items.filter((i) => i.inspectorId === inspectorId);
  }
  if (dateFrom) {
    items = items.filter((i) => new Date(i.createdAt) >= new Date(dateFrom));
  }
  if (dateTo) {
    items = items.filter((i) => new Date(i.createdAt) <= new Date(dateTo));
  }

  const total = items.length;
  const start = (page - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  return delay({ items: paged, total, page, pageSize }, 250);
}

/** GET /api/inspections/{id}/results */
export async function getInspectionResults(
  id: string
): Promise<InspectionResultsResponse | undefined> {
  const inspection = inspectionStore.getById(id);
  if (!inspection) return delay(undefined);
  const summary = summarizeRuleResults(inspection.ruleResults);
  return delay({
    overall_status: inspection.overallStatus,
    summary: {
      total: summary.total,
      passed: summary.passed,
      potential_non_compliance: summary.potentialNonCompliance,
      needs_review: summary.needsReview,
    },
  });
}

/** Simulates POST /api/inspections/{id}/process — runs OCR + rule engine. */
export async function runProcessing(id: string): Promise<Inspection | undefined> {
  const inspection = inspectionStore.getById(id);
  if (!inspection) return undefined;
  const { extractedFields, ruleResults } = runMockExtraction(inspection);
  inspectionStore.update(id, (draft) => ({
    ...draft,
    stage: "RULES_EVALUATED",
    extractedFields,
    ruleResults,
    overallStatus: calculateOverallStatus(ruleResults),
    updatedAt: new Date().toISOString(),
    auditTrail: [
      ...draft.auditTrail,
      {
        id: `evt-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toISOString(),
        actor: "System",
        action: "OCR text extraction completed",
      },
      {
        id: `evt-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toISOString(),
        actor: "System",
        action: "Declarations extracted",
        detail: `${extractedFields.length} fields extracted`,
      },
      {
        id: `evt-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toISOString(),
        actor: "System",
        action: "Rule engine evaluated",
        detail: `${ruleResults.length} rules checked`,
      },
    ],
  }));
  return inspectionStore.getById(id);
}

/** PATCH /api/inspections/{id}/fields/{fieldId} */
export async function updateExtractedField(
  inspectionId: string,
  fieldId: string,
  value: string | null
): Promise<ExtractedField | undefined> {
  let updated: ExtractedField | undefined;
  inspectionStore.update(inspectionId, (draft) => {
    const fields = draft.extractedFields.map((f) => {
      if (f.id !== fieldId) return f;
      updated = { ...f, value, manuallyEdited: true, validated: true };
      return updated;
    });
    return {
      ...draft,
      extractedFields: fields,
      updatedAt: new Date().toISOString(),
      auditTrail: [
        ...draft.auditTrail,
        {
          id: `evt-${Math.random().toString(36).slice(2, 9)}`,
          timestamp: new Date().toISOString(),
          actor: CURRENT_INSPECTOR.name,
          action: "Field manually verified",
          detail: fields.find((f) => f.id === fieldId)?.label,
        },
      ],
    };
  });
  return delay(updated, 150);
}

/** PATCH /api/inspections/{id}/rules/{ruleId} */
export async function reviewRule(
  inspectionId: string,
  ruleResultId: string,
  decision: "CONFIRMED" | "CORRECTED",
  note?: string
): Promise<RuleResult | undefined> {
  let updated: RuleResult | undefined;
  inspectionStore.update(inspectionId, (draft) => {
    const rules = draft.ruleResults.map((r) => {
      if (r.id !== ruleResultId) return r;
      updated = { ...r, reviewed: true, inspectorDecision: decision, inspectorNote: note };
      return updated;
    });
    return {
      ...draft,
      ruleResults: rules,
      updatedAt: new Date().toISOString(),
      auditTrail: [
        ...draft.auditTrail,
        {
          id: `evt-${Math.random().toString(36).slice(2, 9)}`,
          timestamp: new Date().toISOString(),
          actor: CURRENT_INSPECTOR.name,
          action: "Inspector reviewed finding",
          detail: rules.find((r) => r.id === ruleResultId)?.requirement,
        },
      ],
    };
  });
  return delay(updated, 150);
}

/** POST /api/inspections/{id}/finalize */
export async function finalizeInspection(
  inspectionId: string,
  finalNotes?: string
): Promise<Inspection | undefined> {
  inspectionStore.update(inspectionId, (draft) => {
    const now = new Date().toISOString();
    return {
      ...draft,
      stage: "FINALIZED",
      finalizedAt: now,
      updatedAt: now,
      notes: finalNotes ?? draft.notes,
      overallStatus: calculateOverallStatus(draft.ruleResults),
      auditTrail: [
        ...draft.auditTrail,
        {
          id: `evt-${Math.random().toString(36).slice(2, 9)}`,
          timestamp: now,
          actor: CURRENT_INSPECTOR.name,
          action: "Inspection finalized",
          detail: `Overall status: ${calculateOverallStatus(draft.ruleResults)}`,
        },
      ],
    };
  });
  return delay(inspectionStore.getById(inspectionId), 300);
}
