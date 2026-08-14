"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/sidebar";
import { Header, HeaderSkeleton } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
// AuthProvider is now hoisted to src/app/layout.tsx so that ALL
// pages (public + dashboard) share the same auth context. The
// dashboard layout no longer wraps children in its own AuthProvider;
// doing so would create a duplicate provider that fetches the session
// twice and creates two independent auth states.
import { PageLoader, ContentLoader } from "@/components/layout/loading-state";
import { RouteGuard } from "@/components/auth/route-guard";
import { cn } from "@/lib/utils";

// ============================================
// LOADING FALLBACK FOR DASHBOARD CONTENT
// ============================================
function DashboardLoading() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar skeleton */}
      <div className="hidden lg:block w-[280px] h-full border-r border-border bg-[#0a0f1c] animate-pulse" />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <HeaderSkeleton />
        <main className="flex-1 overflow-auto p-6">
          <ContentLoader />
        </main>
      </div>
    </div>
  );
}

// ============================================
// DASHBOARD SHELL WITH SIDEBAR AND HEADER
// ============================================
function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [pathname, setPathname] = useState("dashboard");
  const [redirecting, setRedirecting] = useState(false);

  // Get pathname only on client side to avoid hydration mismatch
  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);

  // Once we know for sure there's no signed-in user, send them to /login
  // instead of ever rendering the dashboard shell or its children.
  // Use a hard window.location replace (not router.replace) so the proxy
  // re-evaluates auth from scratch with cleared cookies.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setRedirecting(true);
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      } else {
        router.replace("/login");
      }
    }
  }, [authLoading, isAuthenticated, router]);

  // Lock the document scroll while the dashboard shell is mounted. The
  // only scrollable element should be the <main> region inside the shell.
  // Without this lock, some setups (especially when a Radix Dialog portal
  // briefly mounts at the document root) let the whole body scroll, which
  // makes the footer drift away from the bottom of the viewport.
  useEffect(() => {
    document.body.classList.add("dashboard-layout-lock");
    return () => {
      document.body.classList.remove("dashboard-layout-lock");
    };
  }, []);

  // Show the loading skeleton while the session is resolving, and keep
  // showing it while we redirect an unauthenticated visitor away — the
  // dashboard shell (and any page-specific data fetching) must never
  // mount for a user that doesn't exist.
  if (authLoading || !isAuthenticated || redirecting) {
    return <DashboardLoading />;
  }

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-background">
      {/* ============================================ */}
      {/* SIDEBAR - flex item, takes its natural width      */}
      {/* Desktop only: the mobile hamburger trigger lives   */}
      {/* inside <Header/> (lg:hidden), so hide this instance */}
      {/* on mobile to avoid rendering two menu icons.       */}
      {/* ============================================ */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* ============================================ */}
      {/* MAIN CONTENT AREA                            */}
      {/* ============================================ */}
      <div className="flex-1 flex flex-col h-dvh overflow-hidden min-w-0">
        {/* HEADER — non-sticky block at top of the flex column. (sticky
            has no effect here because the parent has overflow-hidden and
            is not the scroll container; main below is.) */}
        <Header />

        {/* SCROLLABLE MAIN CONTENT
            - flex-1 + min-h-0 lets it shrink within the flex column so the
              footer below always stays visible at the bottom of the viewport.
            - overflow-y-auto makes only this element scroll, not the whole
              page, so the footer never moves when the user scrolls. */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className={cn(
                "p-4 md:p-6 lg:p-8",
                // Add max-width constraint for readability on large screens
                "mx-auto w-full max-w-[1600px]"
              )}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* ============================================ */}
        {/* FOOTER — pinned to the bottom of the flex column with shrink-0.
            Because:
              • the outer div is h-dvh + overflow-hidden
              • the body has dashboard-layout-lock (overflow:hidden)
              • the inner column is h-dvh + overflow-hidden + flex-col
              • main is flex-1 min-h-0 overflow-y-auto (the ONLY scroll region)
            this footer can never move when the user scrolls. The body
            scroll-lock above is the key — without it, some setups (Radix
            Dialog portals mounting at document root) let the whole body
            scroll, which made the footer drift. */}
        {/* ============================================ */}
        <footer className="border-t border-border py-4 px-6 shrink-0 bg-background">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} InternHub. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a
                href="/privacy"
                className="hover:text-foreground transition-colors duration-200"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className="hover:text-foreground transition-colors duration-200"
              >
                Terms of Service
              </a>
              <a
                href="/support"
                className="hover:text-foreground transition-colors duration-200"
              >
                Support
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================
// DEFAULT DASHBOARD LAYOUT EXPORT
// ============================================
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // AuthProvider is provided by the root layout (src/app/layout.tsx) so
  // that public pages and dashboard pages share the same auth context.
  // We only need Suspense + RouteGuard + DashboardShell here.
  return (
    <Suspense fallback={<PageLoader />}>
      <RouteGuard>
        <DashboardShell>{children}</DashboardShell>
      </RouteGuard>
    </Suspense>
  );
}
