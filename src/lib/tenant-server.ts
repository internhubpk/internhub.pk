/**
 * Server-side tenant detection utilities
 *
 * This module uses next/headers which is only available in server components
 * and middleware/proxy context. Do NOT import this in client components.
 */

import { headers } from "next/headers";
import { extractSubdomain, PLATFORM_DEFAULT_TENANT } from "./tenant";
import type { TenantConfig } from "./tenant";
import { requireAuth } from "./authorization";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// In-memory cache for university row lookups within a single request. The
// layout calls getServerTenantConfig() and generateMetadata() in close
// succession — without this cache we'd hit the DB twice for the same row.
// The cache is module-scoped but keyed by slug, so concurrent requests for
// different tenants don't collide. Entries expire after 60 seconds to pick
// up branding changes without a server restart.
const tenantCache = new Map<string, { tenant: TenantConfig; expiresAt: number }>();
const TENANT_CACHE_TTL_MS = 60_000;

/**
 * Detect tenant slug from request headers (server-side only).
 *
 * Domain-agnostic: works on any apex domain. Returns the subdomain label
 * (e.g. "iiui") when one is present, or null for the main platform /
 * apex domain / reserved subdomain / infrastructure domain.
 *
 * Falls back to the `x-tenant` header for reverse-proxy setups where the
 * subdomain isn't visible in the Host header (e.g. when fronted by an
 * API gateway that rewrites the host).
 */
export async function detectTenantSlug(): Promise<string | null> {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "";

    // Try the hostname first — this is the primary path in production.
    const subdomain = extractSubdomain(host);
    if (subdomain) {
      return subdomain;
    }

    // Fallback: explicit x-tenant header (set by a reverse proxy / API
    // gateway that knows the tenant but doesn't expose it via Host).
    const tenantHeader = headersList.get("x-tenant");
    if (tenantHeader && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(tenantHeader)) {
      return tenantHeader;
    }

    return null;
  } catch {
    // Headers might not be available in all contexts (e.g. during build).
    // Silently fall through to null — caller returns the platform default.
    return null;
  }
}

/**
 * Fetch a tenant config from the universities table by slug.
 *
 * Returns null if the slug doesn't match any row, the university is
 * inactive, or the Supabase env vars aren't configured (e.g. during
 * build). Caching is in-memory, keyed by slug, with a 60s TTL.
 *
 * This is safe to call from server components and the layout — it uses
 * the anonymous Supabase client (universities is RLS-readable for anon
 * so the platform landing page can render tenant branding pre-auth).
 */
async function fetchTenantBySlug(slug: string): Promise<TenantConfig | null> {
  // Check cache first
  const cached = tenantCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return null; // build-time / missing env
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: { getAll: () => [], setAll: () => {} },
    });

    const { data, error } = await supabase
      .from("universities")
      .select("id, name, slug, domain, logo_url, settings")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Read brand colors from settings jsonb, falling back to platform defaults.
    const settings = (data.settings ?? {}) as {
      primaryColor?: string;
      secondaryColor?: string;
      tagline?: string;
      description?: string;
    };

    const tenant: TenantConfig = {
      ...PLATFORM_DEFAULT_TENANT,
      id: data.id,
      name: data.name,
      slug: data.slug,
      domain: data.domain ?? `${data.slug}.${(process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "internhub.pk")}`,
      logo: data.logo_url ?? PLATFORM_DEFAULT_TENANT.logo,
      primaryColor: settings.primaryColor ?? PLATFORM_DEFAULT_TENANT.primaryColor,
      secondaryColor: settings.secondaryColor ?? PLATFORM_DEFAULT_TENANT.secondaryColor,
      branding: {
        ...PLATFORM_DEFAULT_TENANT.branding,
        tagline: settings.tagline ?? PLATFORM_DEFAULT_TENANT.branding.tagline,
        description: settings.description ?? PLATFORM_DEFAULT_TENANT.branding.description,
      },
    };

    // Cache for subsequent lookups in the same request / nearby requests
    tenantCache.set(slug, { tenant, expiresAt: Date.now() + TENANT_CACHE_TTL_MS });
    return tenant;
  } catch {
    // DB / network error — fall back to platform default branding.
    return null;
  }
}

