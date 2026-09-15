import { cn } from "@/lib/utils";
import type { ExtractionConfidence } from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CONFIDENCE_CONFIG: Record<
  ExtractionConfidence,
  { label: string; classes: string; explanation: string }
> = {
  HIGH: {
    label: "High",
    classes: "border-status-pass-border bg-status-pass-bg text-status-pass",
    explanation:
      "The system is relatively confident that this value was correctly read from the image.",
  },
  MEDIUM: {
    label: "Medium",
    classes: "border-status-warn-border bg-status-warn-bg text-status-warn",
    explanation:
      "The system extracted this value with moderate confidence. A quick visual check is recommended.",
  },
  LOW: {
    label: "Low",
    classes: "border-status-fail-border bg-status-fail-bg text-status-fail",
    explanation:
      "Extraction confidence is low. Please verify this value against the original image.",
  },
};

export function ConfidenceBadge({
  confidence,
  className,
}: {
  confidence: ExtractionConfidence;
  className?: string;
}) {
  const config = CONFIDENCE_CONFIG[confidence];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex cursor-default items-center rounded-full border px-2 py-0.5 text-xs font-medium",
            config.classes,
            className
          )}
        >
          Extraction confidence: {config.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{config.explanation}</TooltipContent>
    </Tooltip>
  );
}
