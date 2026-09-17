"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { usePageHeader } from "@/components/layout/page-header-context";
import { InspectionStepper } from "@/components/inspection/inspection-stepper";
import { RuleTable } from "@/components/inspection/rule-table";
import { RuleDetails } from "@/components/inspection/rule-details";
import { ImageViewer } from "@/components/inspection/image-viewer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common/error-state";
import { InspectionDetailSkeleton } from "@/components/common/skeletons";
import { getInspection, reviewRule } from "@/lib/api/inspections";
import { summarizeRuleResults } from "@/lib/inspection/status";
import type { BoundingBox, Inspection, RuleResult } from "@/types";

export default function RuleEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  usePageHeader(`Rule Evaluation — ${id}`, [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Inspections", href: "/inspections" },
    { label: id, href: `/inspections/${id}` },
    { label: "Rule Evaluation" },
  ]);
  const router = useRouter();
  const [inspection, setInspection] = useState<Inspection | null | undefined>(undefined);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [viewerImageId, setViewerImageId] = useState<string | null>(null);
  const [viewerHighlight, setViewerHighlight] = useState<BoundingBox | undefined>(undefined);

  useEffect(() => {
    getInspection(id).then((res) => setInspection(res ?? null));
  }, [id]);

  if (inspection === undefined) return <InspectionDetailSkeleton />;
  if (inspection === null) {
    return (
      <ErrorState
        title="Unable to retrieve inspection"
        description={`Inspection ${id} could not be found.`}
        actionLabel="Back to Inspections"
        onAction={() => router.push("/inspections")}
      />
    );
  }

  const summary = summarizeRuleResults(inspection.ruleResults);
  const selectedRule: RuleResult | null =
    inspection.ruleResults.find((r) => r.id === selectedRuleId) ?? null;

  async function handleMarkReviewed(ruleId: string, note?: string) {
    const updated = await reviewRule(id, ruleId, "CONFIRMED", note);
    if (!updated) return;
    setInspection((prev) =>
      prev ? { ...prev, ruleResults: prev.ruleResults.map((r) => (r.id === ruleId ? updated : r)) } : prev
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardContent className="pt-5">
          <InspectionStepper currentStep={4} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Product</p>
            <p className="text-base font-semibold text-foreground">{inspection.productName ?? "Unlabeled Product"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</p>
            <p className="text-base font-semibold text-foreground">{inspection.category ?? "—"}</p>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-status-pass">
              <CheckCircle2 className="h-4 w-4" /> {summary.passed} Passed
            </span>
            <span className="inline-flex items-center gap-1.5 text-status-fail">
              <XCircle className="h-4 w-4" /> {summary.potentialNonCompliance} Non-Compliance
            </span>
            <span className="inline-flex items-center gap-1.5 text-status-warn">
              <AlertTriangle className="h-4 w-4" /> {summary.needsReview} Review
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Rule Evaluation</CardTitle>
          <CardDescription>
            Each row reflects a system-detected finding against Legal Metrology (Packaged
            Commodities) Rules, 2011 requirements. Potential issues require your verification
            before this inspection can be finalized.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RuleTable
            rules={inspection.ruleResults}
            images={inspection.images}
            onSelect={(rule) => setSelectedRuleId(rule.id)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push(`/inspections/${id}/extracted`)}>
          Back to Extracted Information
        </Button>
        <Button onClick={() => router.push(`/inspections/${id}/results`)}>
          Continue to Results
        </Button>
      </div>

      <RuleDetails
        rule={selectedRule}
        images={inspection.images}
        onOpenChange={(open) => !open && setSelectedRuleId(null)}
        onViewEvidence={(imageId) => {
          const field = inspection.extractedFields.find(
            (f) => f.field === selectedRule?.field && f.sourceImageId === imageId
          );
          setViewerHighlight(field?.boundingBox);
          setViewerImageId(imageId);
        }}
        onMarkReviewed={handleMarkReviewed}
      />
      <ImageViewer
        images={inspection.images}
        openImageId={viewerImageId}
        onOpenChange={(imageId) => {
          setViewerImageId(imageId);
          setViewerHighlight(undefined);
        }}
        highlightBox={viewerHighlight}
      />
    </div>
  );
}
