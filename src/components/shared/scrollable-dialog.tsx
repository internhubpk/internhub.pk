"use client";

/**
 * ScrollableDialog
 * ----------------
 * A wrapper around shadcn's Dialog that enforces the InternHub modal
 * layout pattern:
 *
 *   ┌────────────────────────────────────┐
 *   │ Title                          [X] │  ← shrink-0 header (always visible)
 *   ├────────────────────────────────────┤
 *   │                                    │
 *   │ Scrollable content                 │  ← flex-1 overflow-y-auto
 *   │                                    │
 *   ├────────────────────────────────────┤
 *   │ Cancel                  Save       │  ← shrink-0 footer (always visible)
 *   └────────────────────────────────────┘
 *
 * Why this exists:
 *   - Plain shadcn Dialog with `max-h-[90vh]` + `overflow-hidden` lets
 *     the content overflow and the action buttons get pushed off the
 *     viewport on mobile. This wrapper guarantees the header and footer
 *     are always visible and only the body scrolls.
 *   - Standardizes padding (px-6 py-4), max-width breakpoints, and the
 *     "click-outside-to-close" behavior so every dialog in the app
 *     feels the same.
 *
 * Usage:
 *   <ScrollableDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Create Task"
 *     description="Fill in the task details."
 *     footer={
 *       <>
 *         <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
 *         <Button onClick={handleSave}>Save</Button>
 *       </>
 *     }
 *   >
 *     ... content ...
 *   </ScrollableDialog>
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScrollableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Optional icon to render next to the title */
  titleIcon?: React.ComponentType<{ className?: string }>;
  /** Footer (typically Cancel + Save buttons). Omit to hide. */
  footer?: React.ReactNode;
  /** Body content. Will be wrapped in a scrollable container. */
  children: React.ReactNode;
  /** Max width class. Defaults to max-w-2xl. */
  maxWidthClassName?: string;
  /** Disable the close button (X). Defaults to false. */
  hideCloseButton?: boolean;
  /** Override the body padding. Defaults to px-6 pb-4. */
  bodyClassName?: string;
  /** Override the header padding. Defaults to px-6 pt-6 pb-4. */
  headerClassName?: string;
  /** Override the footer padding. Defaults to px-6 py-4 border-t bg-background. */
  footerClassName?: string;
  /** Called when the user clicks the X button or outside the dialog. */
  onClose?: () => void;
}

export function ScrollableDialog({
  open,
  onOpenChange,
  title,
  description,
  titleIcon: TitleIcon,
  footer,
  children,
  maxWidthClassName = "sm:max-w-2xl",
  hideCloseButton = false,
  bodyClassName,
  headerClassName,
  footerClassName,
  onClose,
}: ScrollableDialogProps) {
  const handleOpenChange = (next: boolean) => {
    if (!next && onClose) onClose();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        // ScrollableDialog renders its own close button in the header
        // (positioned correctly within the header layout). We MUST disable
        // DialogContent's auto-rendered close button to avoid having TWO
        // close buttons (one from DialogContent's absolute-positioned X in
        // the top-right, and one from ScrollableDialog's header X).
        showCloseButton={false}
        className={cn(
          // Layout: vertical flex column that fills the viewport height
          // up to a max of 90vh. Header + footer are shrink-0; body is
          // flex-1 + overflow-y-auto so only the body scrolls.
          "flex flex-col gap-0 p-0 max-h-[90vh] overflow-hidden",
          maxWidthClassName
        )}
        // Disable Radix's default close-on-outside-click if needed
        // (kept enabled — standard UX expectation)
      >
        {/* Header — always visible */}
        {(title || description || !hideCloseButton) && (
          <DialogHeader
            className={cn(
              "shrink-0 flex flex-row items-start justify-between gap-4 px-6 pt-6 pb-4",
              headerClassName
            )}
          >
            <div className="flex-1 min-w-0 space-y-1">
              {title && (
                <DialogTitle className="flex items-center gap-2 text-lg leading-tight pr-2">
                  {TitleIcon && <TitleIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />}
                  <span className="break-words">{title}</span>
                </DialogTitle>
              )}
              {description && (
                <DialogDescription className="text-sm text-muted-foreground break-words">
                  {description}
                </DialogDescription>
              )}
            </div>
            {!hideCloseButton && (
              <DialogClose
                className="shrink-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </DialogClose>
            )}
          </DialogHeader>
        )}

        {/* Body — scrollable */}
        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto px-6 pb-4",
            bodyClassName
          )}
        >
          {children}
        </div>

        {/* Footer — always visible */}
        {footer && (
          <DialogFooter
            className={cn(
              "shrink-0 px-6 py-4 border-t bg-background flex-row justify-end gap-2 sm:justify-end",
              footerClassName
            )}
          >
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ScrollableDialog;
