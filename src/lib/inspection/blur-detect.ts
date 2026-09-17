import type { ImageQuality } from "@/types";

const RESIZE_WIDTH = 400;
const POOR_THRESHOLD = 15;
const FAIR_THRESHOLD = 40;

export const BLUR_QUALITY_NOTE =
  "This image appears blurry or low quality. For reliable automatic extraction, retake or upload a clearer photo — or proceed and mark this item for manual inspection.";

/**
 * Real in-browser blur/sharpness check — a discrete Laplacian variance
 * over a downscaled grayscale copy of the image (the same "variance of
 * edges" heuristic the backend uses in app/services/imaging/preprocess.py,
 * just computed client-side for instant feedback right when an image is
 * added, before it's even uploaded). This is a fast, approximate signal;
 * the backend's own blur check on the uploaded bytes is authoritative.
 */
export async function assessImageQuality(file: File): Promise<{ quality: ImageQuality; note?: string }> {
  try {
    const variance = await laplacianVariance(file);
    if (variance === null) return { quality: "GOOD" };

    if (variance < POOR_THRESHOLD) return { quality: "POOR", note: BLUR_QUALITY_NOTE };
    if (variance < FAIR_THRESHOLD) return { quality: "FAIR" };
    return { quality: "GOOD" };
  } catch {
    // Never block the upload flow on a failed quality check — just skip
    // the signal for this image.
    return { quality: "GOOD" };
  }
}

async function laplacianVariance(file: File): Promise<number | null> {
  if (typeof document === "undefined") return null;

  const bitmap = await loadBitmap(file);
  try {
    const scale = RESIZE_WIDTH / bitmap.width;
    const width = RESIZE_WIDTH;
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const { data } = ctx.getImageData(0, 0, width, height);
    const gray = new Float32Array(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const lap =
          4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - width] - gray[idx + width];
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }
    if (count === 0) return null;
    const mean = sum / count;
    return sumSq / count - mean * mean;
  } finally {
    if ("close" in bitmap) bitmap.close();
  }
}

type Decoded = ImageBitmap | HTMLImageElement;

async function loadBitmap(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  // Fallback for browsers without createImageBitmap: draw via an <img>
  // element instead — usable anywhere ctx.drawImage() accepts a source.
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
  return img;
}
