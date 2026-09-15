"use client";

import { useEffect, useState } from "react";
import { ImageIcon, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/common/status-badge";
import { formatViewType } from "@/lib/format";
import type { ProductImage, RuleResult } from "@/types";

interface RuleDetailsProps {
  rule: RuleResult | null;
  images: ProductImage[];
  onOpenChange: (open: boolean) => void;
  onViewEvidence: (imageId: string) => void;
  onMarkReviewed: (ruleId: string, note?: string) => Promise<void> | void;
}

export function RuleDetails({ rule, images, onOpenChange, onViewEvidence, onMarkReviewed }: RuleDetailsProps) {
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Reset the note draft whenever a different rule is opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNote(rule?.inspectorNote ?? "");
  }, [rule?.id, rule?.inspectorNote]);

  if (!rule) return null;

  const evidence = rule.evidenceImageId ? images.find((i) => i.id === rule.evidenceImageId) : undefined;

  async function handleMarkReviewed() {
    setIsSaving(true);
    try {
      await onMarkReviewed(rule!.id, note.trim() || undefined);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={!!rule} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Rule {rule.ruleId}</DialogTitle>
          <DialogDescription>{rule.requirement}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Detected value</p>
              <p className="mt-0.5 font-medium text-foreground">{rule.detectedValue || "Not detected"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
              <div className="mt-1">
                <StatusBadge status={rule.status} size="sm" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason</p>
            <p className="mt-0.5 text-foreground">{rule.reason}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</p>
            {evidence ? (
              <button
                type="button"
                onClick={() => onViewEvidence(evidence.id)}
                className="focus-ring mt-1 inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-accent"
              >
                <ImageIcon className="h-3.5 w-3.5" /> View {formatViewType(evidence.viewType)} Image
              </button>
            ) : (
              <p className="mt-0.5 text-muted-foreground">No reliable evidence found.</p>
            )}
          </div>

          {rule.status !== "PASS" && (
            <div className="flex items-start gap-2 rounded-md border border-status-neutral-border bg-status-neutral-bg px-3 py-2 text-xs text-status-neutral">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This is a system-detected potential issue, not a final legal determination. Please
              verify against the original image before recording a decision.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="inspector-note">Inspector note</Label>
            <Textarea
              id="inspector-note"
              placeholder="Add context for this finding…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          {rule.reviewed && (
            <p className="text-xs text-status-pass">
              ✓ Reviewed by inspector{rule.inspectorDecision ? ` — ${rule.inspectorDecision === "CONFIRMED" ? "Confirmed" : "Corrected"}` : ""}
            </p>
          )}
        </div>

        <DialogFooter>
          {evidence && (
            <Button variant="outline" onClick={() => onViewEvidence(evidence.id)}>
              View Images
            </Button>
          )}
          <Button onClick={handleMarkReviewed} disabled={isSaving}>
            Mark as Reviewed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
