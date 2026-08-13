"use client";

import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Upload,
  X,
  ImageIcon,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

// ============================================================================
// InternshipImageUpload
// ----------------------------------------------------------------------------
// Drag-and-drop + click-to-browse uploader for an internship's cover image.
//
// Uploads the file to POST /api/company-hr/internships/upload-image, which
// stores it in the Supabase Storage `internship_images` bucket (public, so
// the marketplace can render the banner to unauthenticated visitors) and
// returns the public URL.
//
// The parent component owns the `value` (the URL string persisted on
// internships.image_url) and is notified via `onChange(url | null)`.
//
// Recommended image size: 1200×630 px (16:9-ish OpenGraph aspect ratio).
// Max file size: 5 MB. Allowed types: PNG, JPEG, WebP, GIF.
// ============================================================================

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface InternshipImageUploadProps {
  /** Current image URL (from internships.image_url). Empty string = no image. */
  value?: string | null;
  /** Optional internship_id — when set, file is stored under that prefix. */
  internshipId?: string;
  /** Called with the new public URL after a successful upload, or null when cleared. */
  onChange: (url: string | null) => void;
  /** Optional label override. */
  label?: string;
  /** Optional — hide the "remove" button (e.g. when editing is locked). */
  hideRemove?: boolean;
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "success"; url: string }
  | { status: "error"; message: string };

export function InternshipImageUpload({
  value,
  internshipId,
  onChange,
  label = "Cover Image",
  hideRemove = false,
}: InternshipImageUploadProps) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUrl = value || (state.status === "success" ? state.url : null);

  const validate = useCallback((file: File): string | null => {
    if (!ALLOWED_MIME.includes(file.type)) {
      return `Unsupported file type: ${file.type || "unknown"}. Allowed: PNG, JPEG, WebP, GIF.`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max 5 MB.`;
    }
    return null;
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validate(file);
      if (validationError) {
        setState({ status: "error", message: validationError });
        return;
      }

      setState({ status: "uploading", progress: 8 });

      // Simulate progressive feedback while the upload is in flight. The
      // Supabase JS client doesn't expose per-byte upload progress, so we
      // animate from 8% → 90% over the expected duration and snap to 100%
      // when the response arrives. Without this, the bar would sit at 0%
      // the whole time and feel broken.
      const tick = setInterval(() => {
        setState((prev) =>
          prev.status === "uploading"
            ? { status: "uploading", progress: Math.min(prev.progress + 7, 90) }
            : prev
        );
      }, 250);

      try {
        const fd = new FormData();
        fd.append("file", file);
        if (internshipId) fd.append("internship_id", internshipId);

        const res = await fetch("/api/company-hr/internships/upload-image", {
          method: "POST",
          body: fd,
        });
        const json = await res.json();

        if (!res.ok || !json?.success || !json?.data?.url) {
          const msg = json?.error?.message || "Upload failed. Please try again.";
          setState({ status: "error", message: msg });
          return;
        }

        setState({ status: "uploading", progress: 100 });
        // Brief 100% flash so the user sees confirmation before the bar disappears.
        setTimeout(() => {
          setState({ status: "success", url: json.data.url });
          onChange(json.data.url);
        }, 200);
      } catch (err) {
        console.error("Upload failed:", err);
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Network error during upload.",
        });
      } finally {
        clearInterval(tick);
      }
    },
    [internshipId, onChange, validate]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so the same file can be re-selected after a failed upload.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleRemove = () => {
    setState({ status: "idle" });
    onChange(null);
  };

  const handleRetry = () => {
    setState({ status: "idle" });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {currentUrl && !hideRemove && state.status !== "uploading" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          >
            <X className="h-3 w-3 mr-1" />
            Remove
          </Button>
        )}
      </div>

      {/* Preview / Dropzone */}
      <AnimatePresence mode="wait">
        {currentUrl && state.status !== "uploading" ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative group rounded-lg overflow-hidden border border-border"
          >
            <div className="aspect-[1200/630] bg-muted flex items-center justify-center">
              <img
                src={currentUrl}
                alt="Internship cover preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Replace
              </Button>
              {!hideRemove && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleRemove}
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Remove
                </Button>
              )}
            </div>
          </motion.div>
        ) : state.status === "uploading" ? (
          <motion.div
            key="uploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border border-border p-6 space-y-3 bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Upload className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Uploading image…</p>
                <p className="text-xs text-muted-foreground">
                  Storing in Supabase Storage (public bucket)
                </p>
              </div>
              <span className="text-xs font-medium tabular-nums">
                {state.progress}%
              </span>
            </div>
            <Progress value={state.progress} className="h-2" />
          </motion.div>
        ) : (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_MIME.join(",")}
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-muted">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {isDragOver ? "Drop image here" : "Click to upload or drag & drop"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPEG, WebP, GIF — up to 5 MB
                </p>
                <p className="text-xs text-muted-foreground/80 mt-0.5">
                  Recommended: 1200 × 630 px (banner aspect ratio)
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state — shown below the dropzone so the user can still try again */}
      <AnimatePresence>
        {state.status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{state.message}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              className="h-7 px-2 text-xs shrink-0"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success confirmation — appears briefly after a fresh upload */}
      <AnimatePresence>
        {state.status === "success" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Image uploaded — will be saved when you save the internship.
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-xs text-muted-foreground">
        This image appears as a banner on the marketplace card and detail page.
        It&apos;s stored durably in Supabase Storage and survives page refreshes.
      </p>
    </div>
  );
}

export default InternshipImageUpload;
