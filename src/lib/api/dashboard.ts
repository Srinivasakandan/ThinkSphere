"use client";

/**
 * Dashboard aggregate endpoints. The dashboard page currently renders its
 * summary cards/trend chart from static mock data
 * (lib/mock/dashboard.ts) rather than through a service call — these
 * wrappers exist so that data can be swapped for the real backend
 * without inventing a new response shape later, matching the endpoints
 * documented in docs/API_CONTRACT.md.
 */
import { COMPLIANCE_DISTRIBUTION, DASHBOARD_TOTALS, INSPECTION_TREND } from "@/lib/mock/dashboard";
import { apiGet, isApiConfigured } from "@/lib/api/client";
import type {
  ApiDashboardSummaryResponse,
  ApiDashboardTrendsResponse,
  ApiRecentInspectionsResponse,
} from "@/types/api";
import { mapInspectionSummary } from "@/lib/api/mappers";
import type { Inspection } from "@/types";

function delay<T>(value: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** GET /api/v1/dashboard/summary */
export async function getDashboardSummary(): Promise<ApiDashboardSummaryResponse> {
  if (isApiConfigured()) {
    return apiGet<ApiDashboardSummaryResponse>("/api/v1/dashboard/summary");
  }
  return delay({
    total: DASHBOARD_TOTALS.total,
    passed: DASHBOARD_TOTALS.passed,
    potential_non_compliance: DASHBOARD_TOTALS.potentialNonCompliance,
    needs_review: DASHBOARD_TOTALS.needsReview,
  });
}

/** GET /api/v1/dashboard/trends */
export async function getDashboardTrends(days = 30): Promise<ApiDashboardTrendsResponse> {
  if (isApiConfigured()) {
    return apiGet<ApiDashboardTrendsResponse>("/api/v1/dashboard/trends", { days });
  }
  return delay({ points: INSPECTION_TREND.map((p) => ({ date: p.date, inspections: p.inspections })) });
}

/** GET /api/v1/dashboard/recent-inspections */
export async function getRecentInspections(limit = 6): Promise<Inspection[]> {
  if (isApiConfigured()) {
    const result = await apiGet<ApiRecentInspectionsResponse>("/api/v1/dashboard/recent-inspections", {
      limit,
    });
    return result.items.map(mapInspectionSummary);
  }
  return delay([]);
}

export { COMPLIANCE_DISTRIBUTION };
