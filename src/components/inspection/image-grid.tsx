"use client";

import { Trash2, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { VIEW_TYPE_OPTIONS, type DraftImage } from "@/lib/inspection/draft-image";
import type { ImageViewType } from "@/types";
import { cn } from "@/lib/utils";

const QUALITY_STYLES: Record<string, string> = {
  GOOD: "bg-status-pass-bg text-status-pass border-status-pass-border",
  FAIR: "bg-status-warn-bg text-status-warn border-status-warn-border",
  POOR: "bg-status-fail-bg text-status-fail border-status-fail-border",
};

interface ImageGridProps {
  images: DraftImage[];
  onRemove: (clientId: string) => void;
  onViewTypeChange: (clientId: string, viewType: ImageViewType) => void;
}

export function ImageGrid({ images, onRemove, onViewTypeChange }: ImageGridProps) {
  if (images.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((img, idx) => (
        <div key={img.clientId} className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="relative aspect-[4/5] bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.dataUrl}
              alt={`Image ${idx + 1} — ${img.viewType.toLowerCase()} view`}
              className="h-full w-full object-cover"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-2 top-2 h-7 w-7 shadow"
              onClick={() => onRemove(img.clientId)}
              aria-label={`Remove image ${idx + 1}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <span
              className={cn(
                "absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                QUALITY_STYLES[img.quality ?? "GOOD"]
              )}
            >
              {img.quality === "GOOD" ? "Good" : img.quality === "FAIR" ? "Fair" : "Poor"}
            </span>
          </div>
          <div className="space-y-2 p-2.5">
            <p className="text-xs font-medium text-muted-foreground">Image {idx + 1}</p>
            <Select
              value={img.viewType}
              onValueChange={(value) => onViewTypeChange(img.clientId, value as ImageViewType)}
            >
              <SelectTrigger className="h-8 text-xs" aria-label={`View label for image ${idx + 1}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEW_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {img.quality === "POOR" && (
              <p className="flex items-start gap-1 text-[11px] leading-snug text-status-warn">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                Image may be difficult to read. Consider retaking this image.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
