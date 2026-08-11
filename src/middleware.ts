/**
 * InternHub Middleware - Server-Side Route Protection
 * 
 * Implements defense-in-depth security:
 * 1. Subdomain-based tenant detection & context propagation
 * 2. Authentication check (is user logged in?)
 * 3. Role-based route authorization (can this role access this route?)
 * 4. Redirect unauthorized users to appropriate pages
 * 
 * This runs on EVERY request before it reaches the page.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isPublicRoute,
  isRoleAllowedForRoute,
  getRoleDashboardPath,
} from "@/lib/route-permissions";
import {
  extractSubdomain,
  isValidTenant,
  DEMO_TENANTS,
} from "@/lib/tenant";

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;
  
  // Skip non-page requests (static files, API routes, _next)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") || // Static files with extensions
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client for auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

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

  // Add tenant information to response headers for client-side access
  if (tenantSlug && isKnownTenant) {
    const tenant = DEMO_TENANTS[tenantSlug];
    
    supabaseResponse.headers.set("x-tenant-id", tenant.id);
    supabaseResponse.headers.set("x-tenant-slug", tenant.slug);
    supabaseResponse.headers.set("x-tenant-name", tenant.name);
    supabaseResponse.headers.set("x-tenant-logo", tenant.logo);
    supabaseResponse.headers.set("x-tenant-primary-color", tenant.primaryColor);
    supabaseResponse.headers.set("x-tenant-secondary-color", tenant.secondaryColor);
    supabaseResponse.headers.set("x-tenant-domain", tenant.domain);
    supabaseResponse.headers.set("x-is-tenant", "true");
    
    // Pass features as JSON string
    supabaseResponse.headers.set(
      "x-tenant-features",
      JSON.stringify(tenant.features)
    );
    
    // Pass branding as JSON string
    supabaseResponse.headers.set(
      "x-tenant-branding",
      JSON.stringify(tenant.branding)
    );
  } else {
    // Main platform headers
    supabaseResponse.headers.set("x-tenant-slug", "main");
    supabaseResponse.headers.set("x-tenant-name", "InternHub");
    supabaseResponse.headers.set("x-is-tenant", "false");
  }

  // ============================================================
  // AUTHENTICATION CHECKS
  // ============================================================

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ==========================================
  // PUBLIC ROUTES - Allow without auth
  // ==========================================
  if (isPublicRoute(pathname)) {
    // If authenticated and trying to access login/register, redirect to dashboard
    if (user && (pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(new URL("/dashboard", origin));
    }
    return supabaseResponse;
  }

  // ==========================================
  // PROTECTED ROUTES - Require Authentication
  // ==========================================
  if (!user) {
    // Not authenticated - redirect to login with return URL
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("returnUrl", pathname);
    
    // Preserve tenant context in redirect URL for subdomain scenarios
    if (tenantSlug) {
      loginUrl.searchParams.set("tenant", tenantSlug);
    }
    
    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated - get their profile/role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, university_id")
    .eq("user_id", user.id)
    .single();

  const userRole = profile?.role as string | null;
  const universityId = profile?.university_id as string | null;

  // ==========================================
  // ROLE-BASED ROUTE AUTHORIZATION
  // ==========================================
  if (!isRoleAllowedForRoute(userRole as any, pathname)) {
    // User doesn't have permission for this route
    
    // If they have a valid role, redirect to their dashboard
    if (userRole) {
      const dashboardPath = getRoleDashboardPath(userRole as any);
      
      // Don't redirect if already on their dashboard (avoid loops)
      if (pathname !== dashboardPath) {
        // Add forbidden flag to show access denied message
        const forbiddenUrl = new URL(dashboardPath, origin);
        forbiddenUrl.searchParams.set("forbidden", "true");
        forbiddenUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(forbiddenUrl);
      }
    }
    
    // Fallback: redirect to generic dashboard
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  // ==========================================
  // TENANT CONTEXT PROPAGATION (for server components)
  // ==========================================
  // Add user's university_id to headers for downstream use in server components/API routes
  if (universityId) {
    supabaseResponse.headers.set("x-user-university-id", universityId);
  }
  if (userRole) {
    supabaseResponse.headers.set("x-user-role", userRole);
  }

  // ==========================================
  // ALL CHECKS PASSED - Allow request
  // ==========================================
  return supabaseResponse;
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
