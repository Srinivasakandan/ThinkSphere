"use client";

import type { Rule } from "@/types";
import { MOCK_RULES } from "@/lib/mock/rules";

function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** GET /api/rules */
export async function getRules(): Promise<Rule[]> {
  return delay(MOCK_RULES);
}
