"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/sidebar";
import { Header, HeaderSkeleton } from "@/components/layout/header";
import { AuthProvider, useAuth } from "@/components/providers/auth-provider";
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
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setRedirecting(true);
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Show the loading skeleton while the session is resolving, and keep
  // showing it while we redirect an unauthenticated visitor away — the
  // dashboard shell (and any page-specific data fetching) must never
  // mount for a user that doesn't exist.
  if (authLoading || !isAuthenticated || redirecting) {
    return <DashboardLoading />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ============================================ */}
      {/* SIDEBAR - Fixed Position                     */}
      {/* ============================================ */}
      <Sidebar />

      {/* ============================================ */}
      {/* MAIN CONTENT AREA                            */}
      {/* ============================================ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* HEADER - Sticky */}
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
        {/* FOOTER - pinned to the bottom of the flex column.
            Because the parent is h-screen overflow-hidden and main is the
            only scrollable element, this footer never moves when the user
            scrolls the main content. shrink-0 prevents it from collapsing,
            bg-background gives it a solid backdrop so content scrolling
            underneath doesn't show through, and relative z-10 keeps it
            above any transiently-positioned UI. */}
        {/* ============================================ */}
        <footer className="border-t border-border py-4 px-6 shrink-0 bg-background relative z-10">
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
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <RouteGuard>
          <DashboardShell>{children}</DashboardShell>
        </RouteGuard>
      </Suspense>
    </AuthProvider>
  );
}
