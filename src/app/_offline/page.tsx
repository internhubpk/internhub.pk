/**
 * Offline fallback page — shown by the service worker when the user is
 * offline and tries to navigate to a page that isn't cached.
 */

import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">You&apos;re offline</h1>
          <p className="text-muted-foreground">
            We can&apos;t reach InternHub right now. Please check your internet
            connection and try again.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Once you&apos;re back online, this page will automatically refresh.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </Link>
        </div>
      </div>
    </div>
  );
}
