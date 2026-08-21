/**
 * POST /api/auth/handoff/create
 *
 * Creates a new short-lived login handoff token for the currently
 * authenticated user. Called by the apex /login page AFTER a successful
 * sign-in, BEFORE redirecting to the subdomain.
 *
 * Request body: { email: string }
 * Response: { success: true, data: { token: "<uuid>" } }
 *
 * SECURITY:
 *   - Caller must be authenticated (auth.uid() must be set).
 *   - The token is created with user_id = auth.uid() (RLS-enforced on insert).
 *   - The token is single-use and expires in 60s.
 *   - The token only stores the email (which is already public-ish) —
 *     NEVER the password.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createLoginHandoff } from "@/lib/login-handoff";
import type { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = body.email;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing or invalid email" },
        { status: 400 }
      );
    }

    const token = await createLoginHandoff(user.id, email);
    if (!token) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to create handoff token" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<{ token: string }>>({
      success: true,
      data: { token },
    });
  } catch (err) {
    console.error("[/api/auth/handoff/create POST] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
