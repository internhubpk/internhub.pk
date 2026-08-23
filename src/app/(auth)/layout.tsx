import type { ReactNode } from "react";
import Link from "next/link";
import { GraduationCap, Home, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/**
 * Auth layout (wraps /login and /register — /register just redirects here
 * with ?mode=register).
 *
 * Features:
 * - Back to home button in top-left corner
 * - Theme toggle (light/dark) button in top-right corner
 * - Clean gradient background with subtle grid pattern
 * - Centered auth card with logo and branding
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-950 dark:via-blue-950/30 dark:to-purple-950/30 px-4 py-10 sm:py-12">
      {/* Background decorative elements — pure CSS, no shader/canvas.
          Sized so they never push the page wider than the viewport. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 sm:-top-40 sm:-right-40 w-64 h-64 sm:w-80 sm:h-80 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 sm:-bottom-40 sm:-left-40 w-64 h-64 sm:w-80 sm:h-80 bg-purple-400/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-300/10 rounded-full blur-3xl" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
          style={{
            backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(59, 130, 246, 0.5) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Top navigation bar with back to home + theme toggle */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
        {/* Back to Home Button */}
        <Link 
          href="/" 
          className="group flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg border border-border/50 hover:border-border shadow-sm hover:shadow-md transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Back to Home</span>
          <span className="sm:hidden">Home</span>
        </Link>

        {/* Theme Toggle */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg border border-border/50 p-2 shadow-sm">
          <ThemeToggle />
        </div>
      </div>

      {/* Main content card */}
      <div className="relative z-10 w-full max-w-md mt-16">
        {/* Logo — GraduationCap in a blue rounded box, matching site-nav
            and public-footer. */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center mb-3 sm:mb-4">
            <div className="relative group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl shadow-blue-500/25 flex items-center justify-center group-hover:shadow-blue-500/40 transition-all duration-300 group-hover:scale-105">
                <GraduationCap className="w-8 h-8 sm:w-9 sm:h-9 text-white" strokeWidth={2} />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-blue-600 opacity-0 blur-xl transition-opacity group-hover:opacity-20" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
              CareerStep
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Internship Management Platform
          </p>
        </div>

        {/* Auth card */}
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 rounded-2xl shadow-2xl shadow-black/5 dark:shadow-black/20 p-5 sm:p-8">
          {children}
        </div>

        {/* Footer text */}
        <p className="mt-5 sm:mt-6 text-center text-xs text-muted-foreground px-4">
          © {new Date().getFullYear()} CareerStep. All rights reserved.
        </p>
      </div>
    </div>
  );
}
