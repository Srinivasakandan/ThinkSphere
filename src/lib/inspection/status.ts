import type {
  InspectionStatus,
  InspectionSummaryCounts,
  RuleResult,
} from "@/types";

/**
 * Centralized precedence for rolling many rule results up into one overall
 * inspection status. Any potential non-compliance outranks a needs-review,
 * which outranks a clean pass. Keep all status derivation here so no
 * component re-implements this logic.
 */
export function calculateOverallStatus(
  ruleResults: RuleResult[]
): InspectionStatus {
  if (ruleResults.length === 0) return "NEEDS_REVIEW";
  if (ruleResults.some((r) => r.status === "POTENTIAL_NON_COMPLIANCE")) {
    return "POTENTIAL_NON_COMPLIANCE";
  }
  if (ruleResults.some((r) => r.status === "NEEDS_REVIEW")) {
    return "NEEDS_REVIEW";
  }
  return "PASS";
}

export function summarizeRuleResults(
  ruleResults: RuleResult[]
): InspectionSummaryCounts {
  return {
    total: ruleResults.length,
    passed: ruleResults.filter((r) => r.status === "PASS").length,
    potentialNonCompliance: ruleResults.filter(
      (r) => r.status === "POTENTIAL_NON_COMPLIANCE"
    ).length,
    needsReview: ruleResults.filter((r) => r.status === "NEEDS_REVIEW")
      .length,
  };
}

export const STATUS_LABEL: Record<InspectionStatus, string> = {
  PASS: "Pass",
  POTENTIAL_NON_COMPLIANCE: "Potential Non-Compliance",
  NEEDS_REVIEW: "Needs Review",
};

export const STATUS_SHORT_LABEL: Record<InspectionStatus, string> = {
  PASS: "Pass",
  POTENTIAL_NON_COMPLIANCE: "Non-Compliance",
  NEEDS_REVIEW: "Review",
};

/**
 * Human-readable, legally-careful explanation of what a status means.
 * Never phrase POTENTIAL_NON_COMPLIANCE as a confirmed violation.
 */
export const STATUS_EXPLANATION: Record<InspectionStatus, string> = {
  PASS: "The declared information satisfies this requirement based on available evidence.",
  POTENTIAL_NON_COMPLIANCE:
    "The system detected a possible gap against this requirement. This is not a final legal determination — inspector verification is required.",
  NEEDS_REVIEW:
    "The system could not reliably determine compliance. Inspector verification against the original image is required.",
};
