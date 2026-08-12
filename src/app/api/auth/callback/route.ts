import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

/**
 * GET /api/auth/callback
 * 
 * Handles Supabase auth callback (OAuth, email confirmation, etc.)
 * Redirects to dashboard after successful authentication
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
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error("Auth callback error:", error.message);
        // Redirect to login with error
        return NextResponse.redirect(new URL("/login?error=auth_callback_failed", requestUrl.origin));
      }
    }
    
    // Get redirect URL from query params or default to dashboard
    const redirectTo = requestUrl.searchParams.get("redirect_to") || "/dashboard";
    
    // Redirect to dashboard after successful auth
    return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
    
  } catch (error) {
    console.error("Auth callback error:", error);
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(new URL("/login?error=server_error", requestUrl.origin));
  }
}
