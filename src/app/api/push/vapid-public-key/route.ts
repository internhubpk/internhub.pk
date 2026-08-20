/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key for client-side push subscription.
 *
 * The VAPID PUBLIC key is safe to expose to the browser — it is NOT a
 * secret. The corresponding PRIVATE key is server-only.
 *
 * Returns 503 if push is not configured (so the client can gracefully
 * disable the "Enable notifications" button).
 */

import { NextResponse } from "next/server";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push-notifications";
import type { ApiResponse } from "@/types";

export async function GET() {
  if (!isPushConfigured()) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Push notifications not configured" },
      { status: 503 }
    );
  }

  return NextResponse.json<ApiResponse<{ publicKey: string }>>({
    success: true,
    data: { publicKey: getVapidPublicKey() },
  });
}
