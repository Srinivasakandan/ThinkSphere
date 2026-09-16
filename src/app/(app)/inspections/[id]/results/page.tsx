"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { usePageHeader } from "@/components/layout/page-header-context";
import { InspectionStepper } from "@/components/inspection/inspection-stepper";
import { InspectionSummary } from "@/components/inspection/inspection-summary";
import { InspectorReview } from "@/components/inspection/inspector-review";
import { FinalizeDialog } from "@/components/inspection/finalize-dialog";
import { ImageViewer } from "@/components/inspection/image-viewer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common/error-state";
import { InspectionDetailSkeleton } from "@/components/common/skeletons";
import { formatDateTime } from "@/lib/format";
import {
  finalizeInspection,
  getInspection,
  reviewRule,
  updateExtractedField,
} from "@/lib/api/inspections";
import type { BoundingBox, Inspection } from "@/types";

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  usePageHeader(`Results — ${id}`, [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Inspections", href: "/inspections" },
    { label: id, href: `/inspections/${id}` },
    { label: "Results" },
  ]);
  const router = useRouter();
  const [inspection, setInspection] = useState<Inspection | null | undefined>(undefined);
  const [viewerImageId, setViewerImageId] = useState<string | null>(null);
  const [viewerHighlight, setViewerHighlight] = useState<BoundingBox | undefined>(undefined);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

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

  const pendingReviewCount = inspection.ruleResults.filter(
    (r) => r.status !== "PASS" && !r.reviewed
  ).length;
  const isFinalized = inspection.stage === "FINALIZED";

  async function handleConfirm(ruleId: string, note?: string) {
    const updated = await reviewRule(id, ruleId, "CONFIRMED", note);
    if (!updated) return;
    setInspection((prev) =>
      prev ? { ...prev, ruleResults: prev.ruleResults.map((r) => (r.id === ruleId ? updated : r)) } : prev
    );
  }

  async function handleCorrect(ruleId: string, fieldId: string | undefined, newValue: string, note?: string) {
    if (fieldId) {
      await updateExtractedField(id, fieldId, newValue);
    }
    const updated = await reviewRule(id, ruleId, "CORRECTED", note);
    if (!updated) return;
    setInspection((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ruleResults: prev.ruleResults.map((r) => (r.id === ruleId ? { ...updated, detectedValue: newValue } : r)),
        extractedFields: fieldId
          ? prev.extractedFields.map((f) => (f.id === fieldId ? { ...f, value: newValue, manuallyEdited: true, validated: true } : f))
          : prev.extractedFields,
      };
    });
  }

  async function handleFinalize() {
    setIsFinalizing(true);
    try {
      const updated = await finalizeInspection(id);
      if (updated) setInspection(updated);
      setFinalizeOpen(false);
    } finally {
      setIsFinalizing(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {!isFinalized && (
        <Card>
          <CardContent className="pt-5">
            <InspectionStepper currentStep={5} />
          </CardContent>
        </Card>
      )}

      {isFinalized && (
        <div className="flex items-start gap-3 rounded-lg border border-status-pass-border bg-status-pass-bg px-4 py-3 text-status-pass">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Inspection finalized successfully.</p>
            <p className="text-xs">
              Finalized by {inspection.inspectorName} on{" "}
              {inspection.finalizedAt ? formatDateTime(inspection.finalizedAt) : "—"}
            </p>
          </div>
        </div>
      )}

      <InspectionSummary inspection={inspection} />

      <Card>
        <CardHeader>
          <CardTitle>Inspector Review</CardTitle>
          <CardDescription>
            Confirm or correct every flagged finding below. Add a note to record how you verified
            it against the original image.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InspectorReview
            rules={inspection.ruleResults}
            fields={inspection.extractedFields}
            images={inspection.images}
            onViewEvidence={(imageId, boundingBox) => {
              setViewerHighlight(boundingBox);
              setViewerImageId(imageId);
            }}
            onConfirm={handleConfirm}
            onCorrect={handleCorrect}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={() => router.push(`/inspections/${id}/rules`)}>
          Back to Rule Evaluation
        </Button>
        {isFinalized ? (
          <Button asChild>
            <Link href="/inspections">
              <ShieldCheck className="h-4 w-4" /> View in Inspection History
            </Link>
          </Button>
        ) : (
          <Button onClick={() => setFinalizeOpen(true)}>Finalize Inspection</Button>
        )}
      </div>

      <FinalizeDialog
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        onFinalize={handleFinalize}
        isSubmitting={isFinalizing}
        pendingReviewCount={pendingReviewCount}
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
