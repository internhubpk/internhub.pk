"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

/**
 * DialogContent
 *
 * PRODUCTION SCROLLABLE MODAL (fixes React error #310 + popup overflow):
 *
 * Layout strategy: the DialogContent is a flex column with
 * `overflow-hidden` (NOT `overflow-y-auto`). Header and Footer are
 * `shrink-0`. The middle (whatever the caller puts between Header and
 * Footer, ideally a `<DialogBody>`) is the only scroll region.
 *
 * - Popup stays within the viewport: `max-h-[calc(100dvh-2rem)]`
 * - Header pinned (shrink-0)
 * - Footer pinned (shrink-0)
 * - Body scrolls vertically (use `<DialogBody>` or apply
 *   `flex-1 overflow-y-auto min-h-0` to your own wrapper)
 * - Close button is absolutely positioned relative to the non-scrolling
 *   DialogContent, so it stays in the top-right corner while the body
 *   scrolls
 * - Mobile + desktop + browser-zoom all work because `100dvh` adapts
 * - Keyboard accessible: Radix Dialog handles Esc + focus trap
 *
 * BACKWARD COMPATIBILITY
 *   Popups that don't yet use `<DialogBody>` still work — they just get
 *   a single scroll region wrapping all their children. To get the
 *   pinned-header/footer layout, wrap the body in `<DialogBody>`.
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-lg border shadow-lg duration-200 sm:max-w-lg",
          // Safety net for dialogs that place content DIRECTLY between
          // <DialogHeader> and <DialogFooter> without a <DialogBody> wrapper:
          // such middle children become scrollable instead of being clipped by
          // the parent's overflow-hidden when the content grows too tall.
          "[&>*:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not([data-slot=dialog-close])]:min-h-0 [&>*:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not([data-slot=dialog-close])]:shrink [&>*:not([data-slot=dialog-header]):not([data-slot=dialog-footer]):not([data-slot=dialog-close])]:overflow-y-auto",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 z-30 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex shrink-0 flex-col gap-2 p-8 pt-6 pb-4 text-center sm:text-left",
        className
      )}
      {...props}
    />
  )
}

/**
 * DialogBody — the scrollable middle region of a Dialog.
 *
 * Use this between <DialogHeader> and <DialogFooter> for any popup that
 * can have long content (forms, evaluation details, lists, tables, etc).
 *
 *   <DialogContent>
 *     <DialogHeader>...</DialogHeader>
 *     <DialogBody>
 *       ... long content ...
 *     </DialogBody>
 *     <DialogFooter>...</DialogFooter>
 *   </DialogContent>
 *
 * Behaviour:
 * - `flex-1 min-h-0` makes it take the remaining vertical space between
 *   the pinned header and footer
 * - `overflow-y-auto` scrolls vertically when content overflows
 * - `min-h-0` is critical — without it, flex children refuse to shrink
 *   below their content size and the popup blows past the viewport
 * - `px-6 pb-4` keeps horizontal padding consistent with the header
 * - Negative right margin so the scrollbar doesn't cause horizontal
 *   layout shift; we re-pad inside
 */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pb-5",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t p-8 pt-5 pb-6 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base leading-snug font-semibold break-words sm:text-lg", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm leading-relaxed break-words", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
