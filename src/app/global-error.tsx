/**
 * Global Error Boundary
 *
 * Catches errors that escape route-level error.tsx files — most
 * importantly React error #310 ("Rendered more hooks than during
 * the previous render") which can happen during hydration when the
 * auth state transitions quickly.
 *
 * This is a "client" component by requirement — Next.js requires
 * global-error.tsx to be a client component.
 *
 * Behaviour:
 *   - Log the error to the console (production should forward to Sentry).
 *   - Show a friendly error page with "Try again" (reset) and "Reload"
 *     buttons. For React #310 specifically, "Reload" is more reliable
 *     than "Try again" because the hook-order violation can persist
 *     across re-renders until the module is re-evaluated.
 */
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for debugging — production should ship this to a
    // real error reporting service (Sentry, etc.).
    console.error("[GlobalError]", error);

    // React #310 ("Rendered more hooks than during the previous render")
    // is particularly sticky — a soft reset() often doesn't clear it
    // because the offending component re-mounts with the same hook
    // tree. Auto-reload once per session to recover gracefully.
    const RELOAD_FLAG = "__internhub_global_error_reloaded";
    if (
      error.message &&
      (error.message.includes("310") ||
        error.message.includes("Rendered more hooks") ||
        error.message.includes("Minified React error"))
    ) {
      try {
        const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG);
        if (!alreadyReloaded) {
          sessionStorage.setItem(RELOAD_FLAG, "1");
          // Hard reload to clear the broken React state.
          window.location.reload();
          return;
        }
        // Already reloaded once — clear the flag so future errors can
        // trigger another reload.
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        // sessionStorage might be disabled — fall through to the UI.
      }
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <div
          className="flex max-w-md flex-col items-center gap-4 text-center"
          role="alert"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle
              className="h-7 w-7 text-destructive"
              aria-hidden="true"
            />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Try reloading the page — if the
              problem persists, please sign in again.
            </p>
          </div>
          {error?.digest && (
            <p className="text-xs text-muted-foreground/70">
              Error ID:{" "}
              <code className="font-mono rounded bg-muted px-1.5 py-0.5">
                {error.digest}
              </code>
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-2 justify-center">
            <Button
              onClick={() => {
                // Hard reload — clears any broken React state.
                window.location.reload();
              }}
              size="sm"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload page
            </Button>
            <Button onClick={reset} size="sm" variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">
                <Home className="mr-2 h-4 w-4" />
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
