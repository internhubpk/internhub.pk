"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThemeAwareLogoProps {
  /** Show icon-only version (without "INTERN HUB" text) */
  iconOnly?: boolean;
  /** Height in pixels - width is calculated automatically based on aspect ratio */
  height?: number;
  /** Additional CSS classes */
  className?: string;
  /** Priority for Image loading (use for above-the-fold logos) */
  priority?: boolean;
  /** Alt text for accessibility */
  alt?: string;
}

/**
 * ThemeAwareLogo - Renders the appropriate logo variant based on current theme.
 * 
 * Logo files:
 * - With name: logo-light.png / logo-dark.png (includes "INTERN HUB" text)
 * - Icon only: logo-icon-light.png / logo-icon-dark.png (just the mark)
 * 
 * Usage:
 * ```tsx
 * // Full logo with name (e.g., auth page, mobile menu header)
 * <ThemeAwareLogo height={48} />
 * 
 * // Icon only (e.g., navbar, favicon-style)
 * <ThemeAwareLogo iconOnly height={32} />
 * ```
 */
export function ThemeAwareLogo({
  iconOnly = false,
  height = 40,
  className,
  priority = false,
  alt = "CareerStep Logo",
}: ThemeAwareLogoProps) {
  const { resolvedTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering theme-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine if dark mode is active
  const isDark = mounted 
    ? resolvedTheme === 'dark' || (resolvedTheme === 'system' && systemTheme === 'dark')
    : false;

  // Select appropriate logo source based on theme and mode.
  // Icon-only mark is now SVG (square 550x550 source, vectorized from the
  // original artwork) — fixes the stretching that happened when the square
  // mark was force-fit into the old 191x200 PNG's aspect ratio.
  const logoSrc = iconOnly
    ? isDark
      ? "/logo-icon-dark.svg"
      : "/logo-icon-light.svg"
    : isDark
      ? "/logo-dark.png"
      : "/logo-light.png";

  // Icon mark is a square (1:1) SVG — width always equals height, so it can
  // never stretch regardless of the box it's placed in. Full logo with name
  // keeps its real intrinsic PNG ratio (364x240).
  const width = iconOnly ? height : Math.round(height * (364 / 240));

  // Placeholder while determining theme or before hydration
  if (!mounted) {
    return (
      <div
        className={cn("relative inline-block", className)}
        style={{ width, height }}
      >
        {/* Spacer to prevent layout shift */}
        <div className="w-full h-full bg-muted/50 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <Image
      src={logoSrc}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={cn(
        "object-contain relative z-10",
        className
      )}
      // Explicit CSS sizing that matches the width/height attributes keeps
      // the aspect ratio locked and satisfies Next.js Image's
      // "modified but not the other" check when parents constrain layout.
      style={{ transition: "opacity 0.2s ease-in-out", width: `${width}px`, height: `${height}px` }}
    />
  );
}

/**
 * ThemeAwareLogoLink - Combines the logo with a link to homepage.
 * Convenience wrapper for common use case.
 */
export function ThemeAwareLogoLink({
  iconOnly = false,
  height = 40,
  className,
  priority = true,
}: Omit<ThemeAwareLogoProps, "alt">) {
  return (
    <a href="/" className={cn("inline-flex items-center group", className)}>
      <ThemeAwareLogo
        iconOnly={iconOnly}
        height={height}
        priority={priority}
        className="group-hover:scale-105 transition-transform duration-200"
      />
    </a>
  );
}

export default ThemeAwareLogo;
