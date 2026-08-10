"use client";

import React, { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/sidebar";
import { Header, HeaderSkeleton } from "@/components/layout/header";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PageLoader, ContentLoader } from "@/components/layout/loading-state";
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
  const [isLoading, setIsLoading] = React.useState(true);

  // Simulate initial loading - in production this would be based on auth state
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
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

        {/* SCROLLABLE MAIN CONTENT */}
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={
                typeof window !== "undefined" ? window.location.pathname : "dashboard"
              }
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
        {/* FOOTER - Optional                             */}
        {/* ============================================ */}
        <footer className="border-t border-border py-4 px-6 mt-auto shrink-0">
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
        <DashboardShell>{children}</DashboardShell>
      </Suspense>
    </AuthProvider>
  );
}
