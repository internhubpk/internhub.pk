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
  | "external_evaluator"
  | "program_coordinator";

/** Public routes that don't require authentication.
 *
 * NOTE on `/verify`:
 *   The certificate verification page (`/verify/[code]`) MUST be public.
 *   Employers, LinkedIn's verification bot, and anyone a student shares
 *   the verification URL with will land here without an InternHub
 *   session. If we don't list `/verify` here, the proxy will redirect
 *   them to `/login?returnUrl=/verify/<code>` — which breaks public
 *   verification entirely (the user never sees the verification result,
 *   they see a login wall) and exposes Vercel deployment URLs in the
 *   redirect chain. This was the root cause of the
 *   `https://internhub-...vercel.app/login?returnUrl=%2Fverify%2F...`
 *   bug reported in the certificate verification audit.
 */
const PUBLIC_ROUTES: string[] = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/auth/callback",
  "/auth/confirm",
  "/verify",
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
  "/program-coordinator": ["program_coordinator"],
  "/faculty-supervisor": ["faculty_supervisor"],
  "/student": ["student"],
  "/company-hr": ["company_hr"],
  // external_evaluator shares the site-supervisor UI/API surface —
  // see src/lib/supervisor-role.ts and src/lib/route-permissions.ts.
  "/site-supervisor": ["site_supervisor", "external_evaluator"],
  "/external-evaluator": ["external_evaluator"],
};

/** Dashboard paths for each role */
const ROLE_DASHBOARDS: Record<UserRole, string> = {
  super_admin: "/super-admin",
  university_admin: "/university-admin",
  department_coordinator: "/department-coordinator",
  program_coordinator: "/program-coordinator",
  faculty_supervisor: "/faculty-supervisor",
  student: "/student",
  company_hr: "/company-hr",
  site_supervisor: "/site-supervisor",
  external_evaluator: "/external-evaluator",
};

/**
 * Roles that are scoped to a university tenant and therefore subject to
 * tenant-subdomain redirection. Company-scoped roles (company_hr,
 * site_supervisor, external_evaluator) and cross-tenant roles (super_admin)
 * are NOT redirected — they can sign in on any subdomain or the apex.
 */
const TENANT_SCOPED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  "university_admin",
  "department_coordinator",
  "program_coordinator",
  "faculty_supervisor",
  "student",
]);

/**
 * Subdomain labels reserved for infrastructure / common use. Mirrors the
 * list in src/lib/tenant.ts — kept in sync deliberately rather than
 * imported because proxy.ts runs in the Edge runtime and we want zero
 * module-level side effects from the tenant lib.
 */
const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set<string>([
  "www", "app", "admin", "api", "mail", "cdn", "static",
  "auth", "docs", "blog", "support", "help", "status",
  "assets", "media", "staging", "dev", "test", "preview", "demo",
]);

/**
 * Infrastructure / hosting domains where the leftmost label is a deployment
 * name, not a tenant slug. Mirrors src/lib/tenant.ts.
 */
const INFRA_DOMAINS: ReadonlySet<string> = new Set<string>([
  "vercel.app", "vercel.dev", "netlify.app", "netlify.com",
  "cloudflarepages.dev", "pages.dev", "onrender.com", "railway.app",
  "fly.dev", "herokuapp.com", "firebaseapp.com", "web.app",
  "azurewebsites.net", "amazonaws.com",
]);

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
 *
 * SECURITY: app_metadata ONLY.
 *   - app_metadata is system-managed: our profiles_sync_auth_metadata trigger
 *     (migration 0011/0013/0038) keeps auth.users.raw_app_meta_data->>'role'
 *     in lockstep with profiles.role. When an admin changes someone's role
 *     in the DB, app_metadata is updated automatically.
 *   - user_metadata is USER-WRITABLE via PUT /auth/v1/user
 *     (auth.updateUser). It must NEVER be trusted for authorization:
 *     production testing (2026-08-23 audit) proved an attacker could set
 *     user_metadata.role='super_admin' and, on accounts whose
 *     app_metadata.role was null, obtain full super_admin access. The
 *     user_metadata fallback was removed everywhere (migration 0084).
 */
function getRoleFromUser(user: any): UserRole | null {
  const appRole = user?.app_metadata?.app_role ?? user?.app_metadata?.role;
  if (appRole && ROLE_DASHBOARDS[appRole as UserRole]) {
    return appRole as UserRole;
  }

  return null;
}

/**
 * Get the user's tenant slug from JWT metadata (NO DB CALLS).
 * SECURITY: app_metadata only — user_metadata is user-writable and must
 * never influence tenant routing (migration 0084).
 */
function getTenantSlugFromUser(user: any): string | null {
  const appSlug = user?.app_metadata?.tenant_slug;
  if (typeof appSlug === "string" && appSlug.length > 0) {
    return appSlug;
  }
  return null;
}

