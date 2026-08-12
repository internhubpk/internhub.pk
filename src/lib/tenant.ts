/**
 * InternHub Subdomain-Based Multi-Tenancy Service
 *
 * Provides centralized tenant (university) resolution based on subdomain.
 * Tenant records live in the `universities` table — this module only handles
 * subdomain extraction and provides a sensible default platform config for
 * the main domain.
 *
 * Architecture:
 *   internhub.pk (main platform)
 *     ├─ iiui.internhub.pk (IIUI portal)
 *     ├─ comsats.internhub.pk (COMSATS portal)
 *     └─ nust.internhub.pk (NUST portal)
 *
 * To look up a tenant's brand/colors from the DB, call `getTenantConfig(slug)`
 * which returns the platform default synchronously — caller code can fetch
 * the real tenant record from the `universities` table when needed.
 */

import type { TenantConfig as BaseTenantConfig } from "@/types";

// ============================================================
// TENANT CONFIGURATION INTERFACE
// ============================================================

export interface TenantConfig extends BaseTenantConfig {
  /** Unique identifier (e.g., UUID or slug) */
  id: string;
  /** Display name of the tenant/university */
  name: string;
  /** URL-safe slug used in subdomain */
  slug: string;
  /** Logo URL - can be relative or absolute */
  logo: string;
  /** Favicon URL for browser tab */
  favicon?: string;
  /** Primary brand color (hex) */
  primaryColor: string;
  /** Secondary/accent color (hex) */
  secondaryColor: string;
  /** Full domain for this tenant (e.g., iiui.internhub.pk) */
  domain: string;
  /** Feature flags for this tenant */
  features: TenantFeatures;
  /** Custom branding configuration */
  branding: {
    loginBackgroundImage?: string;
    supportEmail?: string;
    supportPhone?: string;
    tagline?: string;
    description?: string;
  };
}

export interface TenantFeatures {
  enableMarketplace: boolean;
  enableEvaluations: boolean;
  enableCertificates: boolean;
  enableAttendance: boolean;
  customWorkflow: boolean;
  enableSSO: boolean;
  enableCustomDomain: boolean;
  maxStudents: number;
}

// ============================================================
// PLATFORM DEFAULT CONFIG (main domain only)
// ============================================================

/**
 * The platform default. Per-tenant overrides should be loaded from the
 * `universities` table in the database.
 */
export const PLATFORM_DEFAULT_TENANT: TenantConfig = {
  id: "main",
  name: "InternHub",
  slug: "main",
  logo: "/logo.svg",
  logoUrl: "/logo.svg",
  favicon: "/favicon.ico",
  primaryColor: "#2563eb", // Blue-600
  secondaryColor: "#1e40af", // Blue-800
  domain: "internhub.pk",
  customDomain: null,
  features: {
    enableMarketplace: true,
    enableEvaluations: true,
    enableCertificates: true,
    enableAttendance: true,
    customWorkflow: true,
    enableSSO: false,
    enableCustomDomain: false,
    maxStudents: Number.MAX_SAFE_INTEGER,
  },
  branding: {
    tagline: "Enterprise Internship Management Platform",
    description:
      "InternHub is a comprehensive multi-tenant SaaS platform for managing university internships.",
    supportEmail: "support@internhub.pk",
    supportPhone: "+92-300-1234567",
  },
};

// Back-compat alias for older code that still imports DEMO_TENANTS.
// Only contains the platform default — no per-tenant demo data.
export const DEMO_TENANTS: Record<string, TenantConfig> = {
  main: PLATFORM_DEFAULT_TENANT,
};

// ============================================================
// SUBDOMAIN DETECTION UTILITIES (CLIENT-SAFE)
// ============================================================

/**
 * Base domains for the platform
 */
const BASE_DOMAINS = [
  "internhub.pk",
  "internhub.app",
  "localhost:3000",
  "localhost",
];

