"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Home, ArrowLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { ThemeAwareLogo } from "@/components/layout/theme-aware-logo";

/**
 * Auth layout (wraps /login and /register — /register just redirects here
 * with ?mode=register).
 *
 * Features:
 * - Compact back to home button (top-left)
 * - Small theme toggle button (top-right)
 * - Clean gradient background
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 py-10 sm:py-12">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl" />
      </div>

      {/* Top bar - compact & minimal */}
      <div className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 md:px-6 md:py-3">
        {/* Back to Home - Small & Clean */}
        <Link 
          href="/" 
          className="group flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <Home className="h-3.5 w-3.5 hidden xs:inline" />
          <span>Home</span>
        </Link>

        {/* Theme Toggle - Tiny Icon Button */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center justify-center h-7 w-7 rounded-md border border-border/50 bg-background/50 backdrop-blur-sm hover:bg-accent transition-colors duration-200"
          aria-label="Toggle theme"
        >
          <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 absolute" />
          <Moon className="h-3.5 w-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-[420px] mt-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center justify-center group">
            <ThemeAwareLogo height={56} priority={true} className="group-hover:scale-105 transition-transform duration-300" />
          </Link>
        </div>

        {/* Auth card */}
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-border/50 rounded-xl shadow-xl p-5 sm:p-6">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} CareerStep
        </p>
      </div>
    </div>
  );
}
