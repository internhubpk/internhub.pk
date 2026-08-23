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

  // Select appropriate logo source based on theme and mode
  const logoSrc = iconOnly
    ? isDark 
      ? "/logo-icon-dark.png" 
      : "/logo-icon-light.png"
    : isDark 
      ? "/logo-dark.png" 
      : "/logo-light.png";

  // Calculate width based on aspect ratio
  // Full logo is roughly 2.5:1 (width:height), icon is ~1:1
  const width = iconOnly ? height : Math.round(height * 2.4);

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
      // Ensure smooth transitions when theme changes
      style={{ transition: "opacity 0.2s ease-in-out" }}
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
