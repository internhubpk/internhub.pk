/**
 * Error boundary for the dashboard route group.
 * Rendered automatically by Next.js when a server component throws.
 */
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for debugging — production should ship this to a real
    // error reporting service (Sentry, etc.).
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div
      className="flex min-h-[60vh] w-full items-center justify-center p-6"
      role="alert"
    >
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred while loading this page. You can try
            again, or return to the home page.
          </p>
        </div>
        {error?.digest && (
          <p className="text-xs text-muted-foreground/70">
            Error ID: <code className="font-mono">{error.digest}</code>
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <Button onClick={reset} size="sm">
            <RotateCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
