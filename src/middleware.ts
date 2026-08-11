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
 * 
 * CRITICAL: Does NOT depend on profiles table for basic routing.
 * Uses user_metadata.role which is available immediately after auth.
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
  "/dashboard",  // Dashboard is a redirector - let it pass through
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

/**
 * Extract role from user object WITHOUT database call
 * Checks user_metadata first (set during registration), then app_metadata
 */
function getRoleFromUser(user: any): UserRole | null {
  // Priority 1: user_metadata (set when creating user via admin API or metadata)
  const metaRole = user?.user_metadata?.role;
  if (metaRole && ROLE_DASHBOARDS[metaRole as UserRole]) {
    return metaRole as UserRole;
  }
  
  // Priority 2: app_metadata (set by triggers or admin operations)
  const appRole = user?.app_metadata?.role;
  if (appRole && ROLE_DASHBOARDS[appRole as UserRole]) {
    return appRole as UserRole;
  }
  
  return null;
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

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    // Create Supabase client for auth check
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

    // ==========================================
    // GET ROLE FROM USER METADATA (NO DB CALL!)
    // ==========================================
    // This is the KEY FIX: Get role from JWT metadata, not from profiles table
    // This works immediately after auth and doesn't trigger RLS issues
    let userRole = getRoleFromUser(user);

    // ONLY try profiles table if we don't have role in metadata
    // AND we need it for route authorization
    if (!userRole) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, university_id")
          .eq("user_id", user.id)
          .single();

        if (!profileError && profile?.role) {
          userRole = profile.role as UserRole;
          // Set university ID if we got it
          if (profile.university_id) {
            supabaseResponse.headers.set("x-user-university-id", profile.university_id);
          }
        }
        // If profile fetch fails, we continue WITHOUT role - will use fallback below
        // This prevents 403 errors from causing redirect loops!
      } catch (profileErr) {
        // Profiles table error - continue without profile data
        console.log("Middleware: Profile fetch failed, continuing without role:", 
          profileErr instanceof Error ? profileErr.message : profileErr);
      }
    }

    // ==========================================
    // ROLE-BASED ROUTE AUTHORIZATION
    // ==========================================
    
    // If we have a role and it's not allowed for this route, redirect to their dashboard
    if (userRole && !isRoleAllowed(userRole, pathname)) {
      const dashboardPath = getDashboardPath(userRole);
      
      if (pathname !== dashboardPath) {
        const forbiddenUrl = new URL(dashboardPath, origin);
        forbiddenUrl.searchParams.set("forbidden", "true");
        forbiddenUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(forbiddenUrl);
      }
    }
    
    // If we DON'T have a role at all (no metadata, no profile access), 
    // still allow access to default student dashboard rather than looping
    // The client-side code can handle showing proper UI based on what it can fetch
    if (!userRole) {
      // Only redirect if they're not already going to a safe default page
      const safePaths = ["/student", "/dashboard", "/onboarding"];
      if (!safePaths.some(p => pathname === p || pathname.startsWith(p + "/"))) {
        return NextResponse.redirect(new URL("/student", origin));
      }
      // Set a default role for header propagation
      userRole = "student";
    }

    // ==========================================
    // TENANT CONTEXT PROPAGATION
    // ==========================================
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
