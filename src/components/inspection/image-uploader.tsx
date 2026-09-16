"use client";

import { useCallback, useId, useRef, useState } from "react";
import { UploadCloud, ScanLine, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CameraCapture } from "@/components/inspection/camera-capture";

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_IMAGES = 10;

interface ImageUploaderProps {
  currentCount: number;
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function ImageUploader({ currentCount, onFilesSelected, disabled }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nativeCaptureRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const nativeCaptureId = useId();

  const remaining = MAX_IMAGES - currentCount;

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      const invalid = files.filter((f) => !ACCEPTED_TYPES.includes(f.type));
      const valid = files.filter((f) => ACCEPTED_TYPES.includes(f.type));

      if (invalid.length > 0) {
        setError(`${invalid.length} file(s) skipped — only JPG, PNG and WebP images are supported.`);
      } else {
        setError(null);
      }

      if (valid.length === 0) return;

      const allowed = valid.slice(0, Math.max(remaining, 0));
      if (allowed.length < valid.length) {
        setError(`Only ${MAX_IMAGES} images are allowed per inspection. Extra files were not added.`);
      }
      if (allowed.length > 0) onFilesSelected(allowed);
    },
    [remaining, onFilesSelected]
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled || remaining <= 0 ? -1 : 0}
        aria-disabled={disabled || remaining <= 0}
        onClick={() => !disabled && remaining > 0 && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled && remaining > 0) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && remaining > 0) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!disabled && remaining > 0) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "focus-ring flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/30",
          (disabled || remaining <= 0) && "cursor-not-allowed opacity-60"
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            Drag and drop images here, or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPG, JPEG, PNG or WebP — upload up to {MAX_IMAGES} images ({remaining} remaining)
          </p>
        </div>
        <label htmlFor={inputId} className="sr-only">
          Upload product images
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          disabled={disabled || remaining <= 0}
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-status-fail">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || remaining <= 0}
          onClick={() => setIsCameraOpen(true)}
        >
          <ScanLine className="h-3.5 w-3.5" /> Scan with Camera
        </Button>

        <label
          htmlFor={nativeCaptureId}
          className={cn(
            "focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
            (disabled || remaining <= 0) && "pointer-events-none cursor-not-allowed opacity-60"
          )}
        >
          <Smartphone className="h-3.5 w-3.5" /> Use Device Camera App
        </label>
        <input
          id={nativeCaptureId}
          ref={nativeCaptureRef}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled || remaining <= 0}
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <CameraCapture
        open={isCameraOpen}
        onOpenChange={setIsCameraOpen}
        onCapture={(files) => onFilesSelected(files.slice(0, Math.max(remaining, 0)))}
        remaining={remaining}
      />
    </div>
  );
}
