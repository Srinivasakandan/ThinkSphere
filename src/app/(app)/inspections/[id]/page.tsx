"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { usePageHeader } from "@/components/layout/page-header-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "@/components/common/confidence-badge";
import { InspectionSummary } from "@/components/inspection/inspection-summary";
import { RuleTable } from "@/components/inspection/rule-table";
import { RuleDetails } from "@/components/inspection/rule-details";
import { ImageViewer } from "@/components/inspection/image-viewer";
import { AuditTrail } from "@/components/inspection/audit-trail";
import { ErrorState } from "@/components/common/error-state";
import { InspectionDetailSkeleton } from "@/components/common/skeletons";
import { formatDateTime, formatViewType } from "@/lib/format";
import { getInspection, reviewRule } from "@/lib/api/inspections";
import type { Inspection, RuleResult } from "@/types";

const QUALITY_STYLES: Record<string, string> = {
  GOOD: "bg-status-pass-bg text-status-pass border-status-pass-border",
  FAIR: "bg-status-warn-bg text-status-warn border-status-warn-border",
  POOR: "bg-status-fail-bg text-status-fail border-status-fail-border",
};

const STAGE_ROUTE: Record<string, string> = {
  UPLOADING: "processing",
  PROCESSING: "processing",
  EXTRACTED: "extracted",
  RULES_EVALUATED: "rules",
  UNDER_REVIEW: "results",
};

export default function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  usePageHeader(`Inspection ${id}`, [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Inspections", href: "/inspections" },
    { label: id },
  ]);
  const router = useRouter();
  const [inspection, setInspection] = useState<Inspection | null | undefined>(undefined);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [viewerImageId, setViewerImageId] = useState<string | null>(null);

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

  const selectedRule: RuleResult | null =
    inspection.ruleResults.find((r) => r.id === selectedRuleId) ?? null;
  const continueRoute = STAGE_ROUTE[inspection.stage];

  async function handleMarkReviewed(ruleId: string, note?: string) {
    const updated = await reviewRule(id, ruleId, "CONFIRMED", note);
    if (!updated) return;
    setInspection((prev) =>
      prev ? { ...prev, ruleResults: prev.ruleResults.map((r) => (r.id === ruleId ? updated : r)) } : prev
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <InspectionSummary inspection={inspection} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
          <span>Inspector: <span className="text-foreground">{inspection.inspectorName}</span></span>
          <span>Created: <span className="text-foreground">{formatDateTime(inspection.createdAt)}</span></span>
          <span>Updated: <span className="text-foreground">{formatDateTime(inspection.updatedAt)}</span></span>
          {inspection.finalizedAt && (
            <span>Finalized: <span className="text-foreground">{formatDateTime(inspection.finalizedAt)}</span></span>
          )}
        </div>
        {continueRoute && (
          <Button size="sm" onClick={() => router.push(`/inspections/${id}/${continueRoute}`)}>
            Continue Inspection <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
        {inspection.stage === "FINALIZED" && (
          <Button size="sm" variant="outline" onClick={() => router.push(`/inspections/${id}/results`)}>
            View Results
          </Button>
        )}
      </div>

      <Tabs defaultValue="images">
        <TabsList className="flex-wrap">
          <TabsTrigger value="images">Product Images</TabsTrigger>
          <TabsTrigger value="extracted">Extracted Information</TabsTrigger>
          <TabsTrigger value="rules">Rule Evaluation</TabsTrigger>
          <TabsTrigger value="audit">Audit Information</TabsTrigger>
        </TabsList>

        <TabsContent value="images">
          <Card>
            <CardHeader>
              <CardTitle>Product Images ({inspection.images.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {inspection.images.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setViewerImageId(img.id)}
                    className="focus-ring group relative aspect-[4/5] overflow-hidden rounded-md border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={`${formatViewType(img.viewType)} view`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-1 text-center text-xs font-medium text-white">
                      {formatViewType(img.viewType)}
                    </span>
                    {img.quality && (
                      <span className={`absolute right-1.5 top-1.5 rounded-full border px-1.5 py-0 text-[10px] font-semibold ${QUALITY_STYLES[img.quality]}`}>
                        {img.quality === "GOOD" ? "Good" : img.quality === "FAIR" ? "Fair" : "Poor"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extracted">
          <Card>
            <CardHeader>
              <CardTitle>Extracted Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {inspection.extractedFields.map((field) => (
                <div key={field.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{field.label}</p>
                    <p className="text-sm font-semibold text-foreground">
                      {field.value ?? <span className="italic text-muted-foreground">Not detected</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {field.manuallyEdited && <Badge variant="pass">Manually verified</Badge>}
                    <ConfidenceBadge confidence={field.confidence} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Rule Evaluation</CardTitle>
            </CardHeader>
            <CardContent>
              <RuleTable
                rules={inspection.ruleResults}
                images={inspection.images}
                onSelect={(rule) => setSelectedRuleId(rule.id)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Information</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTrail events={inspection.auditTrail} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RuleDetails
        rule={selectedRule}
        images={inspection.images}
        onOpenChange={(open) => !open && setSelectedRuleId(null)}
        onViewEvidence={setViewerImageId}
        onMarkReviewed={handleMarkReviewed}
      />
      <ImageViewer images={inspection.images} openImageId={viewerImageId} onOpenChange={setViewerImageId} />
    </div>
  );
}
