import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-14 text-sm text-muted-foreground",
        className
      )}
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
