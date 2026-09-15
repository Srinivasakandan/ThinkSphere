"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatViewType } from "@/lib/format";
import type { ProductImage } from "@/types";

interface ImageViewerProps {
  images: ProductImage[];
  openImageId: string | null;
  onOpenChange: (imageId: string | null) => void;
}

const QUALITY_LABEL: Record<string, string> = {
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
};

export function ImageViewer({ images, openImageId, onOpenChange }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const index = images.findIndex((img) => img.id === openImageId);
  const image = index >= 0 ? images[index] : null;

  useEffect(() => {
    // Reset zoom/rotation transform state whenever a different image opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZoom(1);
    setRotation(0);
  }, [openImageId]);

  function go(delta: number) {
    if (index < 0) return;
    const next = (index + delta + images.length) % images.length;
    onOpenChange(images[next].id);
  }

  return (
    <DialogPrimitive.Root open={!!image} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/85" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            {image ? `${formatViewType(image.viewType)} image viewer` : "Image viewer"}
          </DialogPrimitive.Title>
          {image && (
            <>
              <div className="flex items-center justify-between gap-3 bg-black/40 px-4 py-3 text-white">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatViewType(image.viewType)} image</p>
                  <p className="text-xs text-white/70">
                    {image.fileName}
                    {image.quality && ` · Quality: ${QUALITY_LABEL[image.quality]}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10 hover:text-white"
                    onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
                    aria-label="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10 hover:text-white"
                    onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
                    aria-label="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10 hover:text-white"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    aria-label="Rotate image"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <DialogPrimitive.Close asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/10 hover:text-white"
                      aria-label="Close viewer"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogPrimitive.Close>
                </div>
              </div>

              <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
                {images.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 z-10 text-white hover:bg-white/10 hover:text-white sm:left-4"
                    onClick={() => go(-1)}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                )}
                <div className="relative max-h-[75vh] max-w-full overflow-auto">
                  {/* Bounding box overlays for detected fields would render here in a
                      relatively-positioned wrapper once the backend supplies coordinates. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={`${formatViewType(image.viewType)} view of the product`}
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: "transform 150ms ease",
                    }}
                    className="max-h-[75vh] w-auto select-none rounded"
                    draggable={false}
                  />
                </div>
                {images.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 z-10 text-white hover:bg-white/10 hover:text-white sm:right-4"
                    onClick={() => go(1)}
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex justify-center gap-2 bg-black/40 px-4 py-3">
                  {images.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => onOpenChange(img.id)}
                      className={`h-1.5 w-6 rounded-full transition-colors ${
                        img.id === image.id ? "bg-white" : "bg-white/30"
                      }`}
                      aria-label={`Show ${formatViewType(img.viewType)} image`}
                      aria-current={img.id === image.id}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
