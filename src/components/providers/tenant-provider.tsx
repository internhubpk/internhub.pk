"use client";

/**
 * TenantProvider - React Context Provider for Multi-Tenancy
 * 
 * This provider:
 * 1. Detects tenant from subdomain (client-side)
 * 2. Falls back to headers set by middleware
 * 3. Provides tenant config to entire app via context
 * 4. Updates document title/favicon based on tenant
 * 5. Applies tenant theme colors as CSS variables
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { TenantConfig, TenantFeatures } from "@/lib/tenant";
import {
  getClientTenantConfig,
  getTenantThemeVars,
  DEMO_TENANTS,
} from "@/lib/tenant";

// ============================================================
// CONTEXT TYPES
// ============================================================

interface TenantContextType {
  /** Current tenant configuration */
  tenant: TenantConfig;
  /** Whether we're on a tenant subdomain (not main platform) */
  isTenant: boolean;
  /** Tenant slug (e.g., 'iiui', 'comsats', or 'main') */
  tenantSlug: string;
  /** Whether tenant detection has completed */
  isLoading: boolean;
  /** Whether this is the main InternHub platform */
  isMainPlatform: boolean;
  /** Check if a feature is enabled for current tenant */
  hasFeature: (feature: keyof TenantFeatures) => boolean;
}

// ============================================================
// CONTEXT CREATION
// ============================================================

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Parse tenant info from response headers (set by middleware)
 * Returns null if no header data available
 */
function parseTenantFromHeaders(): Partial<TenantConfig> | null {
  // This function runs client-side, but headers are only available during SSR
  // We use a meta tag approach to pass initial data
  if (typeof document === "undefined") return null;

  const metaTag = document.querySelector('meta[name="x-tenant-data"]');
  if (!metaTag) return null;

  try {
    return JSON.parse(metaTag.getAttribute("content") || "{}");
  } catch {
    return null;
  }
}

/**
 * Apply CSS custom properties for theming
 */
function applyTenantTheme(tenant: TenantConfig): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const vars = getTenantThemeVars(tenant);

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

/**
 * Update document title based on tenant
 */
function updateDocumentTitle(tenant: TenantConfig): void {
  if (typeof document === "undefined") return;

  const baseTitle = tenant.branding.tagline 
    ? `${tenant.name} - ${tenant.branding.tagline}`
    : tenant.name;
  
  // Only update if not already set by page-specific metadata
  if (!document.title.includes(tenant.name)) {
    document.title = baseTitle;
  }
}

/**
 * Update favicon based on tenant
 */
function updateFavicon(tenant: TenantConfig): void {
  if (typeof document === "undefined" || !tenant.favicon) return;

  let faviconLink = document.querySelector(
    'link[rel="icon"]'
  ) as HTMLLinkElement | null;

  if (!faviconLink) {
    faviconLink = document.createElement("link");
    faviconLink.rel = "icon";
    document.head.appendChild(faviconLink);
  }

  if (faviconLink.href !== tenant.favicon) {
    faviconLink.href = tenant.favicon;
  }
}

// ============================================================
// PROVIDER COMPONENT
// ============================================================

interface TenantProviderProps {
  children: React.ReactNode;
  /** Initial server-side tenant data (from layout) */
  initialTenant?: TenantConfig | null;
}

export function TenantProvider({ children, initialTenant }: TenantProviderProps) {
  const [tenant, setTenant] = useState<TenantConfig>(() => {
    // Use initial data from server if available
    if (initialTenant) {
      return initialTenant;
    }
    // Fallback to main platform during SSR/hydration
    return DEMO_TENANTS.main;
  });

  const [isLoading, setIsLoading] = useState(!initialTenant);

  // Detect and set tenant on mount
  useEffect(() => {
    // If we already have initial data from server, still verify client-side
    const detectTenant = () => {
      // First try client-side detection from hostname
      const clientTenant = getClientTenantConfig();
      
      // Verify it matches or use what we have
      if (clientTenant.slug !== "main") {
        setTenant(clientTenant);
      }
      
      setIsLoading(false);
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(detectTenant, 0);
    return () => clearTimeout(timer);
  }, []);

  // Apply theme and branding when tenant changes
  useEffect(() => {
    if (!isLoading && tenant) {
      applyTenantTheme(tenant);
      updateDocumentTitle(tenant);
      updateFavicon(tenant);
    }
  }, [tenant, isLoading]);

  // Feature check helper. NOTE: `TenantFeatures` has one numeric field
  // (`maxStudents`) and the rest are booleans. Treating the result as a
  // boolean is intentional — for the numeric field, a truthy check (any
  // non-zero limit) is what callers want. We coerce explicitly so the
  // return type stays `boolean`.
  const hasFeature = useCallback(
    (feature: keyof TenantFeatures): boolean => {
      const value = tenant.features[feature];
      return typeof value === "boolean" ? value : value > 0;
    },
    [tenant.features]
  );

  // Memoize context value
  const value: TenantContextType = useMemo(
    () => ({
      tenant,
      isTenant: tenant.slug !== "main",
      tenantSlug: tenant.slug,
      isLoading,
      isMainPlatform: tenant.slug === "main",
      hasFeature,
    }),
    [tenant, isLoading, hasFeature]
  );

  // NOTE: A tenant-data <meta> tag used to be rendered here as
  // `{typeof window !== "undefined" && <meta .../>}`. That pattern was the
  // ROOT CAUSE of React hydration error #418 on every page: the server
  // rendered no meta tag (window is undefined during SSR), and the client
  // rendered one during hydration — a textbook hydration mismatch.
  //
  // The same meta tag is already injected by the root layout
  // (src/app/layout.tsx, inside <head>) using the server-side tenant
  // config, so the client can read it via parseTenantFromHeaders()
  // without needing a second copy in the React tree. We deliberately do
  // NOT re-render it here.
  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

// ============================================================
// HOOK EXPORTS
// ============================================================

/**
 * Hook to access current tenant context
 * Must be used within a TenantProvider
 */
export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

/**
 * Hook to get just the tenant configuration object
 * Convenience wrapper around useTenant()
 */
export function useTenantConfig(): TenantConfig {
  const { tenant } = useTenant();
  return tenant;
}

/**
 * Hook to check if current user is on a tenant subdomain
 */
export function useIsTenant(): boolean {
  const { isTenant } = useTenant();
  return isTenant;
}

/**
 * Hook to get tenant's brand colors
 */
export function useTenantBranding() {
  const { tenant } = useTenant();
  
  return useMemo(
    () => ({
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      logo: tenant.logo,
      name: tenant.name,
      tagline: tenant.branding.tagline,
      description: tenant.branding.description,
    }),
    [tenant]
  );
}

export default TenantProvider;
