import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

/**
 * GET /api/auth/confirm
 * 
 * Handles email confirmation redirect from Supabase
 * This fixes the localhost → Vercel redirect issue
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
      const { error } = await supabase.auth.verifyOtp({
        type: "email",
        token_hash,
      });
      
      if (error) {
        console.error("Email confirmation error:", error.message);
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
        );
      }
      
      // Email confirmed successfully - redirect to dashboard
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
