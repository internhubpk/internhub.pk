/**
 * Loading state for the dashboard route group.
 * Rendered automatically by Next.js while server components are loading.
 */
import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div
      className="flex min-h-[60vh] w-full items-center justify-center p-8"
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
