import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Super-admin API helpers.
 *
 * Every /api/super-admin/* route must:
 *   1. Authenticate the caller with their cookie-bound session (so the
 *      request is really signed-in), and
 *   2. Verify the caller's role from the DATABASE `profiles` row — JWT
 *      app_metadata is synced by trigger but the DB is the source of truth
 *      (2026-08-23 audit rule).
 *
 * Privileged operations then run through the service-role client.
 */

export interface SuperAdminContext {
  /** The caller's auth user id. */
  callerUserId: string;
  /** Service-role client (RLS bypassed). */
  admin: SupabaseClient;
}

/**
 * Authenticate the request as a super_admin and return a service-role client.
 * Returns null (the route should respond 401/403) when the caller is not a
 * super admin or the server is misconfigured.
 */
export async function requireSuperAdmin(): Promise<
  SuperAdminContext | { error: "unauthorized" } | { error: "forbidden" } | { error: "misconfigured" }
> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No-op — we don't need to mutate cookies here.
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "unauthorized" };
  }

  // DB-verified role check — never trust JWT metadata alone for privileged
  // mutations (2026-08-23 audit).
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (callerProfile?.role !== "super_admin") {
    return { error: "forbidden" };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("[super-admin] SUPABASE_SERVICE_ROLE_KEY is not configured");
    return { error: "misconfigured" };
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  return { callerUserId: user.id, admin };
}

/** Type guard: true when requireSuperAdmin() returned an error result. */
export function isSuperAdminError(
  ctx: Awaited<ReturnType<typeof requireSuperAdmin>>
): ctx is { error: "unauthorized" | "forbidden" | "misconfigured" } {
  return typeof ctx === "object" && ctx !== null && "error" in ctx;
}

/** Map a requireSuperAdmin() error result to a JSON response body + status. */
export function superAdminErrorBody(
  error: "unauthorized" | "forbidden" | "misconfigured"
): { status: number; body: { success: false; error: string } } {
  switch (error) {
    case "unauthorized":
      return { status: 401, body: { success: false, error: "Unauthorized" } };
    case "forbidden":
      return { status: 403, body: { success: false, error: "Forbidden: Super Admin access required" } };
    default:
      return { status: 500, body: { success: false, error: "Server misconfigured (missing service role key)" } };
  }
}
