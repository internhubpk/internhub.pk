import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// Tenant-scoped roles that require university subdomain redirect
const TENANT_SCOPED_ROLES = new Set([
  "university_admin",
  "department_coordinator",
  "program_coordinator",
  "faculty_supervisor",
  "student",
]);

/**
 * GET /api/auth/callback
 * 
 * Handles Supabase auth callback (OAuth, email confirmation, etc.)
 * 
 * CRITICAL: After successful auth, checks if user is a tenant-scoped role
 * (university admin, student, faculty, etc.) and redirects them to their
 * university's subdomain instead of the apex domain.
 */
export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    
    if (code) {
      const cookieStore = await cookies();
      const supabase = await createClient(cookieStore);
      if (!supabase) {
        return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
      }
      
      // Exchange auth code for session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error("Auth callback error:", error.message);
        // Redirect to login with error
        return NextResponse.redirect(new URL("/login?error=auth_callback_failed", requestUrl.origin));
      }

      // ================================================================
      // TENANT-AWARE REDIRECT FOR UNIVERSITY ACCOUNTS
      // ================================================================
      // University admins, students, faculty, coordinators MUST be
      // redirected to their university's subdomain (e.g., iiui.careerstep.tech)
      // NOT the apex domain (careerstep.tech)
      
      if (data?.user) {
        const userRole = 
          (data.user.app_metadata?.role as string | undefined) ||
          (data.user.user_metadata?.role as string | undefined) ||
          null;
        
        let userTenantSlug = 
          (data.user.app_metadata?.tenant_slug as string | undefined) ||
          (data.user.user_metadata?.tenant_slug as string | undefined) ||
          null;
        
        let userTenantDomain = 
          (data.user.app_metadata?.tenant_domain as string | undefined) ||
          (data.user.user_metadata?.tenant_domain as string | undefined) ||
          null;

        // If metadata missing but user is tenant-scoped, look up from DB
        if ((!userTenantSlug || !userTenantDomain) && userRole && TENANT_SCOPED_ROLES.has(userRole)) {
          try {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("university_id, universities!inner(slug, domain)")
              .eq("user_id", data.user.id)
              .maybeSingle();
            
            if (profileData?.universities) {
              const uni = profileData.universities as { slug?: string; domain?: string };
              if (uni.slug) userTenantSlug = uni.slug;
              if (uni.domain) userTenantDomain = uni.domain;
            }
          } catch (e) {
            console.warn("[auth/callback] DB lookup failed:", e);
          }
        }

        // If we have a tenant-scoped user with tenant info, redirect to their portal
        if (
          userRole && 
          TENANT_SCOPED_ROLES.has(userRole) && 
          userTenantSlug &&
          userTenantDomain
        ) {
          console.log(`[auth/callback] Redirecting ${userRole} to tenant: ${userTenantSlug} (${userTenantDomain})`);
          
          // Build the target URL - go directly to dashboard on tenant domain
          const redirectTo = requestUrl.searchParams.get("redirect_to") || "/dashboard";
          const targetUrl = `https://${userTenantDomain}${redirectTo}`;
          
          return NextResponse.redirect(targetUrl);
        }
      }
    }
    
    // Get redirect URL from query params or default to dashboard
    const redirectTo = requestUrl.searchParams.get("redirect_to") || "/dashboard";
    
    // Redirect to dashboard after successful auth (non-tenant users or fallback)
    return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
    
  } catch (error) {
    console.error("Auth callback error:", error);
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(new URL("/login?error=server_error", requestUrl.origin));
  }
}
