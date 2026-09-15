import { Check, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProcessingStepState = "done" | "active" | "pending";

export interface ProcessingStepItem {
  label: string;
  state: ProcessingStepState;
}

export function ProcessingStatus({ steps }: { steps: ProcessingStepItem[] }) {
  return (
    <ul className="space-y-3" aria-live="polite">
      {steps.map((step) => (
        <li key={step.label} className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
              step.state === "done" && "border-status-pass bg-status-pass-bg text-status-pass",
              step.state === "active" && "border-primary bg-primary/10 text-primary",
              step.state === "pending" && "border-border text-muted-foreground"
            )}
          >
            {step.state === "done" && <Check className="h-3.5 w-3.5" />}
            {step.state === "active" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {step.state === "pending" && <Circle className="h-2 w-2 fill-current" />}
          </span>
          <span
            className={cn(
              "text-sm",
              step.state === "pending" ? "text-muted-foreground" : "font-medium text-foreground"
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
