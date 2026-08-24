"use client";

/**
 * AvatarUploader — shared profile-picture upload component.
 *
 * Features:
 *   - Shows current avatar (from profile.avatar_url).
 *   - Click to select a new image.
 *   - Preview before upload.
 *   - Validates file type (png/jpeg/webp) and size (≤5 MB).
 *   - Uploads to Supabase Storage at path `{user.id}/{filename}` —
 *     matches the Storage RLS policy
 *     `(storage.foldername(name))[1] = auth.uid()`.
 *   - Updates `profiles.avatar_url` with the public URL.
 *   - Calls `onUploaded(url)` so the parent can refresh its profile state.
 *   - Shows loading state, prevents duplicate uploads.
 *   - Success/error toasts via the shared toast utility.
 *   - Mobile-friendly (large touch target, responsive size).
 *   - Does NOT destroy the existing avatar on failure.
 *
 * SECURITY
 *   - The path is constructed from `user.id` (from the session), never
 *     from a client-provided user ID.
 *   - The Storage RLS policy enforces that the first path segment must
 *     match `auth.uid()`, so even if the client tried to upload to
 *     another user's folder, the INSERT would be denied.
 *   - `upsert: true` so the user can change their picture (replaces
 *     the old file at the same path).
 *
 * Usage:
 *   <AvatarUploader
 *     userId={user.id}
 *     currentUrl={profile?.avatar_url}
 *     onUploaded={(url) => refreshProfile()}
 *     size="md"
 *   />
 */

