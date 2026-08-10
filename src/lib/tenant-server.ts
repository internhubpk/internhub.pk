/**
 * Server-side tenant detection utilities
 * 
 * This module uses next/headers which is only available in server components
 * and middleware/proxy context. Do NOT import this in client components.
 */

import { headers } from "next/headers";
import { extractSubdomain, getTenantConfig, DEMO_TENANTS } from "./tenant";
import type { TenantConfig } from "./tenant";

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
