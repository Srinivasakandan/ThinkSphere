"use client";

import type { Rule } from "@/types";
import { MOCK_RULES } from "@/lib/mock/rules";
import { apiGet, isApiConfigured } from "@/lib/api/client";
import type { ApiPage, ApiRuleResponse } from "@/types/api";

function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function mapRule(r: ApiRuleResponse): Rule {
  return {
    id: r.id,
    category: r.category,
    requirement: r.title,
    applicableCategory: r.applicable_category,
    source: r.legal_source,
    version: r.version,
    effectiveDate: r.effective_from ?? "",
    status: r.active ? "Active" : "Superseded",
  };
}

/** GET /api/v1/rules — fetches the full repository across all pages so
 * the existing rules page (which filters/sorts client-side) keeps
 * working unchanged. */
export async function getRules(): Promise<Rule[]> {
  if (isApiConfigured()) {
    const rules: Rule[] = [];
    let page = 1;
    for (;;) {
      const result = await apiGet<ApiPage<ApiRuleResponse>>("/api/v1/rules", {
        page,
        page_size: 100,
      });
      rules.push(...result.items.map(mapRule));
      if (rules.length >= result.total || result.items.length === 0) break;
      page += 1;
    }
    return rules;
  }
  return delay(MOCK_RULES);
}
