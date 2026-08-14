/**
 * Shared notification-prefs helper.
 *
 * Reads/writes the `notification_prefs` jsonb column on `profiles` so
 * that each user's notification preferences sync across devices/browsers
 * (the previous localStorage-only approach lost prefs on browser-data
 * clear and didn't sync between devices).
 *
 * Added alongside migration 0043_profiles_notification_prefs.sql.
 */

import { createClient } from "@/utils/supabase/client";

/**
 * Canonical notification preferences shape used by all settings pages
 * (university-admin, department-coordinator, company-hr, faculty-supervisor).
 *
 * Each boolean controls whether the user receives that category in-app.
 * Email/SMS channels can be added later by extending the schema — for now
 * the UI only toggles in-app.
 */
export interface NotificationPrefs {
  // Application lifecycle
  application_submitted?: boolean;
  application_status_change?: boolean;
  // Tasks
  task_assigned?: boolean;
  task_submitted?: boolean;
  task_evaluated?: boolean;
  // Evaluations
  evaluation_submitted?: boolean;
  // Weekly logs
  weekly_log_submitted?: boolean;
  weekly_log_reviewed?: boolean;
  // Certificates
  certificate_issued?: boolean;
  // System / account
  account_updates?: boolean;
  security_alerts?: boolean;
  // Marketing (default off — these are the only ones we default off)
  product_news?: boolean;
}

/** Default prefs applied when a user has never saved any (new account). */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  application_submitted: true,
  application_status_change: true,
  task_assigned: true,
  task_submitted: true,
  task_evaluated: true,
  evaluation_submitted: true,
  weekly_log_submitted: true,
  weekly_log_reviewed: true,
  certificate_issued: true,
  account_updates: true,
  security_alerts: true,
  product_news: false,
};

/**
 * Load a user's notification preferences from the `profiles` table.
 *
 * Returns DEFAULT_NOTIFICATION_PREFS merged with whatever's stored in
 * `profiles.notification_prefs` (so missing keys always get a sensible
 * default — a user who never touched the settings page still gets the
 * recommended defaults, and a user who only toggled one switch doesn't
 * silently lose the others).
 *
 * On any error (network, RLS denial, missing profile row), returns the
 * defaults — the UI is non-blocking and a missing prefs row should never
 * break the settings page.
 */
export async function loadNotificationPrefs(
  userId: string
): Promise<NotificationPrefs> {
  if (!userId) return { ...DEFAULT_NOTIFICATION_PREFS };

  try {
    const supabase = createClient();
    if (!supabase) return { ...DEFAULT_NOTIFICATION_PREFS };

    const { data, error } = await supabase
      .from("profiles")
      .select("notification_prefs")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return { ...DEFAULT_NOTIFICATION_PREFS };
    }

    const stored = (data.notification_prefs as Partial<NotificationPrefs>) || {};
    return { ...DEFAULT_NOTIFICATION_PREFS, ...stored };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

/**
 * Save a user's notification preferences to the `profiles` table.
 *
 * Returns true on success, false on any error. The caller is responsible
 * for surfacing the error to the user (typically via a toast).
 *
 * Note: the update is scoped to the caller's own user_id — RLS will
 * reject attempts to update another user's prefs even if the user_id
 * is spoofed.
 */
export async function saveNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs
): Promise<boolean> {
  if (!userId) return false;

  try {
    const supabase = createClient();
    if (!supabase) return false;

    const { error } = await supabase
      .from("profiles")
      .update({
        // Cast through `unknown` because `NotificationPrefs` (an interface
        // with named boolean fields) doesn't structurally overlap with
        // `Record<string, unknown>` — TS2352. The jsonb column accepts any
        // JSON shape, so this is a safe persistence boundary.
        notification_prefs: prefs as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("saveNotificationPrefs error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("saveNotificationPrefs exception:", err);
    return false;
  }
}