import React, { useRef, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Upload, X, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";

interface AvatarUploaderProps {
  userId: string;
  currentUrl: string | null | undefined;
  fullName?: string | null;
  onUploaded?: (url: string) => void;
  onRemoved?: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-28 w-28",
  xl: "h-36 w-36",
} as const;

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB — matches the bucket limit

export function AvatarUploader({
  userId,
  currentUrl,
  fullName,
  onUploaded,
  onRemoved,
  size = "lg",
  disabled = false,
  className,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const initials = React.useMemo(() => {
    if (!fullName) return "U";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0]?.[0]?.toUpperCase() || "U";
  }, [fullName]);

  const validateFile = useCallback((file: File): string | null => {
    // Some browsers report jpg as image/jpg, others as image/jpeg.
    const fileType = file.type === "image/jpg" ? "image/jpeg" : file.type;
    if (!ALLOWED_TYPES.includes(fileType) && !ALLOWED_TYPES.includes(file.type)) {
      return "Please select a PNG, JPEG, or WebP image.";
    }
    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `Image is ${sizeMB} MB. Maximum allowed is 5 MB.`;
    }
    return null;
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (!userId || uploading || disabled) return;

      // Validate
      const validationError = validateFile(file);
      if (validationError) {
        toast.error(validationError);
        return;
      }

      // Show preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      setUploading(true);
      try {
        const supabase = createClient();

        // Construct the path: {user_id}/avatar_{timestamp}.{ext}
        // This matches the Storage RLS policy:
        //   (storage.foldername(name))[1] = auth.uid()::text
        const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const fileName = `avatar_${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        // Upload to Storage. upsert: true so the user can replace.
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
            contentType: file.type === "image/jpg" ? "image/jpeg" : file.type,
          });

        if (uploadError) throw uploadError;

        // Get the public URL (bucket is public, so this URL works directly)
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        // Update the profile with the new avatar URL
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
          .eq("user_id", userId);

        if (updateError) throw updateError;

        // Success
        toast.success("Profile picture updated successfully.");
        onUploaded?.(publicUrl);
      } catch (error) {
        console.error("[AvatarUploader] upload failed:", error);
        // Don't destroy the existing avatar — just show an error.
        // The preview is cleared in the finally block.
        const msg =
          error instanceof Error
            ? error.message
            : "Failed to upload profile picture. Please try again.";
        // Sanitize: don't show raw Storage errors to the user
        if (
          msg.toLowerCase().includes("row-level security") ||
          msg.toLowerCase().includes("rls") ||
          msg.toLowerCase().includes("policy")
        ) {
          toast.error("Failed to upload profile picture.", {
            description: "You may not have permission to upload. Please try again.",
          });
        } else if (
          msg.toLowerCase().includes("mime") ||
          msg.toLowerCase().includes("type")
        ) {
          toast.error("Unsupported file type.", {
            description: "Please use PNG, JPEG, or WebP.",
          });
        } else if (msg.toLowerCase().includes("size")) {
          toast.error("File too large.", {
            description: "Maximum size is 5 MB.",
          });
        } else {
          toast.error("Failed to upload profile picture.", {
            description: "Please try again.",
          });
        }
      } finally {
        setUploading(false);
        // Clear preview (the real avatar will show after refreshProfile)
        setPreview(null);
        // Reset input so the same file can be selected again
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    },
    [userId, uploading, disabled, validateFile, onUploaded]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // Remove the user's avatar — both the file in the `avatars` bucket AND
  // the `profiles.avatar_url` column. Without this, users could upload
  // many avatars over time, all stored in the bucket forever, bloating
  // storage usage.
  const handleRemove = useCallback(async () => {
    if (!userId || removing || disabled) return;
    if (!currentUrl) {
      toast.error("No profile picture to remove.");
      return;
    }
    setRemoving(true);
    try {
      const supabase = createClient();

      // Extract the storage path from the public URL.
      // Public URL format:
      //   https://<project>.supabase.co/storage/v1/object/public/avatars/<user_id>/avatar_<ts>.<ext>
      // We need just the path AFTER `/avatars/` → `<user_id>/avatar_<ts>.<ext>`
      let objectPath: string | null = null;
      try {
        const url = new URL(currentUrl);
        const parts = url.pathname.split("/avatars/");
        if (parts.length === 2 && parts[1]) {
          objectPath = decodeURIComponent(parts[1]);
        }
      } catch {
        // currentUrl is not a valid URL — skip the storage delete (the
        // avatar_url column will still be cleared, which is the user-visible
        // outcome).
      }

      // Delete the file from Storage (best-effort — the file might already
      // be gone, or path extraction might have failed).
      if (objectPath) {
        try {
          const { error: removeError } = await supabase.storage
            .from("avatars")
            .remove([objectPath]);
          if (removeError) {
            // Don't fail the whole operation — the profile.avatar_url
            // cleanup is the user-visible outcome. A dangling file in
            // storage is a minor issue compared to a stuck UI.
            console.warn(
              "[AvatarUploader] storage.remove() returned an error (non-fatal):",
              removeError.message
            );
          }
        } catch (removeErr) {
          console.warn(
            "[AvatarUploader] storage.remove() threw (non-fatal):",
            removeErr
          );
        }
      }

      // Clear the avatar_url column on the profile.
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      toast.success("Profile picture removed.");
      onRemoved?.();
    } catch (error) {
      console.error("[AvatarUploader] remove failed:", error);
      toast.error("Failed to remove profile picture.", {
        description:
          error instanceof Error
            ? error.message
            : "Please try again.",
      });
    } finally {
      setRemoving(false);
    }
  }, [userId, removing, disabled, currentUrl, onRemoved]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative inline-block group">
        <Avatar
          className={cn(
            SIZE_MAP[size],
            "ring-2 ring-border transition-all",
            dragOver && "ring-primary ring-4",
            uploading && "opacity-60"
          )}
        >
          <AvatarImage
            src={preview || currentUrl || undefined}
            alt="Profile picture"
          />
          <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              initials
            )}
          </AvatarFallback>
        </Avatar>

        {/* Upload button overlay */}
        {!disabled && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleInputChange}
              className="hidden"
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || disabled}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/40 transition-all cursor-pointer disabled:cursor-not-allowed"
              title="Click to upload a new profile picture"
            >
              {!uploading && (
                <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </>
        )}

        {/* Cancel preview button */}
        {preview && uploading && (
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setUploading(false);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="absolute -top-1 -right-1 p-1 rounded-full bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90"
            title="Cancel"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {!disabled && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || removing}
            className="text-xs"
          >
            {uploading ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-3 w-3 mr-1.5" />
                {currentUrl ? "Change Photo" : "Upload Photo"}
              </>
            )}
          </Button>
          {currentUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={uploading || removing}
              className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {removing ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <X className="h-3 w-3 mr-1.5" />
                  Remove
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {!disabled && (
        <p className="text-xs text-muted-foreground text-center max-w-[200px]">
          PNG, JPEG, or WebP. Max 5 MB.
        </p>
      )}
    </div>
  );
}
