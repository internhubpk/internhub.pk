/**
 * Not-found boundary for the dashboard route group.
 * Rendered automatically by Next.js when a route inside this segment
 * returns `notFound()`.
 */
import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div
      className="flex min-h-[60vh] w-full items-center justify-center p-6"
      role="alert"
    >
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Page not found</h2>
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard">
            <Home className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
