"use client";

import { useCallback, useId, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

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
    </div>
  );
}
