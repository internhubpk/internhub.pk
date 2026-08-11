/**
 * InternHub Middleware - Server-Side Route Protection
 * 
 * Implements defense-in-depth security:
 * 1. Authentication check (is user logged in?)
 * 2. Role-based route authorization (can this role access this route?)
 * 3. Redirect unauthorized users to appropriate pages
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
    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated - get their profile/role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const userRole = profile?.role as string | null;

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
