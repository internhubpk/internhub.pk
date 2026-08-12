/**
 * InternHub Proxy - Next.js 16 Proxy Pattern
 * 
 * Replaces deprecated middleware.ts with proxy.ts
 * Uses JWT metadata only - NO database calls (prevents RLS 403 errors)
 * Minimal and memory-efficient
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ============================================================
// CONFIGURATION
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
  "/auth/callback",
  "/auth/confirm",
  "/privacy",
  "/terms",
  "/support",
  "/help",
  "/universities",
  "/companies",
  "/internships",
  "/marketplace",
  "/onboarding",
  "/dashboard",
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
// HELPERS
// ============================================================

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route + "/"));
}

function getAllowedRoles(pathname: string): UserRole[] | null {
  const segments = pathname.split("/").filter(Boolean);
  
  for (let i = segments.length; i > 0; i--) {
    const partialPath = "/" + segments.slice(0, i).join("/");
    if (ROUTE_ROLES[partialPath]) return ROUTE_ROLES[partialPath];
  }
  
  return null;
}

function isRoleAllowed(role: UserRole | null, pathname: string): boolean {
  if (!role) return false;
  const allowed = getAllowedRoles(pathname);
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(role);
}

function getDashboardPath(role: UserRole | null): string {
  if (!role) return "/dashboard";
  return ROLE_DASHBOARDS[role] || "/dashboard";
}

/**
 * Get role from JWT metadata ONLY - NO DATABASE CALLS!
 * This prevents RLS errors and memory issues.
 */
function getRoleFromUser(user: any): UserRole | null {
  // Check user_metadata first (set during registration)
  const metaRole = user?.user_metadata?.role;
  if (metaRole && ROLE_DASHBOARDS[metaRole as UserRole]) {
    return metaRole as UserRole;
  }
  
  // Check app_metadata (set by triggers or admin operations)
  const appRole = user?.app_metadata?.role;
  if (appRole && ROLE_DASHBOARDS[appRole as UserRole]) {
    return appRole as UserRole;
  }
  
  return null;
}

// ============================================================
// MAIN PROXY FUNCTION (Next.js 16 Pattern)
// ============================================================

export async function proxy(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;
  
  // Skip non-page requests (static files, API routes, _next)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_vercel") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico" ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    // Create Supabase client for auth check (JWT only, no DB queries)
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
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Get user from auth token (JWT verification only - NO DB call)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // ==========================================
    // PUBLIC ROUTES - Allow without auth
    // ==========================================
    if (isPublicRoute(pathname)) {
      // Redirect authenticated users away from login/register
      if (user && !authError && (pathname === "/login" || pathname === "/register")) {
        return NextResponse.redirect(new URL("/dashboard", origin));
      }
      
      // Set user info in headers for client components
      if (user) {
        const userRole = getRoleFromUser(user);
        if (userRole) {
          response.headers.set("x-user-role", userRole);
        }
        response.headers.set("x-user-id", user.id);
      }
      
      return response;
    }

    // ==========================================
    // PROTECTED ROUTES - Require Authentication
    // ==========================================
    if (!user || authError) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("returnUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // ==========================================
    // GET ROLE FROM JWT METADATA ONLY (NO DB!)
    // ==========================================
    let userRole = getRoleFromUser(user);

    // Set headers for client components
    if (userRole) {
      response.headers.set("x-user-role", userRole);
      response.headers.set("x-user-id", user.id);
    }

    // ==========================================
    // REDIRECT TO ONBOARDING IF NO ROLE IN METADATA
    // ==========================================
    if (!userRole) {
      const safePaths = ["/dashboard", "/onboarding", "/login"];
      if (!safePaths.some(p => pathname === p || pathname.startsWith(p + "/"))) {
        return NextResponse.redirect(new URL("/onboarding", origin));
      }
      response.headers.set("x-user-role", "unknown");
      return response;
    }

    // ==========================================
    // ROLE-BASED ROUTE AUTHORIZATION
    // ==========================================
    if (!isRoleAllowed(userRole, pathname)) {
      const dashboardPath = getDashboardPath(userRole);
      
      if (pathname !== dashboardPath) {
        const forbiddenUrl = new URL(dashboardPath, origin);
        forbiddenUrl.searchParams.set("forbidden", "true");
        forbiddenUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(forbiddenUrl);
      }
    }

  } catch (error) {
    // Log error but don't crash - continue without proxy protection
    console.error("[Proxy Error]:", error instanceof Error ? error.message : error);
    
    // In production, you might want to redirect to an error page
    // For now, just continue to allow the request through
  }

  return response;
}

// ============================================================
// PROXY CONFIGURATION (Next.js 16)
// ============================================================
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