/**
 * Extract tenant_domain (e.g. "myu.careerstep.tech") from the JWT app_metadata.
 * SECURITY: app_metadata only — user_metadata is user-writable (migration 0084).
 */
function getTenantDomainFromUser(user: any): string | null {
  const appDomain = user?.app_metadata?.tenant_domain;
  if (typeof appDomain === "string" && appDomain.length > 0) {
    return appDomain;
  }
  return null;
}

/**
 * Extract the current subdomain from the request hostname — DOMAIN-AGNOSTIC.
 * Mirrors src/lib/tenant.ts::extractSubdomain. Returns null for apex
 * domains, reserved subdomains, infrastructure domains, and localhost.
 *
 * The proxy duplicates this logic rather than importing from tenant.ts
 * because the proxy runs in the Edge runtime and we want to keep its
 * module graph minimal. The two implementations are kept in sync by tests.
 */
function getCurrentSubdomain(hostname: string): string | null {
  const hostWithoutPort = hostname.split(":")[0];

  if (hostWithoutPort === "localhost" || hostWithoutPort === "127.0.0.1") {
    return null;
  }

  // Infrastructure / hosting domains: leftmost label is a deployment name.
  if (INFRA_DOMAINS.has(hostWithoutPort)) return null;
  for (const d of INFRA_DOMAINS) {
    if (hostWithoutPort.endsWith(`.${d}`)) return null;
  }

  const parts = hostWithoutPort.split(".");
  if (parts.length < 3) return null;

  const subdomain = parts[0];
  if (RESERVED_SUBDOMAINS.has(subdomain)) return null;

  // Slug-shape sanity check.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(subdomain)) return null;

  return subdomain;
}

/**
 * Build the URL for a tenant subdomain on the SAME apex domain the user is
 * currently visiting. Domain-agnostic — works on internhub.pk,
 * internship-portal.com, or any future apex domain the platform deploys to.
 *
 * Example:
 *   currentUrl = https://internhub.pk/login
 *   tenantSlug = "iiui"
 *   →  https://iiui.internhub.pk/login
 *
 *   currentUrl = https://example.com/dashboard
 *   tenantSlug = "nust"
 *   →  https://nust.example.com/dashboard
 *
 * Port is preserved for local dev (e.g. localhost:3000 → iiui.localhost:3000).
 * Search params are preserved so returnUrl etc. survive the redirect.
 */
