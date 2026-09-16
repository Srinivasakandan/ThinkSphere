import { AlertTriangle } from "lucide-react";

interface ManualInspectionBannerProps {
  poorCount: number;
  totalCount: number;
}

/** Shown whenever one or more images are flagged POOR quality (blurry or
 * otherwise hard to read) — nudges toward a clearer photo or manual
 * verification, never a hard block (the inspector is always the final
 * verifier, matching every other status surface in this app). */
export function ManualInspectionBanner({ poorCount, totalCount }: ManualInspectionBannerProps) {
  if (poorCount === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-status-warn-border bg-status-warn-bg px-4 py-3 text-status-warn">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-semibold">
          Manual inspection recommended — {poorCount} of {totalCount} image{totalCount === 1 ? "" : "s"}{" "}
          {poorCount === 1 ? "appears" : "appear"} blurry or low quality.
        </p>
        <p className="mt-0.5 text-xs">
          For reliable automatic results, retake or upload a clearer photo for the affected
          image(s) — or continue and verify the flagged declarations yourself before finalizing.
        </p>
      </div>
    </div>
  );
}
