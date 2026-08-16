/**
 * Loading state for the dashboard route group.
 * Rendered automatically by Next.js while server components are loading.
 *
 * Centering: use min-h-[100dvh] (not vh) so the spinner is vertically
 * centered in the actual viewport on mobile browsers too — vh doesn't
 * account for the URL bar shrinking/expanding on scroll, which left
 * the spinner drifting near the top on iOS Safari. We also use
 * `h-dvh` on the dashboard layout for the same reason.
 */
import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div
      className="flex min-h-[100dvh] w-full items-center justify-center p-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
        <p className="text-sm">Loading dashboard…</p>
      </div>
    </div>
  );
}
