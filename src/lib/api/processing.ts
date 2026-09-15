"use client";

/**
 * Thin wrappers around the processing-pipeline endpoints that aren't yet
 * consumed by any page (the processing page currently drives its progress
 * UI off a client-side animation around runProcessing() in
 * lib/api/inspections.ts, which is synchronous either way). Exposed here
 * so a future polling UI, or the OCR debug view, can use them directly
 * against the real backend without inventing a new mock shape.
 */
import { apiGet, isApiConfigured } from "@/lib/api/client";
import type { ApiOcrResultsResponse, ApiProcessingStatusResponse } from "@/types/api";

/** GET /api/v1/inspections/{id}/processing-status */
export async function getProcessingStatus(
  inspectionId: string
): Promise<ApiProcessingStatusResponse | undefined> {
  if (!isApiConfigured()) return undefined;
  return apiGet<ApiProcessingStatusResponse>(`/api/v1/inspections/${inspectionId}/processing-status`);
}

/** GET /api/v1/inspections/{id}/ocr */
export async function getOcrResults(inspectionId: string): Promise<ApiOcrResultsResponse | undefined> {
  if (!isApiConfigured()) return undefined;
  return apiGet<ApiOcrResultsResponse>(`/api/v1/inspections/${inspectionId}/ocr`);
}
