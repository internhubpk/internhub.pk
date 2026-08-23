import { NextRequest, NextResponse } from "next/server";
import { rateLimiter, RATE_LIMITS, extractClientInfo } from "@/lib/api-security";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

/**
 * GET /api/auth/reset-password
 * 
 * Handles password reset callback from Supabase email
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit (2026-08-23 audit).
    const { ipAddress: ip } = extractClientInfo(request);
    const rl = rateLimiter.check(`reset-password:${ip}`, RATE_LIMITS.authentication);
    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      );
    }

    const requestUrl = new URL(request.url);
    const token_hash = requestUrl.searchParams.get("token_hash");
    const type = requestUrl.searchParams.get("type");
    
    if (token_hash && type === "recovery") {
      const cookieStore = await cookies();
      const supabase = await createClient(cookieStore);
      if (!supabase) {
        return Response.json({ success: false, error: "Server unavailable" }, { status: 500 });
      }
      
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
      return NextResponse.redirect(new URL("/reset-password", requestUrl.origin));
    }
    
    // If no valid params, redirect to forgot password
    return NextResponse.redirect(new URL("/forgot-password", requestUrl.origin));
    
  } catch (error) {
    console.error("Password reset error:", error);
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(new URL("/forgot-password?error=server_error", requestUrl.origin));
  }
}
