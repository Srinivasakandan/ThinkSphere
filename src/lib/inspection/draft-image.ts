import type { ImageQuality, ImageViewType } from "@/types";

export interface DraftImage {
  clientId: string;
  file: File;
  dataUrl: string;
  fileName: string;
  viewType: ImageViewType;
  quality: ImageQuality;
  qualityNote?: string;
}

export const VIEW_TYPE_OPTIONS: { value: ImageViewType; label: string }[] = [
  { value: "FRONT", label: "Front" },
  { value: "BACK", label: "Back" },
  { value: "LEFT", label: "Left" },
  { value: "RIGHT", label: "Right" },
  { value: "TOP", label: "Top" },
  { value: "BOTTOM", label: "Bottom" },
  { value: "OTHER", label: "Other" },
];

const DEFAULT_VIEW_ORDER: ImageViewType[] = ["FRONT", "BACK", "LEFT", "RIGHT", "TOP", "BOTTOM"];

export function defaultViewTypeForIndex(index: number): ImageViewType {
  return DEFAULT_VIEW_ORDER[index] ?? "OTHER";
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