function buildTenantRedirectUrl(
  request: NextRequest,
  tenantSlug: string,
  tenantDomain?: string | null
): URL {
  const { hostname, port, pathname, search, protocol } = request.nextUrl;
  const hostWithoutPort = hostname.split(":")[0];

  // Determine the target hostname. Priority:
  //   1. tenantDomain (from JWT app_metadata, e.g. "myu.careerstep.tech") —
  //      always correct, hosting-agnostic. Set by migration 0038.
  //   2. <tenantSlug>.<apex> — only when the current hostname is NOT on
  //      an infra domain (vercel.app etc.). On infra domains the leftmost
  //      label is a deployment name, not a tenant, so `<slug>.<apex>`
  //      would produce a non-existent hostname (e.g. `myu.vercel.app`)
  //      and 404.
  let newHostname: string;
  if (tenantDomain) {
    newHostname = tenantDomain;
  } else {
    // Check infra domain — if so, we can't safely construct a target.
    // Fall back to <slug>.<apex> anyway (best effort) — this branch only
    // runs for legacy JWTs without tenant_domain, which the 0038 backfill
    // has already populated for all current users.
    const parts = hostWithoutPort.split(".");
    const apex = parts.length >= 3 ? parts.slice(1).join(".") : hostWithoutPort;
    newHostname = `${tenantSlug}.${apex}`;
  }
  const newHost = port ? `${newHostname}:${port}` : newHostname;

  const redirectUrl = new URL(`${protocol}//${newHost}${pathname}${search}`);
  return redirectUrl;
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

    // ==========================================
    // FORCE-REFRESH COOKIE (set by role-mutating API routes)
    // ==========================================
    // BUG 5 FIX: getUser() validates the JWT signature and exp claim but
    // does NOT refresh the session when the access token is still valid
    // but stale (i.e. the user's app_metadata.role was changed server-side
    // by an admin after this JWT was issued). The user would keep seeing
    // their old role until the JWT naturally expires (default 1 hour).
    //
    // Fix: role-mutating API routes (coordinators/[id], supervisors,
    // super-admin/update-admin-account, admin/create-user) set a cookie
    // `internhub_force_refresh=1` on their response. The next navigation
    // request carries that cookie; when the proxy sees it, it forces
    // refreshSession() which picks up the new app_metadata. The proxy
    // then clears the cookie so it only fires once.
    const forceRefreshCookie = request.cookies.get("internhub_force_refresh");
    const forceRefresh = forceRefreshCookie?.value === "1";
    if (forceRefresh) {
      response.cookies.delete("internhub_force_refresh");
    }

    let { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (forceRefresh && session?.refresh_token) {
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession({
          refresh_token: session.refresh_token,
        });
      if (!refreshError && refreshData.session) {
        session = refreshData.session;
      }
    }

    const user = session?.user ?? null;
    const authError = sessionError;

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
    // GET ROLE + TENANT FROM JWT METADATA ONLY (NO DB!)
    // ==========================================
    let userRole = getRoleFromUser(user);
    const userTenantSlug = getTenantSlugFromUser(user);
    const userTenantDomain = getTenantDomainFromUser(user);

    // Set headers for client components
    if (userRole) {
      response.headers.set("x-user-role", userRole);
      response.headers.set("x-user-id", user.id);
    }
    if (userTenantSlug) {
      response.headers.set("x-tenant-slug", userTenantSlug);
    }
    if (userTenantDomain) {
      response.headers.set("x-tenant-domain", userTenantDomain);
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
    // TENANT-SUBDOMAIN REDIRECTION (domain-agnostic, session-preserving)
    // ==========================================
    // University-scoped users (admin / coordinator / supervisor / student)
    // are redirected to their own tenant subdomain if they're not already
    // on it. This keeps each university's users on their own subdomain so
    // the landing page renders their branding, RLS context matches, and
    // bookmarked URLs don't accidentally cross tenants.
    //
    // SESSION-PRESERVING (production fix for React #310 + forced re-login):
    //   The auth cookie is now scoped to `Domain=.<apex>` (see
    //   src/utils/supabase/client.ts::buildCookieAttributes), so it is
    //   shared across ALL subdomains of the apex. When we redirect a user
    //   from the apex (or the wrong tenant subdomain) to their correct
    //   tenant subdomain, their session CARRIES OVER — no re-login needed.
    //   The previous implementation wiped cookies on cross-tenant redirect,
    //   which (combined with the host-only cookie bug) forced a re-login
    //   on every subdomain switch and triggered an auth state storm that
    //   destabilized React's hook dispatcher → React error #310.
    //
    // Conditions for redirect:
    //   1. Role is tenant-scoped (see TENANT_SCOPED_ROLES).
    //   2. User has a tenant_slug in app_metadata (set by migration 0038).
    //   3. Current hostname's subdomain != user's tenant_slug.
    //
    // Skipped for:
    //   - super_admin (cross-tenant, can sign in anywhere)
    //   - company_hr / site_supervisor / external_evaluator (company-scoped,
    //     not university-scoped — they may legitimately use the apex domain)
    //   - Users without a tenant_slug in their JWT (e.g. legacy JWTs issued
    //     before migration 0038 was applied; they'll get the slug after
    //     their next login post-migration)
    //   - requests already on the correct subdomain (no-op)
    //   - infrastructure domains (vercel.app previews etc.) — the redirect
    //     would loop because the deployment name isn't a real subdomain
    if (TENANT_SCOPED_ROLES.has(userRole) && userTenantSlug) {
      // Use the Host header (set by the browser) instead of nextUrl.hostname,
      // because Next.js dev/start server normalizes nextUrl.hostname to
      // "localhost" even when the browser requested a different host (e.g.
      // myu.careerstep.tech:3000 via /etc/hosts or curl --resolve). In production
      // behind a proper reverse proxy, both would be the same.
      const hostHeader = request.headers.get("host") || request.nextUrl.hostname;
      const currentSubdomain = getCurrentSubdomain(hostHeader);
      if (currentSubdomain !== userTenantSlug) {
        // Redirect to the correct tenant subdomain, preserving the
        // pathname + search params so the user lands on their original
        // destination. The auth cookie carries over automatically because
        // it's scoped to `Domain=.<apex>`.
        //
        // We do NOT wipe cookies here. The previous "cross-tenant block"
        // logic (signing the user out on wrong-tenant redirect) was
        // defense-in-depth against cookie leakage, but with Domain-scoped
        // cookies the session is intentionally shared — wiping it would
        // force a re-login on every subdomain switch, which is the
        // exact bug we're fixing.
        //
        // True cross-tenant attacks (a user from university A trying to
        // access university B's data) are still prevented by RLS at the
        // database layer: every query is scoped to the authenticated
        // user's university_id, which is set in their JWT app_metadata
        // by the profiles_sync_auth_metadata trigger (migration 0011/0038).
        // The proxy redirect here is a UX/branding concern, not a
        // security boundary.
        const redirectUrl = buildTenantRedirectUrl(request, userTenantSlug, userTenantDomain);
        return NextResponse.redirect(redirectUrl);
      }
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
