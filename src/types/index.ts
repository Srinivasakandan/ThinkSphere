/**
 * Core domain types for the Legal Metrology inspection workflow.
 * These types define the contract the frontend expects from the backend
 * (eventually a FastAPI service). Keep this file the single source of
 * truth for shapes shared across pages/components.
 */

export type InspectionStatus =
  | "PASS"
  | "POTENTIAL_NON_COMPLIANCE"
  | "NEEDS_REVIEW";

/** Lifecycle state of an inspection record, distinct from its compliance status. */
export type InspectionStage =
  | "DRAFT"
  | "UPLOADING"
  | "PROCESSING"
  | "EXTRACTED"
  | "RULES_EVALUATED"
  | "UNDER_REVIEW"
  | "FINALIZED";

export type ExtractionConfidence = "HIGH" | "MEDIUM" | "LOW";

export type ImageViewType =
  | "FRONT"
  | "BACK"
  | "LEFT"
  | "RIGHT"
  | "TOP"
  | "BOTTOM"
  | "OTHER";

export type ImageQuality = "GOOD" | "FAIR" | "POOR";

export type ProductCategory =
  | "Food"
  | "Beverage"
  | "Cosmetics"
  | "Household Goods"
  | "Personal Care"
  | "Electrical"
  | "Other";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProductImage {
  id: string;
  inspectionId: string;
  url: string;
  fileName: string;
  viewType: ImageViewType;
  quality?: ImageQuality;
  qualityNote?: string;
  uploadedAt: string;
  /** Reserved for future OCR bounding-box overlays. */
  boundingBoxes?: BoundingBox[];
}

export interface ExtractedField {
  id: string;
  field: string;
  label: string;
  value: string | null;
  confidence: ExtractionConfidence;
  sourceImageId?: string;
  validated: boolean;
  manuallyEdited: boolean;
  explanation?: string;
}

export interface RuleResult {
  id: string;
  ruleId: string;
  requirement: string;
  field: string;
  detectedValue?: string | null;
  status: InspectionStatus;
  reason: string;
  evidenceImageId?: string;
  reviewed: boolean;
  inspectorNote?: string;
  inspectorDecision?: "CONFIRMED" | "CORRECTED";
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  detail?: string;
}

export interface Inspection {
  id: string;
  productName?: string;
  brand?: string;
  category?: ProductCategory;
  batchNumber?: string;
  location?: string;
  notes?: string;
  stage: InspectionStage;
  images: ProductImage[];
  extractedFields: ExtractedField[];
  ruleResults: RuleResult[];
  overallStatus: InspectionStatus;
  inspectorId: string;
  inspectorName: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  auditTrail: AuditEvent[];
}

export interface InspectionSummaryCounts {
  total: number;
  passed: number;
  potentialNonCompliance: number;
  needsReview: number;
}

export interface InspectionResultsResponse {
  overall_status: InspectionStatus;
  summary: {
    total: number;
    passed: number;
    potential_non_compliance: number;
    needs_review: number;
  };
}

export type UserRole = "Inspector" | "Supervisor" | "Administrator";

export interface Inspector {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  badgeId?: string;
  avatarUrl?: string;
}

export interface Rule {
  id: string;
  category: string;
  requirement: string;
  applicableCategory: string;
  source: string;
  version: string;
  effectiveDate: string;
  status: "Active" | "Superseded" | "Draft";
}

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  status?: InspectionStatus;
  inspectorId?: string;
}

export interface ReportSummary {
  total: number;
  passed: number;
  potentialNonCompliance: number;
  needsReview: number;
}
