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

// ============================================================
// INLINE CONFIGURATION (avoids import issues in Edge Runtime)
// ============================================================

type UserRole = 
  | "super_admin"
  | "university_admin" 
  | "department_coordinator"
  | "faculty_supervisor"
  | "student"
  | "company_hr"
  | "site_supervisor"
  | "external_evaluator";

/** Public routes that don't require authentication */
const PUBLIC_ROUTES: string[] = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/auth",
  "/privacy",
  "/terms",
  "/support",
  "/help",
  "/universities",
  "/companies",
  "/internships",
  "/marketplace",
  "/onboarding",
];

/** Role-based route access matrix */
const ROUTE_ROLES: Record<string, UserRole[]> = {
  "/super-admin": ["super_admin"],
  "/university-admin": ["university_admin"],
  "/department-coordinator": ["department_coordinator"],
  "/faculty-supervisor": ["faculty_supervisor"],
  "/student": ["student"],
  "/company-hr": ["company_hr"],
  "/site-supervisor": ["site_supervisor"],
  "/external-evaluator": ["external_evaluator"],
};

/** Dashboard paths for each role */
const ROLE_DASHBOARDS: Record<UserRole, string> = {
  super_admin: "/super-admin",
  university_admin: "/university-admin",
  department_coordinator: "/department-coordinator",
  faculty_supervisor: "/faculty-supervisor",
  student: "/student",
  company_hr: "/company-hr",
  site_supervisor: "/site-supervisor",
  external_evaluator: "/external-evaluator",
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route + "/"));
}

function getAllowedRoles(pathname: string): UserRole[] | null {
  const segments = pathname.split("/").filter(Boolean);
  
  // Try progressive path matching (most specific first)
  for (let i = segments.length; i > 0; i--) {
    const partialPath = "/" + segments.slice(0, i).join("/");
    if (ROUTE_ROLES[partialPath]) return ROUTE_ROLES[partialPath];
  }
  
  return null; // No restriction = public
}

function isRoleAllowed(role: UserRole | null, pathname: string): boolean {
  if (!role) return false;
  const allowed = getAllowedRoles(pathname);
  if (!allowed || allowed.length === 0) return true; // Public route
  return allowed.includes(role);
}

function getDashboardPath(role: UserRole | null): string {
  if (!role) return "/dashboard";
  return ROLE_DASHBOARDS[role] || "/dashboard";
}

/** Extract subdomain from hostname */
function extractSubdomain(hostname: string): string | null {
  const hostWithoutPort = hostname.split(":")[0];
  
  if (hostWithoutPort === "localhost" || hostWithoutPort === "127.0.0.1") {
    return null;
  }

  const parts = hostWithoutPort.split(".");
  if (parts.length < 3) return null;

  const subdomain = parts[0];
  const reservedSubdomains = ["www", "app", "admin", "api", "mail", "cdn", "static"];
  if (reservedSubdomains.includes(subdomain)) return null;

  return subdomain;
}

// ============================================================
// MAIN MIDDLEWARE FUNCTION
// ============================================================

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;
  
  // Skip non-page requests (static files, API routes, _next)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Verify required environment variables exist
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("Middleware Error: Missing Supabase environment variables");
    // In development, allow through; in production, this is a critical error
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Server configuration error", { status: 500 });
    }
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
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
    // TENANT DETECTION FROM SUBDOMAIN (lightweight, no DB calls)
    // ============================================================
    
    const hostname = request.headers.get("host") || "";
    const tenantSlug = extractSubdomain(hostname);
    
    // Add basic tenant headers (full config comes from client-side provider)
    if (tenantSlug) {
      supabaseResponse.headers.set("x-tenant-slug", tenantSlug);
      supabaseResponse.headers.set("x-is-tenant", "true");
    } else {
      supabaseResponse.headers.set("x-tenant-slug", "main");
      supabaseResponse.headers.set("x-is-tenant", "false");
    }

    // ============================================================
    // AUTHENTICATION CHECKS
    // ============================================================

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Handle auth errors gracefully
    if (authError) {
      console.error("Middleware Auth Error:", authError.message);
      // If we can't verify auth, treat as unauthenticated for protected routes
    }

    // ==========================================
    // PUBLIC ROUTES - Allow without auth
    // ==========================================
    if (isPublicRoute(pathname)) {
      // If authenticated and trying to access login/register, redirect to dashboard
      if (user && !authError && (pathname === "/login" || pathname === "/register")) {
        return NextResponse.redirect(new URL("/dashboard", origin));
      }
      return supabaseResponse;
    }

    // ==========================================
    // PROTECTED ROUTES - Require Authentication
    // ==========================================
    if (!user || authError) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("returnUrl", pathname);
      if (tenantSlug) {
        loginUrl.searchParams.set("tenant", tenantSlug);
      }
      return NextResponse.redirect(loginUrl);
    }

    // User is authenticated - get their profile/role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, university_id")
      .eq("user_id", user.id)
      .single();

    // Handle profile fetch errors
    if (profileError) {
      console.error("Middleware Profile Error:", profileError.message, "for user:", user.id);
      // If we can't get the profile, redirect to dashboard which will handle it
      return NextResponse.redirect(new URL("/dashboard", origin));
    }

    const userRole = profile?.role as UserRole | null;
    const universityId = profile?.university_id as string | null;

    // ==========================================
    // ROLE-BASED ROUTE AUTHORIZATION
    // ==========================================
    if (!isRoleAllowed(userRole, pathname)) {
      if (userRole) {
        const dashboardPath = getDashboardPath(userRole);
        
        if (pathname !== dashboardPath) {
          const forbiddenUrl = new URL(dashboardPath, origin);
          forbiddenUrl.searchParams.set("forbidden", "true");
          forbiddenUrl.searchParams.set("from", pathname);
          return NextResponse.redirect(forbiddenUrl);
        }
      }
      
      return NextResponse.redirect(new URL("/dashboard", origin));
    }

    // ==========================================
    // TENANT CONTEXT PROPAGATION
    // ==========================================
    if (universityId) {
      supabaseResponse.headers.set("x-user-university-id", universityId);
    }
    if (userRole) {
      supabaseResponse.headers.set("x-user-role", userRole);
    }

  } catch (error) {
    // Catch any unexpected errors to prevent 500 crashes
    console.error("Middleware Unexpected Error:", error);
    // Try to continue without middleware protection rather than crashing
    return supabaseResponse;
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
