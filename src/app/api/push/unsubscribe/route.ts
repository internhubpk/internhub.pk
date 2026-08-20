/**
 * POST /api/push/unsubscribe
 * Deactivates a web push subscription by endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { deactivateSubscription } from "@/lib/push-notifications";
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
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Missing endpoint" },
        { status: 400 }
      );
    }

    const result = await deactivateSubscription(supabase, user.id, endpoint);

    if (!result.success) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: result.error || "Failed to deactivate subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<{ ok: true }>>({ success: true, data: { ok: true } });
  } catch (err) {
    console.error("[/api/push/unsubscribe] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