/**
 * Extract subdomain from hostname
 * Examples:
 *   iiui.internhub.pk -> "iiui"
 *   internhub.pk -> null (main)
 *   localhost:3000 -> null (main)
 *   iiui.localhost:3000 -> "iiui" (dev mode)
 */
export function extractSubdomain(hostname: string): string | null {
  // Remove port if present for local development
  const hostWithoutPort = hostname.split(":")[0];

  // Check for localhost development patterns
  if (hostWithoutPort === "localhost" || hostWithoutPort === "127.0.0.1") {
    return null; // Main platform on localhost
  }

  // Split hostname into parts
  const parts = hostWithoutPort.split(".");

  // Need at least 3 parts for subdomain (sub.domain.tld)
  if (parts.length < 3) {
    return null; // No subdomain
  }

  // Get potential subdomain (first part)
  const subdomain = parts[0];

  // Check if base domain matches our known domains
  const baseDomain = parts.slice(-2).join(".");

  if (!BASE_DOMAINS.some(d => d.includes(baseDomain))) {
    // Unknown domain - treat as main platform
    return null;
  }

  // Skip common non-tenant subdomains
  const reservedSubdomains = ["www", "app", "admin", "api", "mail", "cdn", "static"];
  if (reservedSubdomains.includes(subdomain)) {
    return null;
  }

  return subdomain;
}

/**
 * Detect tenant slug client-side from window.location
 * Safe for use in client components
 */
export function detectClientTenantSlug(): string | null {
  if (typeof window === "undefined") return null;

  const hostname = window.location.hostname;
  return extractSubdomain(hostname);
}

// ============================================================
// TENANT CONFIGURATION GETTERS (CLIENT-SAFE)
// ============================================================

/**
 * Get platform default tenant configuration by slug.
 * NOTE: This returns the platform default. Per-tenant overrides (name, logo,
 * colors) should be fetched from the `universities` table by the calling code.
 */
export function getTenantConfig(slug: string | null): TenantConfig {
  return PLATFORM_DEFAULT_TENANT;
}

/**
 * Get tenant configuration client-side
 */
export function getClientTenantConfig(): TenantConfig {
  return PLATFORM_DEFAULT_TENANT;
}

/**
 * Check if a given slug is a valid tenant.
 * Always returns true for "main"; for any other slug, the caller should
 * verify against the database.
 */
export function isValidTenant(slug: string): boolean {
  return slug === "main" || slug.length > 0;
}

/**
 * Get list of all available tenants (for admin/super-admin views).
 * NOTE: Returns empty list — call the API to fetch real tenants from DB.
 */
export function getAllTenants(): TenantConfig[] {
  return [PLATFORM_DEFAULT_TENANT];
}

/**
 * Get tenant's CSS custom properties for theming
 */
export function getTenantThemeVars(tenant: TenantConfig): Record<string, string> {
  return {
    "--tenant-primary": tenant.primaryColor,
    "--tenant-secondary": tenant.secondaryColor,
    "--tenant-primary-rgb": hexToRgb(tenant.primaryColor),
  };
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "37, 99, 235"; // Default blue
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

/**
 * Generate tenant-specific page title
 */
export function getTenantPageTitle(tenant: TenantConfig, pageTitle?: string): string {
  if (pageTitle) {
    return `${pageTitle} | ${tenant.name}`;
  }
  return tenant.name;
}

/**
 * Generate Open Graph metadata for tenant
 */
export function getTenantOpenGraph(tenant: TenantConfig) {
  return {
    title: `${tenant.name} - ${tenant.branding.tagline ?? "InternHub"}`,
    description: tenant.branding.description ?? "InternHub Platform",
    siteName: tenant.name,
  };
}

// ============================================================
// NOTE: Server-side tenant security helpers (validateTenantOwnership,
// getServerTenantContext, buildTenantQuery) live in `./tenant-server.ts`,
// NOT here. This file is imported by client components (via
// tenant-provider.tsx), so it must NOT transitively import `next/headers`
// or any other server-only module. See `./tenant-server.ts` for the
// server-side helpers.
// ============================================================
