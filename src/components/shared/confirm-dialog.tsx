"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type ConfirmVariant = "danger" | "warning" | "info" | "success";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog title, e.g. "Delete company?" */
  title: React.ReactNode;
  /** Explanation shown under the title. May contain React nodes (warning boxes etc). */
  description?: React.ReactNode;
  /** Optional extra content rendered INSIDE the scrollable area (forms, lists, …). */
  children?: React.ReactNode;
  /** Confirm button label. */
  confirmLabel?: string;
  /** Cancel button label. */
  cancelLabel?: string;
  /** Visual severity of the confirm button. Default "danger" (destructive red). */
  variant?: ConfirmVariant;
  /** Disables the confirm button + shows a spinner with the label. */
  loading?: boolean;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Extra classes for the dialog content (e.g. "sm:max-w-[500px]"). */
  contentClassName?: string;
}

const variantClasses: Record<ConfirmVariant, string> = {
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  warning: "bg-amber-600 text-white hover:bg-amber-700",
  info: "bg-primary text-primary-foreground hover:bg-primary/90",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

/**
 * Shared confirmation dialog for destructive / important actions
 * (delete, suspend, revoke, terminate, …).
 *
 * Mobile-first responsive:
 *  - text wraps (break-words) and scrolls when long
 *  - buttons stack full-width below the text on phones, row on desktop
 *  - footer is pinned — never overlaps the text
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  contentClassName,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <AlertDialogContent className={contentClassName}>
        <AlertDialogHeader>
          <AlertDialogTitle
            className={cn(
              "flex items-start gap-2 text-left",
              variant === "danger" && "text-destructive"
            )}
          >
            {title}
          </AlertDialogTitle>
          {description !== undefined && (
            <AlertDialogDescription className="text-left">
              {description}
            </AlertDialogDescription>
          )}
          {children}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Keep the dialog open while the async action runs — the caller
              // closes it on success/failure via `open` state.
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className={variantClasses[variant]}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {confirmLabel}
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
