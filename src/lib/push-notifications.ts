/**
 * Push Notification Service — server-side
 *
 * Uses the `web-push` library to send Web Push API notifications to
 * subscribed browsers. Subscription endpoints are stored in the
 * `push_subscriptions` table (migration 0074) and scoped per-user via RLS.
 *
 * VAPID keys are generated once and stored as environment variables:
 *   - VAPID_PUBLIC_KEY  (safe to expose to the browser)
 *   - VAPID_PRIVATE_KEY (server-only, NEVER expose)
 *   - VAPID_SUBJECT     (mailto: or https: URL for VAPID identification)
 *
 * Security:
 *   - The public key is exposed via /api/push/vapid-public-key
 *   - The private key is NEVER imported into client code
 *   - All sends go through this server module, which uses the service role
 *     to bypass RLS when fetching subscriptions for a target user.
 */

import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ----------------------------------------------------------------------------
// VAPID configuration
// ----------------------------------------------------------------------------
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:noreply@internhub.pk";

let vapidConfigured = false;

/**
 * Configure web-push with VAPID keys. Called lazily on first send.
 * If keys are missing, sends will fail with a clear error.
 */
function configureWebPush(): void {
  if (vapidConfigured) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error(
      "[push] VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables are required for push notifications. Generate with: npx web-push generate-vapid-keys"
    );
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
}

/**
 * Get the VAPID public key for client-side subscription.
 * Safe to expose — the public key is NOT a secret.
 */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

/**
 * Check if push notifications are configured (VAPID keys present).
 */
export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

// ----------------------------------------------------------------------------
// Service role Supabase client (server-only, bypasses RLS)
// ----------------------------------------------------------------------------
function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "[push] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to send push notifications."
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ----------------------------------------------------------------------------
// Subscription management
// ----------------------------------------------------------------------------
export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  user_agent?: string;
  preferences?: Record<string, unknown>;
}

/**
 * Save (or update) a push subscription for the given user.
 * Called from the /api/push/subscribe route.
 *
 * Uses the regular authenticated client (NOT the service role) so RLS
 * enforces user_id = auth.uid() at the database level.
 */
export async function saveSubscription(
  supabase: SupabaseClient,
  userId: string,
  sub: PushSubscriptionInput
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: sub.user_agent || null,
        preferences: sub.preferences || {},
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    );

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Deactivate (soft-delete) a push subscription by endpoint.
 * Called from the /api/push/unsubscribe route.
 */
export async function deactivateSubscription(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ----------------------------------------------------------------------------
// Sending notifications
// ----------------------------------------------------------------------------
export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  requireInteraction?: boolean;
  silent?: boolean;
}

/**
 * Send a push notification to ALL active subscriptions for a user.
 * Uses the service role client to read subscriptions (bypasses RLS) because
 * the sending context (e.g. a workflow event trigger) is not the user
 * themselves.
 *
 * @param userId The target user's auth.users.id
 * @param payload The notification payload
 * @returns The number of successful sends (and per-endpoint errors)
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; errors: Array<{ endpoint: string; reason: string }> }> {
  if (!isPushConfigured()) {
    // Push not configured — silently no-op. The notification row in the
    // `notifications` table is still inserted by the caller, so the user
    // still sees it in the notifications popover.
    return { sent: 0, failed: 0, errors: [] };
  }

  configureWebPush();

  const serviceClient = createServiceRoleClient();
  const { data: subs, error } = await serviceClient
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_agent")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    console.error("[push] Failed to fetch subscriptions:", error);
    return { sent: 0, failed: 0, errors: [] };
  }

  if (!subs || subs.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  const payloadStr = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const errors: Array<{ endpoint: string; reason: string }> = [];

  // Send in parallel (bounded) — typical users have 1-3 subscriptions.
  await Promise.all(
    subs.map(async (sub) => {
      const pushSubscription: WebPushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, payloadStr, {
          urgency: payload.silent ? "normal" : "high",
          topic: payload.tag,
        });
        sent++;
      } catch (err: unknown) {
        failed++;
        const reason =
          err instanceof Error ? err.message : "Unknown send error";

        // 404 / 410 = subscription no longer valid → mark inactive.
        // web-push library surfaces status codes via the `statusCode` property.
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await serviceClient
            .from("push_subscriptions")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", sub.id);
        }

        errors.push({ endpoint: sub.endpoint, reason });
      }
    })
  );

  return { sent, failed, errors };
}

/**
 * Send a push notification to multiple users (e.g. all admins of a university).
 * Parallelizes sendPushToUser.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  await Promise.all(userIds.map((uid) => sendPushToUser(uid, payload)));
}
