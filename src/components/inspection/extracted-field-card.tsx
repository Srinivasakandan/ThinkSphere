"use client";

import { useState } from "react";
import { Pencil, ImageIcon, ShieldCheck, AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "@/components/common/confidence-badge";
import { formatViewType } from "@/lib/format";
import type { ExtractedField, ProductImage } from "@/types";

interface ExtractedFieldCardProps {
  field: ExtractedField;
  sourceImage?: ProductImage;
  onSave: (value: string | null) => Promise<void> | void;
  onViewSource: (imageId: string) => void;
}

export function ExtractedFieldCard({ field, sourceImage, onSave, onViewSource }: ExtractedFieldCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(field.value ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(draftValue.trim() === "" ? null : draftValue.trim());
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  const isLowConfidence = field.confidence === "LOW";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {field.label}
          </p>
          {!isEditing ? (
            <p className="mt-0.5 text-base font-semibold text-foreground">
              {field.value ?? <span className="italic text-muted-foreground">Not detected</span>}
            </p>
          ) : (
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                className="h-8 max-w-xs"
                aria-label={`Edit ${field.label}`}
                autoFocus
              />
              <Button size="icon" className="h-8 w-8" onClick={handleSave} disabled={isSaving} aria-label="Save">
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setIsEditing(false);
                  setDraftValue(field.value ?? "");
                }}
                aria-label="Cancel edit"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ConfidenceBadge confidence={field.confidence} />
        {field.manuallyEdited ? (
          <Badge variant="pass">
            <ShieldCheck className="h-3 w-3" /> Manually verified
          </Badge>
        ) : field.validated ? (
          <Badge variant="secondary">Validated</Badge>
        ) : null}
        {sourceImage && (
          <button
            type="button"
            onClick={() => onViewSource(sourceImage.id)}
            className="focus-ring inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ImageIcon className="h-3 w-3" /> Source: {formatViewType(sourceImage.viewType)} Image
          </button>
        )}
      </div>

      {isLowConfidence && !field.manuallyEdited && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-status-warn-border bg-status-warn-bg px-3 py-2 text-xs text-status-warn">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="space-y-1.5">
            <p>{field.explanation ?? "Extraction confidence is low. Please verify this value against the original image."}</p>
            <div className="flex flex-wrap gap-2">
              {sourceImage && (
                <button
                  type="button"
                  onClick={() => onViewSource(sourceImage.id)}
                  className="focus-ring font-medium underline underline-offset-2"
                >
                  View Source Image
                </button>
              )}
              <button type="button" onClick={() => setIsEditing(true)} className="focus-ring font-medium underline underline-offset-2">
                Edit Value
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
