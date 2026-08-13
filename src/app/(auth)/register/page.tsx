"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /register — redirect to /login?mode=register
 *
 * Login and Register are now combined into a single page (one card with a
 * Sign In / Request Access tab toggle). This route preserves the old
 * /register URL by redirecting users to the unified page on the Register
 * tab, so existing links (e.g. "Get Started Free" on the landing page)
 * keep working.
 */
export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?mode=register");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-sm text-muted-foreground">Redirecting…</div>
    </div>
  );
}
