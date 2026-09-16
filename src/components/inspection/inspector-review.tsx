"use client";

import { useState } from "react";
import { Check, Pencil, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/common/status-badge";
import { formatViewType } from "@/lib/format";
import type { BoundingBox, ExtractedField, ProductImage, RuleResult } from "@/types";

interface InspectorReviewItemProps {
  rule: RuleResult;
  relatedField?: ExtractedField;
  evidenceImage?: ProductImage;
  onViewEvidence: (imageId: string, boundingBox?: BoundingBox) => void;
  onConfirm: (note?: string) => Promise<void> | void;
  onCorrect: (newValue: string, note?: string) => Promise<void> | void;
}

function ReviewItem({
  rule,
  relatedField,
  evidenceImage,
  onViewEvidence,
  onConfirm,
  onCorrect,
}: InspectorReviewItemProps) {
  const [mode, setMode] = useState<"idle" | "correcting">("idle");
  const [correctedValue, setCorrectedValue] = useState(relatedField?.value ?? "");
  const [note, setNote] = useState(rule.inspectorNote ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirm() {
    setIsSaving(true);
    try {
      await onConfirm(note.trim() || undefined);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCorrectSave() {
    setIsSaving(true);
    try {
      await onCorrect(correctedValue.trim(), note.trim() || undefined);
      setMode("idle");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{rule.requirement}</p>
          <p className="text-xs text-muted-foreground">Rule {rule.ruleId}</p>
        </div>
        <StatusBadge status={rule.status} size="sm" showExplanation />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">System detected</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {rule.detectedValue || <span className="italic text-muted-foreground">Not detected</span>}
          </p>
        </div>
        {evidenceImage && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</p>
            <button
              type="button"
              onClick={() => onViewEvidence(evidenceImage.id, relatedField?.boundingBox)}
              className="focus-ring mt-0.5 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ImageIcon className="h-3.5 w-3.5" /> {formatViewType(evidenceImage.viewType)} Image
            </button>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{rule.reason}</p>

      {rule.reviewed ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-status-pass">
          <Check className="h-3.5 w-3.5" />
          {rule.inspectorDecision === "CORRECTED" ? "Corrected by inspector" : "Confirmed by inspector"}
          {rule.inspectorNote && <span className="font-normal text-muted-foreground">— &ldquo;{rule.inspectorNote}&rdquo;</span>}
        </div>
      ) : (
        <div className="mt-4 space-y-3 border-t border-border pt-3">
          {mode === "correcting" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Corrected value</label>
              <Input value={correctedValue} onChange={(e) => setCorrectedValue(e.target.value)} className="h-8" />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Inspector note</label>
            <Textarea
              rows={2}
              placeholder="e.g. Verified from back-side image."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {mode === "idle" ? (
              <>
                <Button size="sm" onClick={handleConfirm} disabled={isSaving}>
                  <Check className="h-3.5 w-3.5" /> Confirm
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMode("correcting")} disabled={isSaving}>
                  <Pencil className="h-3.5 w-3.5" /> Correct
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={handleCorrectSave} disabled={isSaving}>
                  Save Correction
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMode("idle")} disabled={isSaving}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface InspectorReviewProps {
  rules: RuleResult[];
  fields: ExtractedField[];
  images: ProductImage[];
  onViewEvidence: (imageId: string, boundingBox?: BoundingBox) => void;
  onConfirm: (ruleId: string, note?: string) => Promise<void> | void;
  onCorrect: (ruleId: string, fieldId: string | undefined, newValue: string, note?: string) => Promise<void> | void;
}

export function InspectorReview({ rules, fields, images, onViewEvidence, onConfirm, onCorrect }: InspectorReviewProps) {
  const fieldByKey = Object.fromEntries(fields.map((f) => [f.field, f]));
  const imageById = Object.fromEntries(images.map((i) => [i.id, i]));

  const reviewable = rules.filter((r) => r.status !== "PASS");

  if (reviewable.length === 0) {
    return (
      <div className="rounded-lg border border-status-pass-border bg-status-pass-bg px-4 py-6 text-center text-sm text-status-pass">
        No flagged findings — every checked rule passed. You may still finalize after confirming
        the extracted details are correct.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviewable.map((rule) => {
        const relatedField = fieldByKey[rule.field];
        const evidenceImage = rule.evidenceImageId ? imageById[rule.evidenceImageId] : undefined;
        return (
          <ReviewItem
            key={rule.id}
            rule={rule}
            relatedField={relatedField}
            evidenceImage={evidenceImage}
            onViewEvidence={onViewEvidence}
            onConfirm={(note) => onConfirm(rule.id, note)}
            onCorrect={(value, note) => onCorrect(rule.id, relatedField?.id, value, note)}
          />
        );
      })}
    </div>
  );
}
