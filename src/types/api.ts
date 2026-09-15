/**
 * Raw backend API contract types — the wire shapes documented in
 * docs/API_CONTRACT.md, mirroring backend/app/schemas/*.py field for
 * field (snake_case, same optionality).
 *
 * These are intentionally NOT the types the rest of the frontend uses
 * (see @/types for the UI-oriented domain model). lib/api/mappers.ts
 * converts between the two so existing components never need to know
 * whether they're looking at mock data or a real backend response.
 */

// ---- Shared enums --------------------------------------------------------

export type ApiInspectionStage =
  | "CREATED"
  | "IMAGES_UPLOADED"
  | "PROCESSING"
  | "OCR_COMPLETED"
  | "EXTRACTION_COMPLETED"
  | "VALIDATION_COMPLETED"
  | "RULE_EVALUATION_COMPLETED"
  | "READY_FOR_REVIEW"
  | "FINALIZED"
  | "PROCESSING_FAILED";

export type ApiInspectionStatus = "PASS" | "POTENTIAL_NON_COMPLIANCE" | "NEEDS_REVIEW";

export type ApiImageViewType = "FRONT" | "BACK" | "LEFT" | "RIGHT" | "TOP" | "BOTTOM" | "OTHER";

export type ApiImageProcessingStatus = "UPLOADED" | "PROCESSING" | "PROCESSED" | "FAILED";

export type ApiImageQuality = "GOOD" | "FAIR" | "POOR" | "UNKNOWN";

export type ApiConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type ApiValidationStatus = "VALID" | "INVALID" | "CONFLICT" | "UNCERTAIN" | "NOT_VALIDATED";

export type ApiRuleConditionType =
  | "REQUIRED"
  | "OPTIONAL"
  | "FORMAT"
  | "VALUE"
  | "UNIT"
  | "DATE"
  | "RANGE"
  | "CONDITIONAL"
  | "MANUAL_REVIEW";

export type ApiUserRole = "INSPECTOR" | "SUPERVISOR" | "ADMIN";

// ---- Envelopes ------------------------------------------------------------

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorBody {
  error: ApiErrorDetail;
}

export interface ApiPage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ---- Auth / inspector -------------------------------------------------

export interface ApiInspectorResponse {
  id: string;
  full_name: string;
  email: string;
  role: string;
  badge_id: string | null;
}

// ---- Product ------------------------------------------------------------

export interface ApiProductCreate {
  product_name?: string | null;
  brand?: string | null;
  category?: string | null;
  batch_number?: string | null;
}

export interface ApiProductResponse {
  id: string;
  product_name: string | null;
  brand: string | null;
  category: string | null;
  batch_number: string | null;
}

// ---- Images -------------------------------------------------------------

export interface ApiImageResponse {
  id: string;
  inspection_id: string;
  view_type: ApiImageViewType;
  original_filename: string;
  mime_type: string;
  file_size: number;
  image_quality: ApiImageQuality;
  quality_note: string | null;
  processing_status: ApiImageProcessingStatus;
  url: string;
  created_at: string;
}

// ---- OCR ------------------------------------------------------------------

export interface ApiOcrResultResponse {
  image_id: string;
  raw_text: string;
  ocr_confidence: number;
  processing_status: ApiImageProcessingStatus;
}

export interface ApiOcrResultsResponse {
  items: ApiOcrResultResponse[];
}

// ---- Extraction -------------------------------------------------------

export interface ApiFieldCandidate {
  value: string;
  source_image_id: string | null;
}

export interface ApiExtractedFieldResponse {
  id: string;
  inspection_id: string;
  field_name: string;
  value: string | null;
  normalized_value: string | null;
  confidence: number;
  confidence_level: ApiConfidenceLevel;
  validation_status: ApiValidationStatus;
  validation_reason: string | null;
  source_image_id: string | null;
  source_text: string | null;
  manually_verified: boolean;
  manually_edited: boolean;
  candidates: ApiFieldCandidate[] | null;
}

export interface ApiExtractedFieldsResponse {
  fields: ApiExtractedFieldResponse[];
}

export interface ApiExtractedFieldUpdateRequest {
  value?: string | null;
  manually_verified?: boolean;
  note?: string | null;
}

