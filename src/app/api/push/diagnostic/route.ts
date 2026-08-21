/**
 * GET /api/push/diagnostic
 *
 * Returns a diagnostic report of the push notification system's
 * configuration. Helps operators identify WHY push isn't working.
 *
 * Checks:
 *   1. VAPID keys configured (env vars OR database)
 *   2. Service role key available
 *   3. push_subscriptions table exists
 *   4. Number of active subscriptions for the current user
 *
 * Requires authentication (super_admin only).
 */

import { NextResponse } from "next/server";
import { isPushConfiguredAsync, getVapidPublicKeyAsync } from "@/lib/push-notifications";
import { createClient } from "@/utils/supabase/server";
import type { ApiResponse } from "@/types";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.role !== "super_admin") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Forbidden: Super Admin only" },
        { status: 403 }
      );
    }

    const report: Record<string, unknown> = {};

    // 1. VAPID keys
    const vapidConfigured = await isPushConfiguredAsync();
    report.vapid_configured = vapidConfigured;
    report.vapid_source = process.env.VAPID_PUBLIC_KEY ? "env_vars" : vapidConfigured ? "database" : "none";

    if (vapidConfigured) {
      const publicKey = await getVapidPublicKeyAsync();
      report.vapid_public_key = publicKey ? `${publicKey.slice(0, 20)}...` : "missing";
    }

    // 2. Service role key
    report.service_role_key_set = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 3. push_subscriptions table
    try {
      const { count, error } = await supabase
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true });
      report.push_table_exists = !error;
      report.total_subscriptions = count || 0;
      report.push_table_error = error?.message || null;
    } catch (err) {
      report.push_table_exists = false;
      report.push_table_error = "Table query failed";
    }

    // 4. Current user's subscriptions
    try {
      const { data: userSubs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, is_active, created_at")
        .eq("user_id", user.id);
      report.user_subscriptions = userSubs || [];
    } catch {
      report.user_subscriptions = [];
    }

    // 5. Overall assessment
    const issues: string[] = [];
    if (!vapidConfigured) {
      issues.push("VAPID keys not found — set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY env vars OR insert 'push_vapid' row in platform_settings");
    }
    if (!report.service_role_key_set) {
      issues.push("SUPABASE_SERVICE_ROLE_KEY env var is not set — push sends will fail because the server can't read push_subscriptions");
    }
    if (!report.push_table_exists) {
      issues.push("push_subscriptions table doesn't exist — run migration 0074");
    }

    report.issues = issues;
    report.push_should_work = issues.length === 0;

    return NextResponse.json<ApiResponse<typeof report>>({
      success: true,
      data: report,
    });
  } catch (err) {
    console.error("[/api/push/diagnostic] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
