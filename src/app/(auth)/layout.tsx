import { ReactNode } from "react";
import dynamic from "next/dynamic";

// Client-only, per shaders.com's Next.js/SSR guidance — kept out of the
// server bundle. Subtle here per the design brief ("Login: optional /
// subtle"), so it never competes with the auth card's own glass effect.
const ShaderBackground = dynamic(
  () => import("@/components/shared/shader-background").then((m) => m.ShaderBackground),
  { ssr: false }
);

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-950 dark:via-blue-950/30 dark:to-purple-950/30">
      {/* Ambient shader — subtle by design, sits behind the existing
          decorative orbs and grid so it never reduces form readability. */}
      <ShaderBackground intensity="low" />

      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-300/10 rounded-full blur-3xl" />
        
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
          style={{
            backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(59, 130, 246, 0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Main content card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo only — no tagline / no "Enterprise Internship Management
            Platform" subtitle (removed per user feedback to keep the
            auth page clean and focused). */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-3">
            <div className="relative group">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-[2px] shadow-xl shadow-blue-500/25">
                <div className="w-full h-full rounded-2xl bg-white dark:bg-gray-900 flex items-center justify-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-8 h-8"
                  >
                    <defs>
                      <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#2563eb" />
                        <stop offset="50%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#7c3aed" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M12 2L2 7L12 12L22 7L12 2Z"
                      stroke="url(#logo-gradient)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <path
                      d="M2 17L12 22L22 17"
                      stroke="url(#logo-gradient)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 12L12 17L22 12"
                      stroke="url(#logo-gradient)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 opacity-0 blur-xl transition-opacity group-hover:opacity-20" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              InternHub
            </span>
          </h1>
        </div>

        {/* Auth card */}
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 rounded-2xl shadow-2xl shadow-black/5 dark:shadow-black/20">
          {children}
        </div>

        {/* Footer text */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} InternHub. All rights reserved.
        </p>
      </div>
    </div>
  );
}
