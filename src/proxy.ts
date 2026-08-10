import { type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/middleware";
import { NextResponse } from "next/server";
import {
  extractSubdomain,
  isValidTenant,
  DEMO_TENANTS,
} from "@/lib/tenant";

/**
 * InternHub Middleware / Proxy
 * 
 * Handles:
 * 1. Subdomain-based tenant detection
 * 2. Authentication state management
 * 3. Route protection
 * 4. Tenant context propagation via headers
 */

export async function proxy(request: NextRequest) {
  const { supabase, supabaseResponse } = createClient(request);

  // ============================================================
  // TENANT DETECTION FROM SUBDOMAIN
  // ============================================================
  
  const hostname = request.headers.get("host") || "";
  const tenantSlug = extractSubdomain(hostname);
  const isKnownTenant = tenantSlug ? isValidTenant(tenantSlug) : false;
  
  // Handle unknown subdomains - redirect to main platform
  if (tenantSlug && !isKnownTenant) {
    const url = request.nextUrl.clone();
    url.hostname = "internhub.pk"; // Redirect to main domain
    url.port = "";
    return NextResponse.redirect(url, 302);
  }

  // Clone response to modify headers
  const response = supabaseResponse;

  // Add tenant information to response headers for client-side access
  // These headers are used by TenantProvider to initialize context
  if (tenantSlug && isKnownTenant) {
    const tenant = DEMO_TENANTS[tenantSlug];
    
    response.headers.set("x-tenant-id", tenant.id);
    response.headers.set("x-tenant-slug", tenant.slug);
    response.headers.set("x-tenant-name", tenant.name);
    response.headers.set("x-tenant-logo", tenant.logo);
    response.headers.set("x-tenant-primary-color", tenant.primaryColor);
    response.headers.set("x-tenant-secondary-color", tenant.secondaryColor);
    response.headers.set("x-tenant-domain", tenant.domain);
    response.headers.set("x-is-tenant", "true");
    
    // Pass features as JSON string
    response.headers.set(
      "x-tenant-features",
      JSON.stringify(tenant.features)
    );
    
    // Pass branding as JSON string
    response.headers.set(
      "x-tenant-branding",
      JSON.stringify(tenant.branding)
    );
  } else {
    // Main platform headers
    response.headers.set("x-tenant-slug", "main");
    response.headers.set("x-tenant-name", "InternHub");
    response.headers.set("x-is-tenant", "false");
  }

  // ============================================================
  // AUTHENTICATION CHECKS
  // ============================================================

  // Refresh session to keep auth state in sync
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes that require authentication
  const protectedPaths = [
    "/dashboard",
    "/super-admin",
    "/university-admin",
    "/department-coordinator",
    "/faculty-supervisor",
    "/student",
    "/company-hr",
    "/site-supervisor",
    "/external-evaluator",
  ];

  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Auth routes that should redirect if already authenticated
  const authPaths = ["/login", "/register"];
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    
    // Preserve tenant context in redirect URL for subdomain scenarios
    if (tenantSlug) {
      url.searchParams.set("tenant", tenantSlug);
    }
    
    return NextResponse.redirect(url);
  }

  if (isAuthPath && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (they handle their own auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/).*)",
  ],
};
