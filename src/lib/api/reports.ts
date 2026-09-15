"use client";

import type { ReportFilters, ReportSummary } from "@/types";
import { inspectionStore } from "@/lib/mock/store";

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function filtered(filters: ReportFilters) {
  return inspectionStore.getAll().filter((i) => {
    if (i.stage === "DRAFT" || i.stage === "UPLOADING") return false;
    if (filters.category && filters.category !== "ALL" && i.category !== filters.category) return false;
    if (filters.status && filters.status !== ("ALL" as ReportFilters["status"]) && i.overallStatus !== filters.status) return false;
    if (filters.inspectorId && filters.inspectorId !== "ALL" && i.inspectorId !== filters.inspectorId) return false;
    if (filters.dateFrom && new Date(i.createdAt) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(i.createdAt) > new Date(filters.dateTo)) return false;
    return true;
  });
}

/** GET /api/reports/summary */
export async function getReportSummary(filters: ReportFilters): Promise<ReportSummary> {
  const items = filtered(filters);
  return delay({
    total: items.length,
    passed: items.filter((i) => i.overallStatus === "PASS").length,
    potentialNonCompliance: items.filter((i) => i.overallStatus === "POTENTIAL_NON_COMPLIANCE").length,
    needsReview: items.filter((i) => i.overallStatus === "NEEDS_REVIEW").length,
  });
}

/** POST /api/reports/generate — stub for future PDF generation via FastAPI. */
export async function generatePdfReport(filters: ReportFilters): Promise<{ ok: true; fileName: string }> {
  const scope = filters.category ?? "all-categories";
  const fileName = `legal-metrology-report-${scope}-${Date.now()}.pdf`;
  return delay({ ok: true, fileName }, 600);
}

/** POST /api/reports/export — stub for future CSV/XLSX export via FastAPI. */
export async function exportInspectionData(filters: ReportFilters): Promise<{ ok: true; fileName: string; rowCount: number }> {
  const items = filtered(filters);
  const fileName = `legal-metrology-export-${Date.now()}.csv`;
  return delay({ ok: true, fileName, rowCount: items.length }, 500);
}
