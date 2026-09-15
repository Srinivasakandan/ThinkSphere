import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  description,
  actionLabel,
  onAction,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-status-fail-border bg-status-fail-bg px-6 py-10 text-center",
        className
      )}
    >
      <AlertCircle className="h-8 w-8 text-status-fail" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-status-fail">{title}</p>
        {description && <p className="max-w-sm text-sm text-status-fail/80">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
