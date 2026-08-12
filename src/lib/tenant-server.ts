/**
 * Server-side tenant detection utilities
 *
 * This module uses next/headers which is only available in server components
 * and middleware/proxy context. Do NOT import this in client components.
 */

import { headers } from "next/headers";
import { extractSubdomain, getTenantConfig, DEMO_TENANTS } from "./tenant";
import type { TenantConfig } from "./tenant";
import { requireAuth } from "./authorization";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Detect tenant slug from request headers (server-side only)
 * Falls back to query param for local dev testing
 */
export async function detectTenantSlug(): Promise<string | null> {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "";

    // Try to extract from hostname first
    const subdomain = extractSubdomain(host);

    if (subdomain && DEMO_TENANTS[subdomain]) {
      return subdomain;
    }

    // Fallback: check X-Tenant header (for reverse proxy setups)
    const tenantHeader = headersList.get("x-tenant");
    if (tenantHeader && DEMO_TENANTS[tenantHeader]) {
      return tenantHeader;
    }

    return null;
  } catch (error) {
    // Headers might not be available in all contexts
    console.log("Tenant detection error:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Get tenant configuration server-side (from request)
 */
export async function getServerTenantConfig(): Promise<TenantConfig> {
  const slug = await detectTenantSlug();
  return getTenantConfig(slug);
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
