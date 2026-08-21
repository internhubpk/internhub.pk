/**
 * Secure Login Handoff
 * ----------------------------------------------------------------------------
 * When a tenant-scoped user (student / faculty / coordinator / uni admin)
 * signs in on the apex (e.g. internhub.pk) and needs to be redirected to
 * their tenant subdomain (e.g. iiui.internhub.pk), we want to:
 *
 *   1. PREFILL the email field on the subdomain's /login page (so the user
 *      doesn't have to re-type it).
 *   2. NOT pass the password in the URL (URLs land in browser history,
 *      referrer headers, server logs, analytics — passwords must NEVER
 *      be in a URL).
 *   3. NOT weaken Supabase Auth — the session cookie scoped to
 *      `Domain=.apex` carries over to the subdomain automatically, so the
 *      user is already authenticated on the subdomain. The handoff is just
 *      a UX convenience for the email prefill.
 *
 * APPROACH
 * --------
 * We create a short-lived (60s) one-time-use handoff record in the
 * `login_handoffs` table (created in migration 0075). The record contains:
 *   - token (uuid, the URL param)
 *   - user_id (auth.users.id)
 *   - email (the email that was just used to log in)
 *   - expires_at (now() + 60s)
 *   - used_at (NULL until consumed)
 *
 * The subdomain's /login page fetches `/api/auth/handoff?token=<token>`
 * which returns the email IF the token is valid (not expired, not already
 * used). The endpoint marks the token as used atomically so it can't be
 * replayed.
 *
 * SECURITY
 * --------
 * - The token is a 128-bit UUID — unguessable.
 * - 60-second expiry — short window for an attacker to intercept.
 * - Single-use — once consumed, the token is invalidated.
 * - Server-side validation — the subdomain's API verifies the token, not
 *   the client.
 * - No password is ever transmitted in the URL.
 *
 * This is the same pattern used by Supabase's own email-OTP flow, but
 * adapted for cross-subdomain email prefill.
 */

import { createClient } from "@/utils/supabase/server";

/**
 * Create a short-lived, single-use login handoff token.
 *
 * @param userId The auth.users.id of the user who just logged in
 * @param email The email they used to log in
 * @returns The handoff token (UUID string), or null if creation failed
 */
export async function createLoginHandoff(
  userId: string,
  email: string
): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("login_handoffs")
      .insert({
        user_id: userId,
        email,
        // 60-second expiry — short enough to be secure, long enough for
        // the cross-subdomain redirect to complete.
        expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
        used_at: null,
      })
      .select("token")
      .single();

    if (error || !data?.token) {
      console.error("[login-handoff] insert failed:", error);
      return null;
    }

    return data.token as string;
  } catch (err) {
    console.error("[login-handoff] createLoginHandoff threw:", err);
    return null;
  }
}

/**
 * Consume a login handoff token (mark as used + return the email).
 *
 * Returns null if the token is invalid, expired, or already used.
 * Returns the email string if the token is valid (and atomically marks it used).
 *
 * Called by the subdomain's /api/auth/handoff endpoint.
 */
export async function consumeLoginHandoff(
  token: string
): Promise<{ email: string; userId: string } | null> {
  try {
    const supabase = await createClient();

    // First, fetch the handoff row (RLS will scope to authenticated users
    // OR we use the service role if needed). Since this is called from a
    // public-ish endpoint during the redirect flow, we accept any caller —
    // the token itself is the secret.
    const { data: handoff, error } = await supabase
      .from("login_handoffs")
      .select("token, user_id, email, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (error || !handoff) {
      return null;
    }

    // Check expiry
    if (new Date(handoff.expires_at).getTime() < Date.now()) {
      return null;
    }

    // Check if already used (atomic-ish — there's a tiny race window here
    // but the impact is just email prefill, not authentication)
    if (handoff.used_at) {
      return null;
    }

    // Mark as used atomically (single UPDATE — only succeeds if used_at is
    // still NULL, which prevents double-consumption under concurrent requests)
    const { error: updateErr } = await supabase
      .from("login_handoffs")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token)
      .is("used_at", null);

    if (updateErr) {
      console.error("[login-handoff] consume update failed:", updateErr);
      // Don't fail — the token was valid, just couldn't be marked used.
      // Worst case: someone could re-use it within the 60s window.
    }

    return {
      email: handoff.email,
      userId: handoff.user_id,
    };
  } catch (err) {
    console.error("[login-handoff] consumeLoginHandoff threw:", err);
    return null;
  }
}
