export interface TrendPoint {
  date: string;
  inspections: number;
}

export interface DistributionSlice {
  name: string;
  value: number;
  status: "PASS" | "POTENTIAL_NON_COMPLIANCE" | "NEEDS_REVIEW";
}

const WEEK_LABELS = [
  "Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Wk 7", "Wk 8",
];

export const INSPECTION_TREND: TrendPoint[] = [
  { date: WEEK_LABELS[0], inspections: 98 },
  { date: WEEK_LABELS[1], inspections: 112 },
  { date: WEEK_LABELS[2], inspections: 134 },
  { date: WEEK_LABELS[3], inspections: 121 },
  { date: WEEK_LABELS[4], inspections: 156 },
  { date: WEEK_LABELS[5], inspections: 149 },
  { date: WEEK_LABELS[6], inspections: 178 },
  { date: WEEK_LABELS[7], inspections: 165 },
];

export const COMPLIANCE_DISTRIBUTION: DistributionSlice[] = [
  { name: "Pass", value: 932, status: "PASS" },
  { name: "Potential Non-Compliance", value: 184, status: "POTENTIAL_NON_COMPLIANCE" },
  { name: "Needs Review", value: 132, status: "NEEDS_REVIEW" },
];

export const DASHBOARD_TOTALS = {
  total: 1248,
  passed: 932,
  potentialNonCompliance: 184,
  needsReview: 132,
};
