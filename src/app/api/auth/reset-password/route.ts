import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

/**
 * GET /api/auth/reset-password
 * 
 * Handles password reset callback from Supabase email
 */
export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const token_hash = requestUrl.searchParams.get("token_hash");
    const type = requestUrl.searchParams.get("type");
    
    if (token_hash && type === "recovery") {
      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);
      
      // Verify the recovery token
      const { error } = await supabase.auth.verifyOtp({
        type: "recovery",
        token_hash,
      });
      
      if (error) {
        console.error("Password reset verification error:", error.message);
        return NextResponse.redirect(
          new URL(`/forgot-password?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
        );
      }
      
      // Token valid - redirect to reset password page
      return NextResponse.redirect(new URL("/forgot-password?mode=update", requestUrl.origin));
    }
    
    // If no valid params, redirect to forgot password
    return NextResponse.redirect(new URL("/forgot-password", requestUrl.origin));
    
  } catch (error) {
    console.error("Password reset error:", error);
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(new URL("/forgot-password?error=server_error", requestUrl.origin));
  }
}
