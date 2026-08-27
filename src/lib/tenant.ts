/**
 * CareerStep Subdomain-Based Multi-Tenancy Service
 *
 * Provides centralized tenant (university) resolution based on subdomain.
 * Tenant records live in the `universities` table — this module only handles
 * subdomain extraction and provides a sensible default platform config for
 * the main domain.
 *
 * Architecture:
 *   careerstep.tech (main platform)
 *     ├─ iiui.careerstep.tech (IIUI portal)
 *     ├─ comsats.careerstep.tech (COMSATS portal)
 *     └─ nust.careerstep.tech (NUST portal)
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
  /** Full domain for this tenant (e.g., iiui.careerstep.tech) */
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
  name: "CareerStep",
  slug: "main",
  logo: "/logo-icon-light.png",
  logoUrl: "/logo-icon-light.png",
  favicon: "/favicon.ico",
  primaryColor: "#2563eb", // Blue-600
  secondaryColor: "#1e40af", // Blue-800
  domain: "careerstep.tech",
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
      "CareerStep is a comprehensive multi-tenant SaaS platform for managing university internships.",
    supportEmail: "info@ailab99.com",
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
 * Infrastructure / hosting domains where the leftmost label is NOT a tenant
 * slug. For example `internhub-abc123.vercel.app` would otherwise be treated
 * as tenant "internhub-abc123" — clearly wrong. When the apex of the hostname
 * matches one of these, we skip subdomain extraction entirely.
 *
 * Add new entries here when you adopt a new hosting/preview provider. Keep
 * this list short and stable — it's the only "hardcoded" domain knowledge
 * left in tenant detection, and it's only used to suppress false positives.
 */
const INFRA_DOMAINS: readonly string[] = [
  "vercel.app",
  "vercel.dev",
  "netlify.app",
  "netlify.com",
  "cloudflarepages.dev",
  "pages.dev",
  "onrender.com",
  "railway.app",
  "fly.dev",
  "herokuapp.com",
  "firebaseapp.com",
  "web.app",
  "azurewebsites.net",
  "amazonaws.com",
];

/**
 * Subdomain labels that are reserved for infrastructure / common use and must
 * never be treated as tenant slugs. Adding a university with one of these
 * names would collide with these reserved prefixes.
 */
const RESERVED_SUBDOMAINS: readonly string[] = [
  "www",
  "app",
  "admin",
  "api",
  "mail",
  "cdn",
  "static",
  "auth",
  "docs",
  "blog",
  "support",
  "help",
  "status",
  "assets",
  "media",
  "staging",
  "dev",
  "test",
  "preview",
  "demo",
];

/**
 * Check whether `hostname` ends with one of the infrastructure domains.
 * Examples that return true:
 *   internhub-abc.vercel.app  →  matches "vercel.app"
 *   foo.netlify.app           →  matches "netlify.app"
 * Examples that return false:
 *   internhub.pk              →  no infra match
 *   iiui.example.com          →  no infra match
 */
export function isInfrastructureDomain(hostname: string): boolean {
  return INFRA_DOMAINS.some((d) =>
    hostname === d || hostname.endsWith(`.${d}`)
  );
}

// Short alias used by callers (proxy.ts, login page) that just need a
// boolean "is this an infra / preview hostname?" check.
export const isInfraDomain = isInfrastructureDomain;

/**
 * Extract tenant slug from hostname — DOMAIN-AGNOSTIC.
 *
 * Works on ANY apex domain (internhub.pk, internship-portal.com, myuni.edu,
 * etc.) so the platform can be deployed anywhere without code changes.
 *
 * Rules:
 *   1. localhost / 127.0.0.1 → null (main platform on dev)
 *   2. Infrastructure / hosting domains (vercel.app, netlify.app, …) → null
 *      (the leftmost label is a deployment name, not a tenant)
 *   3. Hostname needs ≥ 3 dot-separated parts for a subdomain to exist
 *      (e.g. `iiuni.example.com` has 3 parts → tenant "iiui";
 *       `example.com` has 2 parts → null / main platform)
 *   4. Reserved subdomain labels (www, app, admin, api, …) → null
 *   5. Otherwise the first label is the tenant slug
 *
 * Examples:
 *   internhub.pk                  → null (main)
 *   iiui.internhub.pk             → "iiui"
 *   nust.internship-portal.com    → "nust"
 *   example.com                   → null (main)
 *   www.example.com               → null (reserved)
 *   internhub-abc.vercel.app      → null (infra domain)
 *   localhost:3000                → null (dev)
 *   iiui.localhost:3000           → "iiui" (dev subdomain pattern)
 */
export function extractSubdomain(hostname: string): string | null {
  // Strip port for local development (e.g. "localhost:3000" → "localhost")
  const hostWithoutPort = hostname.split(":")[0];

  // localhost / loopback = main platform (no tenant in dev by default)
  if (hostWithoutPort === "localhost" || hostWithoutPort === "127.0.0.1") {
    return null;
  }

  // Infrastructure / hosting domains: leftmost label is a deployment name,
  // not a tenant slug. Treat as main platform.
  if (isInfrastructureDomain(hostWithoutPort)) {
    return null;
  }

  const parts = hostWithoutPort.split(".");

  // Need at least 3 parts for a subdomain (sub.domain.tld). Anything shorter
  // is an apex domain (example.com) → main platform.
  if (parts.length < 3) {
    return null;
  }

  const subdomain = parts[0];

  // Reserved labels are not tenant slugs.
  if (RESERVED_SUBDOMAINS.includes(subdomain)) {
    return null;
  }

  // Sanity: reject empty labels (e.g. "..example.com") and labels that are
  // clearly not slug-shaped (contain spaces, etc.). Slug regex mirrors what
  // the universities.slug column accepts.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(subdomain)) {
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
 * Get tenant configuration client-side.
 *
 * Returns a TenantConfig whose `slug` reflects the detected subdomain so
 * that `useTenant().isTenant` resolves correctly client-side. Brand colors
 * stay at the platform default — the actual per-tenant branding is hydrated
 * server-side via `getServerTenantConfig()` (which queries the universities
 * table) and passed into <TenantProvider initialTenant=…>. The client only
 * needs the slug to know whether it's on a tenant subdomain or the main
 * platform.
 */
export function getClientTenantConfig(): TenantConfig {
  const slug = detectClientTenantSlug();

  // No subdomain → main platform
  if (!slug) {
    return PLATFORM_DEFAULT_TENANT;
  }

  // Tenant subdomain detected — return a config with the slug set so
  // isTenant becomes true. Branding stays at platform default; the server
  // has already hydrated the real branding via initialTenant.
  return {
    ...PLATFORM_DEFAULT_TENANT,
    id: slug,
    slug,
    name: slug, // server-side hydration will overwrite this with the real name
  };
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
    title: `${tenant.name} - ${tenant.branding.tagline ?? "CareerStep"}`,
    description: tenant.branding.description ?? "CareerStep Platform",
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
