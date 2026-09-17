"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, AlertTriangle } from "lucide-react";
import { usePageHeader } from "@/components/layout/page-header-context";
import { InspectionStepper } from "@/components/inspection/inspection-stepper";
import { ExtractedFieldCard } from "@/components/inspection/extracted-field-card";
import { ImageViewer } from "@/components/inspection/image-viewer";
import { ManualInspectionBanner } from "@/components/inspection/manual-inspection-banner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common/error-state";
import { InspectionDetailSkeleton } from "@/components/common/skeletons";
import { formatViewType } from "@/lib/format";
import { getInspection, updateExtractedField } from "@/lib/api/inspections";
import type { BoundingBox, Inspection } from "@/types";

const QUALITY_STYLES: Record<string, string> = {
  GOOD: "bg-status-pass-bg text-status-pass border-status-pass-border",
  FAIR: "bg-status-warn-bg text-status-warn border-status-warn-border",
  POOR: "bg-status-fail-bg text-status-fail border-status-fail-border",
};

export default function ExtractedInformationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  usePageHeader(`Extracted Information — ${id}`, [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Inspections", href: "/inspections" },
    { label: id, href: `/inspections/${id}` },
    { label: "Extracted Information" },
  ]);
  const router = useRouter();
  const [inspection, setInspection] = useState<Inspection | null | undefined>(undefined);
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

  const lowConfidenceCount = inspection.extractedFields.filter(
    (f) => f.confidence === "LOW" && !f.manuallyEdited
  ).length;

  async function handleFieldSave(fieldId: string, value: string | null) {
    const updated = await updateExtractedField(id, fieldId, value);
    if (!updated) return;
    setInspection((prev) =>
      prev
        ? {
            ...prev,
            extractedFields: prev.extractedFields.map((f) => (f.id === fieldId ? updated : f)),
          }
        : prev
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardContent className="pt-5">
          <InspectionStepper currentStep={3} />
        </CardContent>
      </Card>

      <ManualInspectionBanner
        poorCount={inspection.images.filter((img) => img.quality === "POOR").length}
        totalCount={inspection.images.length}
      />

      <Card>
        <CardHeader>
          <CardTitle>Source Images</CardTitle>
          <CardDescription>
            All images below belong to inspection {id}. Select any image to zoom, rotate and
            compare it against the extracted values.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {inspection.images.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => {
                  setViewerHighlight(undefined);
                  setViewerImageId(img.id);
                }}
                className="focus-ring group relative h-24 w-20 shrink-0 overflow-hidden rounded-md border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={`${formatViewType(img.viewType)} view`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center text-[10px] font-medium text-white">
                  {formatViewType(img.viewType)}
                </span>
                {img.quality && (
                  <span
                    className={`absolute right-1 top-1 rounded-full border px-1.5 py-0 text-[9px] font-semibold ${QUALITY_STYLES[img.quality]}`}
                  >
                    {img.quality === "GOOD" ? "Good" : img.quality === "FAIR" ? "Fair" : "Poor"}
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extracted Product Information</CardTitle>
          <CardDescription className="flex items-start gap-1.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            These values are the system&apos;s structured reading of the uploaded images — not a
            legal certification. Review and correct anything that looks wrong before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {lowConfidenceCount > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-status-warn-border bg-status-warn-bg px-3 py-2 text-xs text-status-warn">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {lowConfidenceCount} field{lowConfidenceCount === 1 ? "" : "s"} have low extraction
              confidence and need review before finalizing.
            </div>
          )}
          {inspection.extractedFields.map((field) => (
            <ExtractedFieldCard
              key={field.id}
              field={field}
              sourceImage={inspection.images.find((i) => i.id === field.sourceImageId)}
              onSave={(value) => handleFieldSave(field.id, value)}
              onViewSource={(imageId) => {
                setViewerHighlight(field.boundingBox);
                setViewerImageId(imageId);
              }}
            />
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/inspections")}>
          Save and Exit
        </Button>
        <Button onClick={() => router.push(`/inspections/${id}/rules`)}>
          Continue to Rule Evaluation
        </Button>
      </div>

      <ImageViewer
        images={inspection.images}
        openImageId={viewerImageId}
        onOpenChange={(imageId) => {
          // Clears whenever the open image changes (including carousel
          // prev/next) — the highlight is only meaningful for the image it
          // was opened for, and is re-set explicitly by "View Source".
          setViewerImageId(imageId);
          setViewerHighlight(undefined);
        }}
        highlightBox={viewerHighlight}
      />
    </div>
  );
}
