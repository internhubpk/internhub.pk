"use client";

import React, { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/layout/sidebar";
import { Header, HeaderSkeleton } from "@/components/layout/header";
import { AuthProvider } from "@/components/providers/auth-provider";
import { PageLoader, ContentLoader } from "@/components/layout/loading-state";
import { cn } from "@/lib/utils";

// Loading fallback for the dashboard content
function DashboardLoading() {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar skeleton */}
      <div className="hidden lg:block w-[280px] h-screen border-r bg-sidebar animate-pulse" />
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <HeaderSkeleton />
        <main className="flex-1 p-6 overflow-auto">
          <ContentLoader />
        </main>
      </div>
    </div>
  );
}

// Dashboard shell with sidebar and header
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
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header />

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={typeof window !== "undefined" ? window.location.pathname : "dashboard"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="p-4 md:p-6 lg:p-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="border-t py-4 px-6 mt-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>
              © {new Date().getFullYear()} InternHub. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </a>
              <a href="/terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </a>
              <a href="/support" className="hover:text-foreground transition-colors">
                Support
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

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
