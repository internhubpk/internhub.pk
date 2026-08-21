/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key for client-side push subscription.
 *
 * The VAPID PUBLIC key is safe to expose to the browser — it is NOT a
 * secret. The corresponding PRIVATE key is server-only.
 *
 * Returns 503 if push is not configured (VAPID keys not found in env vars
 * or database) — so the client can gracefully disable the "Enable
 * notifications" button.
 */

import { NextResponse } from "next/server";
import { getVapidPublicKeyAsync, isPushConfiguredAsync } from "@/lib/push-notifications";
import type { ApiResponse } from "@/types";

export async function GET() {
  const configured = await isPushConfiguredAsync();
  if (!configured) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Push notifications not configured" },
      { status: 503 }
    );
  }

  const publicKey = await getVapidPublicKeyAsync();
  if (!publicKey) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "VAPID public key not found" },
      { status: 503 }
    );
  }

  return NextResponse.json<ApiResponse<{ publicKey: string }>>({
    success: true,
    data: { publicKey },
  });
}