// ---- Rules ----------------------------------------------------------------

export interface ApiRuleResponse {
  id: string;
  rule_code: string;
  title: string;
  description: string;
  category: string;
  field_name: string;
  condition_type: ApiRuleConditionType;
  expected_value: string | null;
  expected_unit: string | null;
  applicable_category: string;
  legal_source: string;
  version: string;
  effective_from: string | null;
  effective_to: string | null;
  active: boolean;
  is_demo: boolean;
}

export interface ApiRuleResultResponse {
  id: string;
  inspection_id: string;
  rule_id: string;
  rule_code: string;
  requirement: string;
  field_name: string;
  detected_value: string | null;
  status: ApiInspectionStatus;
  reason: string;
  confidence: number | null;
  evidence_image_id: string | null;
  reviewed: boolean;
  reviewer_id: string | null;
  reviewed_at: string | null;
  inspector_note: string | null;
}

export interface ApiRuleResultsResponse {
  rules: ApiRuleResultResponse[];
}

export interface ApiRuleSummary {
  rule_code: string;
  title: string;
  description: string;
  legal_source: string;
}

export interface ApiRuleResultDetailResponse {
  rule_result_id: string;
  rule: ApiRuleSummary;
  field_name: string;
  detected_value: string | null;
  status: ApiInspectionStatus;
  reason: string;
  confidence: number | null;
  evidence_image_id: string | null;
  reviewed: boolean;
  reviewer_id: string | null;
  reviewed_at: string | null;
  inspector_note: string | null;
}

export interface ApiRuleReviewRequest {
  reviewed?: boolean;
  inspector_note?: string | null;
  corrected_value?: string | null;
}

// ---- Inspections ----------------------------------------------------------

export interface ApiInspectionCreate extends ApiProductCreate {
  inspection_location?: string | null;
  notes?: string | null;
}

export interface ApiInspectionCreateResponse {
  id: string;
  stage: ApiInspectionStage;
}

export interface ApiInspectionSummary {
  id: string;
  product_name: string | null;
  category: string | null;
  stage: ApiInspectionStage;
  overall_status: ApiInspectionStatus;
  inspector_name: string;
  created_at: string;
}

export interface ApiInspectionDetail {
  id: string;
  stage: ApiInspectionStage;
  overall_status: ApiInspectionStatus;
  inspector: ApiInspectorResponse;
  product: ApiProductResponse | null;
  images: ApiImageResponse[];
  extracted_fields: ApiExtractedFieldResponse[];
  rule_results: ApiRuleResultResponse[];
  inspection_location: string | null;
  notes: string | null;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
}

export type ApiProcessingPipelineStage =
  | "UPLOADING"
  | "OCR"
  | "EXTRACTION"
  | "VALIDATION"
  | "RULE_EVALUATION"
  | "COMPLETED"
  | "FAILED";

export interface ApiProcessingStatusResponse {
  inspection_id: string;
  stage: ApiProcessingPipelineStage;
  progress: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  error: string | null;
}

export interface ApiFinalizeInspectionRequest {
  final_notes?: string | null;
}

export interface ApiFinalizeInspectionResponse {
  can_finalize: boolean;
  reason: string | null;
  inspection: ApiInspectionDetail | null;
}

export interface ApiResultsSummary {
  total: number;
  passed: number;
  potential_non_compliance: number;
  needs_review: number;
}

export interface ApiInspectionResultsResponse {
  inspection_id: string;
  product: ApiProductResponse | null;
  overall_status: ApiInspectionStatus;
  summary: ApiResultsSummary;
  rules: ApiRuleResultResponse[];
}

// ---- Dashboard --------------------------------------------------------

export interface ApiDashboardSummaryResponse {
  total: number;
  passed: number;
  potential_non_compliance: number;
  needs_review: number;
}

export interface ApiTrendPoint {
  date: string;
  inspections: number;
}

export interface ApiDashboardTrendsResponse {
  points: ApiTrendPoint[];
}

export interface ApiRecentInspectionsResponse {
  items: ApiInspectionSummary[];
}

// ---- Reports ------------------------------------------------------------

export interface ApiReportGenerateResponse {
  report_id: string;
  inspection_id: string;
  file_path: string;
  url: string | null;
}
