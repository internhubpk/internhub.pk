import type { ReactNode } from "react";
import { GraduationCap } from "lucide-react";

/**
 * Auth layout (wraps /login and /register — /register just redirects here
 * with ?mode=register).
 *
 * Shader removed per direct feedback: pure CSS ambient glow only, no
 * canvas/WebGPU dependency. Padding reworked — the previous inner form
 * wrapper (login/page.tsx) used px-1 py-2 (4px/8px), crushing the form
 * against the card edge. Padding now lives on the card shell here
 * instead, applied generously and consistently at every breakpoint.
 *
 * Brand mark: uses the same GraduationCap icon (in a blue rounded box)
 * that appears in site-nav, public-footer, and the favicon. This unifies
 * the auth page with the rest of the app's identity — previously it had
 * a unique "stacked chevrons" SVG that didn't match any other surface.
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

      {/* Main content card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo — GraduationCap in a blue rounded box, matching site-nav
            and public-footer. */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center mb-3 sm:mb-4">
            <div className="relative group">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl shadow-blue-500/25 flex items-center justify-center">
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
