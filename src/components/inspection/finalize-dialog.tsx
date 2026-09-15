"use client";

import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FinalizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinalize: () => Promise<void> | void;
  isSubmitting: boolean;
  pendingReviewCount: number;
}

export function FinalizeDialog({
  open,
  onOpenChange,
  onFinalize,
  isSubmitting,
  pendingReviewCount,
}: FinalizeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalize inspection?</DialogTitle>
          <DialogDescription>
            Please verify all flagged and uncertain findings before finalizing this inspection.
            {pendingReviewCount > 0 && (
              <span className="mt-2 block font-medium text-status-warn">
                {pendingReviewCount} finding{pendingReviewCount === 1 ? "" : "s"} still need your
                review.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Back to Review
          </Button>
          <Button onClick={onFinalize} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Finalizing…
              </>
            ) : (
              "Finalize Inspection"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
