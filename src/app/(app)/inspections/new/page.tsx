"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { usePageHeader } from "@/components/layout/page-header-context";
import { InspectionStepper } from "@/components/inspection/inspection-stepper";
import { ImageUploader } from "@/components/inspection/image-uploader";
import { ImageGrid } from "@/components/inspection/image-grid";
import { ProductInfoForm, type ProductInfoValues } from "@/components/inspection/product-info-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ImageViewType } from "@/types";
import {
  defaultViewTypeForIndex,
  mockQualityForIndex,
  readFileAsDataUrl,
  type DraftImage,
} from "@/lib/inspection/draft-image";
import { createInspection } from "@/lib/api/inspections";

const EMPTY_PRODUCT_INFO: ProductInfoValues = {
  productName: "",
  category: "",
  brand: "",
  batchNumber: "",
  location: "",
  notes: "",
};

export default function NewInspectionPage() {
  usePageHeader("New Inspection", [
    { label: "Dashboard", href: "/dashboard" },
    { label: "New Inspection" },
  ]);
  const router = useRouter();
  const [images, setImages] = useState<DraftImage[]>([]);
  const [productInfo, setProductInfo] = useState<ProductInfoValues>(EMPTY_PRODUCT_INFO);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleFilesSelected(files: File[]) {
    const startIndex = images.length;
    const newImages = await Promise.all(
      files.map(async (file, offset) => {
        const dataUrl = await readFileAsDataUrl(file);
        const index = startIndex + offset;
        const { quality, note } = mockQualityForIndex(index);
        const draft: DraftImage = {
          clientId: `${file.name}-${index}-${Date.now()}`,
          file,
          dataUrl,
          fileName: file.name,
          viewType: defaultViewTypeForIndex(index),
          quality,
          qualityNote: note,
        };
        return draft;
      })
    );
    setImages((prev) => [...prev, ...newImages]);
  }

  function handleRemove(clientId: string) {
    setImages((prev) => prev.filter((img) => img.clientId !== clientId));
  }

  function handleViewTypeChange(clientId: string, viewType: ImageViewType) {
    setImages((prev) => prev.map((img) => (img.clientId === clientId ? { ...img, viewType } : img)));
  }

  async function handleStartProcessing() {
    setIsSubmitting(true);
    try {
      const inspection = await createInspection(
        {
          productName: productInfo.productName || undefined,
          brand: productInfo.brand || undefined,
          category: productInfo.category || undefined,
          batchNumber: productInfo.batchNumber || undefined,
          location: productInfo.location || undefined,
          notes: productInfo.notes || undefined,
        },
        images.map((img) => ({
          dataUrl: img.dataUrl,
          fileName: img.fileName,
          viewType: img.viewType,
          quality: img.quality,
          qualityNote: img.qualityNote,
        }))
      );
      setConfirmOpen(false);
      router.push(`/inspections/${inspection.id}/processing`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const canProceed = images.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardContent className="pt-5">
          <InspectionStepper currentStep={1} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Product Images</CardTitle>
          <CardDescription>
            Upload multiple views of the same packaged product. These images will be processed
            together as one inspection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ImageUploader currentCount={images.length} onFilesSelected={handleFilesSelected} />

          {images.length > 0 && (
            <div className="rounded-md border border-status-neutral-border bg-status-neutral-bg px-3 py-2 text-xs text-status-neutral">
              All uploaded images belong to this single inspection.
            </div>
          )}

          <ImageGrid images={images} onRemove={handleRemove} onViewTypeChange={handleViewTypeChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
          <CardDescription>
            Optional — provide any known details before processing. Applicable legal requirements
            are determined by the rules engine, not by these fields.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductInfoForm values={productInfo} onChange={setProductInfo} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <p className="mr-auto text-xs text-muted-foreground">
          {images.length === 0
            ? "Upload at least one image to continue."
            : `${images.length} image${images.length === 1 ? "" : "s"} ready for processing.`}
        </p>
        <Button size="lg" disabled={!canProceed} onClick={() => setConfirmOpen(true)}>
          Start Compliance Check
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start compliance check?</DialogTitle>
            <DialogDescription>
              You are about to process {images.length} image{images.length === 1 ? "" : "s"} as one
              product inspection. This will run OCR extraction and rule evaluation. You can review
              and correct any findings afterward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleStartProcessing} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                </>
              ) : (
                "Start Processing"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
