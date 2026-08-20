/**
 * POST /api/push/subscribe
 * Registers a new web push subscription for the authenticated user.
 *
 * Body: { endpoint, keys: { p256dh, auth }, user_agent? }
 * Response: { success: boolean }
 *
 * Security:
 *   - user_id is ALWAYS taken from auth.uid() — never from the request body.
 *   - RLS on push_subscriptions enforces user_id = auth.uid().
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { saveSubscription } from "@/lib/push-notifications";
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

    const body = await request.json();
    const { endpoint, keys, user_agent } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing endpoint, keys.p256dh, or keys.auth" },
        { status: 400 }
      );
    }

    const result = await saveSubscription(supabase, user.id, {
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      user_agent,
    });

    if (!result.success) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: result.error || "Failed to save subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<{ ok: true }>>({ success: true, data: { ok: true } });
  } catch (err) {
    console.error("[/api/push/subscribe] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
