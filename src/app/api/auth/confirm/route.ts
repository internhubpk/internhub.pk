import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

/**
 * GET /api/auth/confirm
 * 
 * Handles email confirmation redirect from Supabase
 * Verifies token and redirects to role-based dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const token_hash = requestUrl.searchParams.get("token_hash");
    const type = requestUrl.searchParams.get("type");
    const next = requestUrl.searchParams.get("next") || "/dashboard";
    
    if (token_hash && type === "email") {
      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);
      
      // Verify the token hash and confirm email
      const { error, data } = await supabase.auth.verifyOtp({
        type: "email",
        token_hash,
      });
      
      if (error) {
        console.error("Email confirmation error:", error.message);
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
        );
      }
      
      // Email confirmed successfully - user is now logged in
      // Try to get their profile to determine correct dashboard
      if (data?.user) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", data.user.id)
            .single();
          
          // Role-based dashboard paths
          const rolePaths: Record<string, string> = {
            super_admin: "/super-admin",
            university_admin: "/university-admin",
            department_coordinator: "/department-coordinator",
            faculty_supervisor: "/faculty-supervisor",
            student: "/student",
            company_hr: "/company-hr",
            site_supervisor: "/site-supervisor",
            external_evaluator: "/external-evaluator",
          };
          
          // If we found a role, redirect to specific dashboard
          if (profile?.role && rolePaths[profile.role]) {
            return NextResponse.redirect(new URL(rolePaths[profile.role], requestUrl.origin));
          }
          
          // No profile or no role - go to default student dashboard
          return NextResponse.redirect(new URL("/student", requestUrl.origin));
        } catch (profileError) {
          // Profile fetch failed - still log them in, go to default
          console.log("Profile fetch failed after confirmation, using default:", profileError);
          return NextResponse.redirect(new URL("/student", requestUrl.origin));
        }
      }
      
      // Fallback to next param or /dashboard which will handle routing
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
    
    // If no valid params, just redirect to login
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
    
  } catch (error) {
    console.error("Email confirmation error:", error);
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(new URL("/login?error=confirmation_failed", requestUrl.origin));
  }
}
