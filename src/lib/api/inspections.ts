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
import { apiGet, apiPatch, apiPost, apiUpload, dataUrlToBlob, isApiConfigured, ApiError } from "@/lib/api/client";
import { mapExtractedField, mapInspectionDetail, mapInspectionSummary, mapRuleResult } from "@/lib/api/mappers";
import type {
  ApiExtractedFieldResponse,
  ApiExtractedFieldUpdateRequest,
  ApiFinalizeInspectionRequest,
  ApiFinalizeInspectionResponse,
  ApiInspectionCreate,
  ApiInspectionCreateResponse,
  ApiInspectionDetail,
  ApiInspectionResultsResponse,
  ApiInspectionSummary,
  ApiPage,
  ApiRuleResultResponse,
  ApiRuleReviewRequest,
} from "@/types/api";

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
  /** Original File object, when available — used for the real upload so
   * we send the actual bytes instead of round-tripping through base64. */
  file?: File;
}

/** POST /api/v1/inspections, then POST /api/v1/inspections/{id}/images */
async function createInspectionViaApi(
  input: CreateInspectionInput,
  images: UploadedImageInput[]
): Promise<Inspection> {
  const payload: ApiInspectionCreate = {
    product_name: input.productName,
    brand: input.brand,
    category: input.category,
    batch_number: input.batchNumber,
    inspection_location: input.location,
    notes: input.notes,
  };
  const created = await apiPost<ApiInspectionCreateResponse>("/api/v1/inspections", payload);

  if (images.length > 0) {
    const form = new FormData();
    for (const img of images) {
      const blob = img.file ?? (await dataUrlToBlob(img.dataUrl));
      form.append("files", blob, img.fileName);
      form.append("view_types", img.viewType);
    }
    await apiUpload(`/api/v1/inspections/${created.id}/images`, form);
  }

  const detail = await apiGet<ApiInspectionDetail>(`/api/v1/inspections/${created.id}`);
  return mapInspectionDetail(detail);
}

/** POST /api/inspections */
export async function createInspection(
  input: CreateInspectionInput,
  images: UploadedImageInput[]
): Promise<Inspection> {
  if (isApiConfigured()) return createInspectionViaApi(input, images);

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

/** GET /api/v1/inspections/{id} */
export async function getInspection(id: string): Promise<Inspection | undefined> {
  if (isApiConfigured()) {
    try {
      const detail = await apiGet<ApiInspectionDetail>(`/api/v1/inspections/${id}`);
      return mapInspectionDetail(detail);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }
  }
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

/** GET /api/v1/inspections */
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

  if (isApiConfigured()) {
    const result = await apiGet<ApiPage<ApiInspectionSummary>>("/api/v1/inspections", {
      search,
      status: status && status !== "ALL" ? status : undefined,
      category: category && category !== "ALL" ? category : undefined,
      inspector_id: inspectorId && inspectorId !== "ALL" ? inspectorId : undefined,
      date_from: dateFrom,
      date_to: dateTo,
      page,
      page_size: pageSize,
    });
    return {
      items: result.items.map(mapInspectionSummary),
      total: result.total,
      page: result.page,
      pageSize: result.page_size,
    };
  }

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

/** GET /api/v1/inspections/{id}/results */
export async function getInspectionResults(
  id: string
): Promise<InspectionResultsResponse | undefined> {
  if (isApiConfigured()) {
    try {
      const data = await apiGet<ApiInspectionResultsResponse>(`/api/v1/inspections/${id}/results`);
      return { overall_status: data.overall_status, summary: data.summary };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }
  }

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

/** POST /api/v1/inspections/{id}/process — runs OCR + extraction + rule engine. */
export async function runProcessing(id: string): Promise<Inspection | undefined> {
  if (isApiConfigured()) {
    // Left to throw on failure (ApiError, e.g. PROCESSING_FAILED) — the
    // processing page's try/catch around this call is exactly what
    // surfaces that as the retry UI.
    const detail = await apiPost<ApiInspectionDetail>(`/api/v1/inspections/${id}/process`);
    return mapInspectionDetail(detail);
  }

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

/** PATCH /api/v1/inspections/{id}/fields/{fieldId} */
export async function updateExtractedField(
  inspectionId: string,
  fieldId: string,
  value: string | null
): Promise<ExtractedField | undefined> {
  if (isApiConfigured()) {
    const body: ApiExtractedFieldUpdateRequest = { value, manually_verified: true };
    const updated = await apiPatch<ApiExtractedFieldResponse>(
      `/api/v1/inspections/${inspectionId}/fields/${fieldId}`,
      body
    );
    return mapExtractedField(updated);
  }

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

/** PATCH /api/v1/inspections/{id}/rules/{ruleId}/review */
export async function reviewRule(
  inspectionId: string,
  ruleResultId: string,
  decision: "CONFIRMED" | "CORRECTED",
  note?: string
): Promise<RuleResult | undefined> {
  if (isApiConfigured()) {
    const body: ApiRuleReviewRequest = { reviewed: true, inspector_note: note };
    void decision; // the backend records the review via `reviewed` + note; corrections go through updateExtractedField
    const updated = await apiPatch<ApiRuleResultResponse>(
      `/api/v1/inspections/${inspectionId}/rules/${ruleResultId}/review`,
      body
    );
    return mapRuleResult(updated);
  }

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

/** POST /api/v1/inspections/{id}/finalize */
export async function finalizeInspection(
  inspectionId: string,
  finalNotes?: string
): Promise<Inspection | undefined> {
  if (isApiConfigured()) {
    const body: ApiFinalizeInspectionRequest = { final_notes: finalNotes };
    const result = await apiPost<ApiFinalizeInspectionResponse>(
      `/api/v1/inspections/${inspectionId}/finalize`,
      body
    );
    if (!result.can_finalize || !result.inspection) {
      throw new Error(result.reason ?? "This inspection cannot be finalized yet.");
    }
    return mapInspectionDetail(result.inspection);
  }

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
