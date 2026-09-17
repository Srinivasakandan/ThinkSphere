"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Check, Trash2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Shot {
  id: string;
  blob: Blob;
  previewUrl: string;
}

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once with every photo taken in this session when the
   * inspector taps "Use Photos". */
  onCapture: (files: File[]) => void;
  remaining: number;
}

function blobToFile(blob: Blob, index: number): File {
  return new File([blob], `scan-${Date.now()}-${index}.jpg`, { type: blob.type || "image/jpeg" });
}

export function CameraCapture({ open, onOpenChange, onCapture, remaining }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsReady(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access isn't supported in this browser. Use Upload Images instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setError(null);
        setIsReady(true);
      } catch {
        if (!cancelled) {
          setError(
            "Couldn't access the camera. Check that camera permission is allowed for this site, or use Upload Images instead."
          );
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      // Revoke object URLs on unmount so captured-but-unused shots don't leak.
      shots.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCaptureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || shots.length >= remaining) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const previewUrl = URL.createObjectURL(blob);
        setShots((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, blob, previewUrl }]);
      },
      "image/jpeg",
      0.92
    );
  }

  function handleRemoveShot(id: string) {
    setShots((prev) => {
      const shot = prev.find((s) => s.id === id);
      if (shot) URL.revokeObjectURL(shot.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }

  function handleUsePhotos() {
    const files = shots.map((s, i) => blobToFile(s.blob, i));
    onCapture(files);
    shots.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setShots([]);
    onOpenChange(false);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      shots.forEach((s) => URL.revokeObjectURL(s.previewUrl));
      setShots([]);
    }
    onOpenChange(nextOpen);
  }

  const atLimit = shots.length >= remaining;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan Product Label</DialogTitle>
          <DialogDescription>
            Center the label in frame and capture. You can take several photos before adding them
            to this inspection.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-status-fail-border bg-status-fail-bg px-3 py-2 text-xs text-status-fail">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg border border-border bg-black">
              <video ref={videoRef} muted playsInline className="max-h-[50vh] w-full object-contain" />
              {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70">
                  Starting camera…
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {shots.length} of {remaining} captured
              </p>
              <Button type="button" onClick={handleCaptureFrame} disabled={!isReady || atLimit}>
                <Camera className="h-4 w-4" /> Capture
              </Button>
            </div>

            {shots.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {shots.map((shot) => (
                  <div key={shot.id} className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shot.previewUrl} alt="Captured shot" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveShot(shot.id)}
                      className="focus-ring absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove captured photo"
                    >
                      <Trash2 className="h-4 w-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          {shots.length > 0 && (
            <Button type="button" variant="outline" onClick={() => setShots([])}>
              <RefreshCw className="h-4 w-4" /> Retake All
            </Button>
          )}
          <Button type="button" onClick={handleUsePhotos} disabled={shots.length === 0}>
            <Check className="h-4 w-4" /> Use {shots.length || ""} Photo{shots.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
