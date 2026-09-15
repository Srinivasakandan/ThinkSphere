"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePageHeader } from "@/components/layout/page-header-context";
import { InspectionStepper } from "@/components/inspection/inspection-stepper";
import { ProcessingStatus, type ProcessingStepItem } from "@/components/inspection/processing-status";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common/error-state";
import { getInspection, runProcessing } from "@/lib/api/inspections";

const STEP_LABELS = [
  "Images uploaded",
  "OCR text extraction",
  "Extracting declarations",
  "Validating information",
  "Evaluating applicable rules",
  "Preparing results",
];

export default function ProcessingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  usePageHeader(`Processing ${id}`, [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Inspections", href: "/inspections" },
    { label: id },
  ]);
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Reset progress state when a retry (attempt) restarts the pipeline.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(0);
    setFailed(false);

    async function run() {
      const inspection = await getInspection(id);
      if (!inspection) {
        if (!cancelled) setNotFound(true);
        return;
      }

      for (let i = 1; i < STEP_LABELS.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 650));
        if (cancelled) return;
        setActiveIndex(i);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      if (cancelled) return;

      try {
        await runProcessing(id);
        if (!cancelled) router.push(`/inspections/${id}/extracted`);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [id, router, attempt]);

  if (notFound) {
    return (
      <ErrorState
        title="Unable to retrieve inspection"
        description={`Inspection ${id} could not be found. It may have been created in a different browser session.`}
        actionLabel="Back to Inspections"
        onAction={() => router.push("/inspections")}
      />
    );
  }

  const steps: ProcessingStepItem[] = STEP_LABELS.map((label, idx) => ({
    label,
    state: failed ? (idx <= activeIndex ? "done" : "pending") : idx < activeIndex ? "done" : idx === activeIndex ? "active" : "pending",
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardContent className="pt-5">
          <InspectionStepper currentStep={2} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Processing Inspection {id}</CardTitle>
          <CardDescription>
            Extracting declarations from uploaded images and evaluating applicable rules. This
            usually takes a few seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {failed ? (
            <ErrorState
              title="OCR processing failed"
              description="Something went wrong while processing this inspection. You can retry, or continue and enter information manually."
              actionLabel="Retry Processing"
              onAction={() => setAttempt((a) => a + 1)}
            />
          ) : (
            <ProcessingStatus steps={steps} />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => router.push("/inspections")}>
          Cancel and return to Inspections
        </Button>
      </div>
    </div>
  );
}
