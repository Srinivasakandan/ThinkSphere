import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate } from "@/lib/format";
import type { Inspection } from "@/types";
import { summarizeRuleResults } from "@/lib/inspection/status";

export function InspectionSummary({ inspection }: { inspection: Inspection }) {
  const summary = summarizeRuleResults(inspection.ruleResults);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Inspection {inspection.id}
          </p>
          <h2 className="mt-0.5 text-xl font-semibold text-foreground">
            {inspection.productName ?? "Unlabeled Product"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {inspection.category ?? "—"} · {inspection.brand ?? "Unknown brand"} · {formatDate(inspection.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Overall Status
          </p>
          <StatusBadge status={inspection.overallStatus} size="lg" showExplanation />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md bg-muted px-3 py-2.5 text-center">
          <p className="text-lg font-semibold text-foreground">{summary.total}</p>
          <p className="text-xs text-muted-foreground">Rules Checked</p>
        </div>
        <div className="rounded-md bg-status-pass-bg px-3 py-2.5 text-center">
          <p className="flex items-center justify-center gap-1 text-lg font-semibold text-status-pass">
            <CheckCircle2 className="h-4 w-4" /> {summary.passed}
          </p>
          <p className="text-xs text-status-pass">Passed</p>
        </div>
        <div className="rounded-md bg-status-fail-bg px-3 py-2.5 text-center">
          <p className="flex items-center justify-center gap-1 text-lg font-semibold text-status-fail">
            <XCircle className="h-4 w-4" /> {summary.potentialNonCompliance}
          </p>
          <p className="text-xs text-status-fail">Potential Non-Compliance</p>
        </div>
        <div className="rounded-md bg-status-warn-bg px-3 py-2.5 text-center">
          <p className="flex items-center justify-center gap-1 text-lg font-semibold text-status-warn">
            <AlertTriangle className="h-4 w-4" /> {summary.needsReview}
          </p>
          <p className="text-xs text-status-warn">Needs Review</p>
        </div>
      </div>
    </div>
  );
}
