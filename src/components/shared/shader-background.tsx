"use client";

/**
 * ShaderBackground
 * -----------------
 * A subtle, theme-aware ambient light effect used behind public marketing
 * sections (main landing hero, tenant landing hero, and optionally login/
 * register/marketplace heroes per the design brief).
 *
 * Built on the `shaders` package (https://shaders.com), using the
 * freely-documented `Shader` + `LinearGradient` + `Aurora` primitives from
 * `shaders/react` (see https://shaders.com/docs/guide/react/quickstart).
 *
 * NOTE: this intentionally does NOT use the "Drifting Lights 8" preset —
 * that specific preset lives behind shaders.com's paid Pro tier and its
 * exact exported code/props aren't available without a Pro account. This
 * component recreates a similar "drifting ambient light" feel using the
 * public base components instead. If an exported Pro snippet becomes
 * available, swap the layer composition below for it directly.
 *
 * Design rules encoded here (see brief):
 *  - Client-only (WebGPU needs a browser) — this file is 'use client' and
 *    is also meant to be loaded via next/dynamic({ ssr: false }) by callers
 *    that render it inside a Server Component tree.
 *  - Colors flip automatically with next-themes, no page reload, no second
 *    theme system.
 *  - Graceful fallback (a plain CSS gradient) when WebGPU isn't supported,
 *    when the component hasn't mounted yet, or when prefers-reduced-motion
 *    is set — the page must look complete without it.
 *  - One shader instance per section; canvas is absolutely positioned and
 *    clipped so it can never cause horizontal/vertical page overflow.
 */

import * as React from "react";
import { useTheme } from "next-themes";

type ShaderBackgroundProps = {
  className?: string;
  /** Visual intensity — heroes get "high", smaller sections get "low". */
  intensity?: "low" | "high";
};

// Lazily-resolved shader module handle so this file has zero cost until a
// browser that actually supports WebGPU renders it.
type ShaderReactModule = typeof import("shaders/react");

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);
  return reduced;
}

function useWebGPUSupport() {
  const [supported, setSupported] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "gpu" in navigator);
  }, []);
  return supported;
}

/** Plain CSS fallback — used when WebGPU is unavailable, reduced-motion is
 *  on, or before the client has mounted. Keeps the section visually
 *  complete without any GPU dependency. */
function CssFallback({ className, isDark }: { className?: string; isDark: boolean }) {
  return (
    <div
      aria-hidden
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ""}`}
      style={{
        background: isDark
          ? "radial-gradient(60% 50% at 20% 20%, rgba(59,130,246,0.16), transparent), radial-gradient(50% 40% at 85% 75%, rgba(139,92,246,0.14), transparent)"
          : "radial-gradient(60% 50% at 20% 20%, rgba(37,99,235,0.08), transparent), radial-gradient(50% 40% at 85% 75%, rgba(124,58,237,0.07), transparent)",
      }}
    />
  );
}

export function ShaderBackground({ className, intensity = "high" }: ShaderBackgroundProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const reducedMotion = useReducedMotion();
  const webgpuSupported = useWebGPUSupport();
  const [mod, setMod] = React.useState<ShaderReactModule | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted || reducedMotion || webgpuSupported !== true) return;
    let cancelled = false;
    // Dynamic import can reject (network failure, bundler resolution issue,
    // WebGPU adapter init error inside the module, etc.). We MUST handle
    // that — otherwise it becomes an unhandled promise rejection and the
    // page would show a blank hero. On rejection we leave `mod` null so
    // the CssFallback renders and the page stays visually complete.
    import("shaders/react")
      .then((m) => {
        if (!cancelled) setMod(m);
      })
      .catch((error) => {
        if (!cancelled) {
          // Preserve the CSS fallback — `mod` stays null and the next
          // render returns <CssFallback />. Log a development-safe
          // diagnostic so the failure is observable without exposing
          // internals to end users (this is dev-only; production builds
          // stay silent to avoid console spam for users whose browsers
          // can't load the shader).
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              "[shader-background] Failed to load shaders/react — falling back to CSS.",
              error
            );
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, reducedMotion, webgpuSupported]);

  // Before mount, `resolvedTheme` is undefined (next-themes hasn't read the
  // class from <html> yet). Force a deterministic value so the SSR markup
  // matches the first client render exactly — avoids a hydration mismatch.
  const isDark = mounted && resolvedTheme === "dark";

  // Not mounted yet, reduced motion requested, WebGPU unsupported, or the
  // module hasn't loaded — always render something complete, never a gap.
  if (!mounted || reducedMotion || webgpuSupported !== true || !mod) {
    return <CssFallback className={className} isDark={isDark} />;
  }

  const { Shader, LinearGradient, Aurora } = mod;

  // Theme-specific palettes — never share colors across themes (brief §10).
  // Only documented props are used: LinearGradient takes colorA/colorB/angle
  // (confirmed at shaders.com/docs/guide/react/quickstart); Aurora takes
  // intensity (confirmed at shaders.com/docs/components/aurora) — it does
  // NOT take a color prop, so all color variation lives in the gradient.
  const light = {
    colorA: "#eff6ff", // soft blue-white
    colorB: "#f5f3ff", // soft violet-white
    auroraIntensity: intensity === "high" ? 45 : 25,
    opacity: intensity === "high" ? 0.55 : 0.3,
  };
  const dark = {
    colorA: "#0b1220",
    colorB: "#1e1b4b",
    auroraIntensity: intensity === "high" ? 70 : 40,
    opacity: intensity === "high" ? 0.5 : 0.28,
  };
  const palette = isDark ? dark : light;

  return (
    <div
      aria-hidden
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ""}`}
      style={{ opacity: palette.opacity }}
    >
      <Shader className="w-full h-full">
        <LinearGradient colorA={palette.colorA} colorB={palette.colorB} angle={135} />
        <Aurora intensity={palette.auroraIntensity} />
      </Shader>
    </div>
  );
}
