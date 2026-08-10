/**
 * InternHub Subdomain-Based Multi-Tenancy Service
 * 
 * This service provides centralized tenant (university) resolution
 * based on subdomain detection for the InternHub SaaS platform.
 * 
 * Architecture:
 *   internhub.pk (main platform)
 *     ├─ iiui.internhub.pk (IIUI portal)
 *     ├─ comsats.internhub.pk (COMSATS portal)
 *     └─ nust.internhub.pk (NUST portal)
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
// MOCK TENANT DATA FOR DEMO
// ============================================================

/**
 * Demo tenant configurations
 * In production, these would come from a database or config service
 */
export const DEMO_TENANTS: Record<string, TenantConfig> = {
  // Main platform (no subdomain)
  main: {
    id: "main",
    name: "InternHub",
    slug: "main",
    logo: "/logo.svg",
    favicon: "/favicon.ico",
    primaryColor: "#2563eb", // Blue-600
    secondaryColor: "#1e40af", // Blue-800
    domain: "internhub.pk",
    features: {
      enableMarketplace: true,
      enableEvaluations: true,
      enableCertificates: true,
      enableAttendance: true,
      customWorkflow: true,
      enableSSO: true,
      enableCustomDomain: true,
      maxStudents: Infinity,
    },
    branding: {
      tagline: "Enterprise Internship Management Platform",
      description:
        "InternHub is a comprehensive multi-tenant SaaS platform for managing university internships.",
      supportEmail: "support@internhub.pk",
      supportPhone: "+92-300-1234567",
    },
  },

  // IIUI - International Islamic University Islamabad
  iiui: {
    id: "tenant-iiui-001",
    name: "International Islamic University Islamabad",
    slug: "iiui",
    logo: "/logos/iiui-logo.svg",
    favicon: "/favicons/iiui.ico",
    primaryColor: "#006a4e", // IIUI Green
    secondaryColor: "#004d33",
    domain: "iiui.internhub.pk",
    features: {
      enableMarketplace: true,
      enableEvaluations: true,
      enableCertificates: true,
      enableAttendance: true,
      customWorkflow: false,
      enableSSO: false,
      enableCustomDomain: false,
      maxStudents: 5000,
    },
    branding: {
      loginBackgroundImage: "/backgrounds/iiui-bg.jpg",
      tagline: "Excellence in Professional Development",
      description:
        "IIUI Internship Portal - Connecting students with industry opportunities.",
      supportEmail: "internships@iiu.edu.pk",
      supportPhone: "+92-51-9019350",
    },
  },

  // COMSATS - COMSATS University Islamabad
  comsats: {
    id: "tenant-comsats-002",
    name: "COMSATS University Islamabad",
    slug: "comsats",
    logo: "/logos/comsats-logo.svg",
    favicon: "/favicons/comsats.ico",
    primaryColor: "#1a365d", // COMSATS Navy
    secondaryColor: "#0f2744",
    domain: "comsats.internhub.pk",
    features: {
      enableMarketplace: true,
      enableEvaluations: true,
      enableCertificates: true,
      enableAttendance: false,
      customWorkflow: false,
      enableSSO: true,
      enableCustomDomain: false,
      maxStudents: 10000,
    },
    branding: {
      tagline: "Bridging Academia and Industry",
      description:
        "CUI Internship Portal - Your gateway to professional experience.",
      supportEmail: "careers@comsats.edu.pk",
      supportPhone: "+92-51-9247700",
    },
  },

  // NUST - National University of Sciences & Technology
  nust: {
    id: "tenant-nust-003",
    name: "National University of Sciences & Technology",
    slug: "nust",
    logo: "/logos/nust-logo.svg",
    favicon: "/favicons/nust.ico",
    primaryColor: "#7c2d12", // NUST Brown/Rust
    secondaryColor: "#5c1d0b",
    domain: "nust.internhub.pk",
    features: {
      enableMarketplace: true,
      enableEvaluations: true,
      enableCertificates: true,
      enableAttendance: true,
      customWorkflow: true,
      enableSSO: true,
      enableCustomDomain: true,
      maxStudents: 15000,
    },
    branding: {
      loginBackgroundImage: "/backgrounds/nust-bg.jpg",
      tagline: "Leading Innovation and Excellence",
      description:
        "NUST Internship Portal - Empowering future leaders through practical experience.",
      supportEmail: "placements@nust.edu.pk",
      supportPhone: "+92-51-90851000",
    },
  },
};

// ============================================================
// SUBDOMAIN DETECTION UTILITIES (CLIENT-SAFE)
// ============================================================

/** 
 * Base domain for the platform 
 * In production, this would be an environment variable
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
  const subdomain = extractSubdomain(hostname);
  
  if (subdomain && DEMO_TENANTS[subdomain]) {
    return subdomain;
  }
  
  // Fallback: check URL search params for testing
  const params = new URLSearchParams(window.location.search);
  const testTenant = params.get("tenant");
  if (testTenant && DEMO_TENANTS[testTenant]) {
    return testTenant;
  }
  
  return null;
}

// ============================================================
// TENANT CONFIGURATION GETTERS (CLIENT-SAFE)
// ============================================================

/**
 * Get full tenant configuration by slug
 * Returns main platform config if no slug provided or not found
 */
export function getTenantConfig(slug: string | null): TenantConfig {
  if (!slug) {
    return DEMO_TENANTS.main;
  }
  
  return DEMO_TENANTS[slug] || DEMO_TENANTS.main;
}

/**
 * Get tenant configuration client-side
 */
export function getClientTenantConfig(): TenantConfig {
  const slug = detectClientTenantSlug();
  return getTenantConfig(slug);
}

/**
 * Check if a given slug is a valid tenant
 */
export function isValidTenant(slug: string): boolean {
  return slug in DEMO_TENANTS;
}

/**
 * Get list of all available tenants (for admin/super-admin views)
 */
export function getAllTenants(): TenantConfig[] {
  return Object.values(DEMO_TENANTS).filter(t => t.slug !== "main");
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
    title: `${tenant.name} - ${tenant.branding.tagline}`,
    description: tenant.branding.description,
    siteName: tenant.name,
  };
}
