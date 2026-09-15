import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "neutral" | "pass" | "fail" | "warn";
}

const TONE_CLASSES: Record<NonNullable<SummaryCardProps["tone"]>, string> = {
  neutral: "bg-status-neutral-bg text-status-neutral",
  pass: "bg-status-pass-bg text-status-pass",
  fail: "bg-status-fail-bg text-status-fail",
  warn: "bg-status-warn-bg text-status-warn",
};

export function SummaryCard({ label, value, icon: Icon, tone = "neutral" }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {value.toLocaleString("en-IN")}
          </p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", TONE_CLASSES[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}
