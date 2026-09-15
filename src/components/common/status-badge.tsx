import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InspectionStatus } from "@/types";
import {
  STATUS_EXPLANATION,
  STATUS_LABEL,
} from "@/lib/inspection/status";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STATUS_CONFIG: Record<
  InspectionStatus,
  { icon: typeof CheckCircle2; classes: string; symbol: string }
> = {
  PASS: {
    icon: CheckCircle2,
    symbol: "✓",
    classes: "border-status-pass-border bg-status-pass-bg text-status-pass",
  },
  POTENTIAL_NON_COMPLIANCE: {
    icon: XCircle,
    symbol: "×",
    classes: "border-status-fail-border bg-status-fail-bg text-status-fail",
  },
  NEEDS_REVIEW: {
    icon: AlertTriangle,
    symbol: "!",
    classes: "border-status-warn-border bg-status-warn-bg text-status-warn",
  },
};

interface StatusBadgeProps {
  status: InspectionStatus;
  size?: "sm" | "md" | "lg";
  showExplanation?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  size = "md",
  showExplanation = false,
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
    lg: "text-base px-3.5 py-1.5 gap-2",
  }[size];
  const iconSize = { sm: 12, md: 14, lg: 18 }[size];

  const badge = (
    <span
      role="status"
      aria-label={`${STATUS_LABEL[status]}: ${STATUS_EXPLANATION[status]}`}
      className={cn(
        "inline-flex items-center rounded-full border font-semibold",
        config.classes,
        sizeClasses,
        className
      )}
    >
      <Icon size={iconSize} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );

  if (!showExplanation) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>{STATUS_EXPLANATION[status]}</TooltipContent>
    </Tooltip>
  );
}
