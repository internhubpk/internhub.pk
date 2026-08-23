/**
 * GET /api/auth/handoff?token=<uuid>
 *
 * Consumes a login handoff token and returns the email to prefill on the
 * subdomain's /login page. The token is single-use — once consumed, it's
 * marked used and cannot be replayed.
 *
 * SECURITY:
 *   - The token itself is the secret (128-bit UUID).
 *   - 60-second expiry enforced by the application.
 *   - Returns 404 (not 401) for invalid tokens so attackers can't
 *     distinguish "expired" from "never existed".
 *   - Uses the service role to read/update the row because the subdomain
 *     may not have the user auth'd yet (they're arriving from a redirect).
 *
 * Response:
 *   200: { success: true, data: { email: "user@example.com" } }
 *   404: { success: false, error: "Invalid or expired handoff token" }
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimiter, RATE_LIMITS, extractClientInfo } from "@/lib/api-security";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import type { ApiResponse } from "@/types";

export async function GET(request: NextRequest) {
  try {
    // Rate limit (2026-08-23 audit).
    const { ipAddress: ip } = extractClientInfo(request);
    const rl = rateLimiter.check(`handoff-consume:${ip}`, RATE_LIMITS.authentication);
    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      );
    }

    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing token parameter" },
        { status: 400 }
      );
    }

    // The consume function uses the regular server client (which is
    // RLS-scoped to the user who created the handoff). On the subdomain,
    // the user may not be auth'd yet, so we need to use the service role
    // to read/update the row.
    //
    // However, the existing consumeLoginHandoff uses the regular client.
    // For the subdomain case, we override with a service-role client.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error("[/api/auth/handoff] SUPABASE_SERVICE_ROLE_KEY not set");
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const adminClient = createServiceRoleClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // 1. Fetch the handoff row (service role bypasses RLS)
    const { data: handoff, error } = await adminClient
      .from("login_handoffs")
      .select("token, user_id, email, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (error || !handoff) {
      // 404 — don't leak whether the token existed
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid or expired handoff token" },
        { status: 404 }
      );
    }

    // 2. Check expiry
    if (new Date(handoff.expires_at).getTime() < Date.now()) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid or expired handoff token" },
        { status: 404 }
      );
    }

    // 3. Check if already used
    if (handoff.used_at) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid or expired handoff token" },
        { status: 404 }
      );
    }

    // 4. Atomically mark as used (only succeeds if used_at is still NULL)
    const { error: updateErr } = await adminClient
      .from("login_handoffs")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token)
      .is("used_at", null);

    if (updateErr) {
      // Race condition — someone else just consumed it
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid or expired handoff token" },
        { status: 404 }
      );
    }

    // 5. Return the email for prefill
    return NextResponse.json<ApiResponse<{ email: string }>>({
      success: true,
      data: { email: handoff.email },
    });
  } catch (err) {
    console.error("[/api/auth/handoff] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