/**
 * Get tenant configuration server-side (from request hostname + DB).
 *
 * Flow:
 *   1. Detect slug from Host header (domain-agnostic).
 *   2. If a slug is detected, look up the universities table for branding.
 *   3. If the DB lookup fails or returns nothing, fall back to a slug-only
 *      TenantConfig so the client still knows it's on a tenant subdomain
 *      (just with platform-default branding).
 *   4. If no slug detected, return PLATFORM_DEFAULT_TENANT (main platform).
 */
export async function getServerTenantConfig(): Promise<TenantConfig> {
  const slug = await detectTenantSlug();

  if (!slug) {
    return PLATFORM_DEFAULT_TENANT;
  }

  const fromDb = await fetchTenantBySlug(slug);
  if (fromDb) {
    return fromDb;
  }

  // Slug detected but no matching university row (or DB unavailable).
  // Return a slug-stamped platform default so isTenant=true client-side
  // and the layout can still render — just with default branding.
  return {
    ...PLATFORM_DEFAULT_TENANT,
    id: slug,
    slug,
    name: slug,
  };
}

// ============================================================
// SERVER-SIDE TENANT SECURITY HELPERS
// ============================================================
//
// These helpers are imported by API routes and the api-security module.
// They provide a thin layer over `requireAuth` + tenant context resolution
// so that route handlers can do `if (!await validateTenantOwnership(...))`
// without each route reinventing the check.

/**
 * Result returned by `getServerTenantContext` and `validateTenantOwnership`.
 */
export interface TenantContextResult {
  /** Authenticated user id (auth.users.id). */
  userId: string;
  /** Profile.university_id for the authenticated user, or null. */
  universityId: string | null;
  /** Profile.department_id for the authenticated user, or null. */
  departmentId: string | null;
  /** Profile.role for the authenticated user. */
  role: string | null;
  /** True for super_admins — they bypass tenant checks. */
  isSuperAdmin: boolean;
}

/**
 * Resolve the tenant context for the currently-authenticated user.
 * Throws if the user is not authenticated.
 */
export async function getServerTenantContext(): Promise<TenantContextResult> {
  const authContext = await requireAuth();
  if (!authContext.isAuthenticated || !authContext.user) {
    throw new Error("Authentication required");
  }
  const role = authContext.profile?.role ?? null;
  return {
    userId: authContext.user.id,
    universityId: authContext.profile?.university_id ?? null,
    departmentId: authContext.profile?.department_id ?? null,
    role,
    isSuperAdmin: role === "super_admin",
  };
}

/**
 * Validate that the currently-authenticated user has access to the given
 * university's data. Returns `true` if access is allowed (same university
 * or super_admin), `false` otherwise.
 */
export async function validateTenantOwnership(
  resourceUniversityId: string,
  _options?: {
    supabase?: SupabaseClient;
    departmentId?: string;
  }
): Promise<boolean> {
  const ctx = await getServerTenantContext();
  if (ctx.isSuperAdmin) return true;
  if (!ctx.universityId) return false;
  return ctx.universityId === resourceUniversityId;
}

/**
 * Apply the current tenant's university filter to a Supabase query builder.
 * Usage:
 *   const query = await buildTenantQuery(supabase.from("students"));
 *   // -> query is now scoped to the caller's university (or unscoped for super_admin)
 */
export async function buildTenantQuery<T extends { eq: (col: string, val: string) => T }>(
  builder: T
): Promise<T> {
  const ctx = await getServerTenantContext();
  if (ctx.isSuperAdmin) return builder;
  if (!ctx.universityId) {
    // No tenant context — return a builder that yields nothing.
    return builder.eq("university_id", "__NO_TENANT__");
  }
  return builder.eq("university_id", ctx.universityId);
}
