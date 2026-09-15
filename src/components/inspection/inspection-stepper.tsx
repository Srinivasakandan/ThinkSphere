import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const INSPECTION_STEPS = [
  "Product Images",
  "Processing",
  "Extracted Information",
  "Rule Evaluation",
  "Inspector Review",
  "Complete",
] as const;

export function InspectionStepper({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex w-full items-start overflow-x-auto pb-1" aria-label="Inspection progress">
      {INSPECTION_STEPS.map((step, idx) => {
        const stepNumber = idx + 1;
        const state =
          stepNumber < currentStep ? "done" : stepNumber === currentStep ? "current" : "upcoming";
        return (
          <li key={step} className="flex min-w-[7.5rem] flex-1 items-center last:min-w-0 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  state === "done" && "border-primary bg-primary text-primary-foreground",
                  state === "current" && "border-primary text-primary",
                  state === "upcoming" && "border-border text-muted-foreground"
                )}
              >
                {state === "done" ? <Check className="h-3.5 w-3.5" /> : stepNumber}
              </div>
              <span
                className={cn(
                  "max-w-[7rem] text-xs font-medium",
                  state === "upcoming" ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {step}
              </span>
            </div>
            {stepNumber !== INSPECTION_STEPS.length && (
              <div
                className={cn("mx-2 h-px flex-1", state === "done" ? "bg-primary" : "bg-border")}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
