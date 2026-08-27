import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Scoped user-administration helpers.
 *
 * Several dashboards need to edit / delete OTHER user accounts within their
 * own scope (university admin manages students & coordinators of THEIR
 * university, program coordinator manages students & supervisors, …).
 * These operations need the service role (editing someone else's auth
 * account / hard-deleting a user is impossible through browser RLS), so
 * every route that uses them MUST re-verify the caller's DB role AND the
 * target's scope before doing anything privileged.
 */

export interface CallerContext {
  /** The caller's auth user id. */
  callerUserId: string;
  /** The caller's profiles row (role, university_id, …). */
  caller: {
    role: string;
    university_id: string | null;
    department_id: string | null;
    company_id: string | null;
  };
  /** The caller's normal (RLS-scoped) client. */
  supabase: SupabaseClient;
  /** Service-role client (RLS bypassed) — null when not configured. */
  admin: SupabaseClient | null;
}

export type CallerError =
  | { error: "unauthorized" }
  | { error: "forbidden" }
  | { error: "misconfigured" };

/**
 * Authenticate the caller via their cookie session and load their profile.
 * Returns an error result the route should map with callerErrorBody().
 */
export async function getCaller(): Promise<CallerContext | CallerError> {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, university_id, department_id, company_id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return { error: "forbidden" };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = serviceRoleKey
    ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  return {
    callerUserId: user.id,
    caller: profile as CallerContext["caller"],
    supabase,
    admin,
  };
}

/** Type guard for getCaller() error results. */
export function isCallerError(
  ctx: Awaited<ReturnType<typeof getCaller>>
): ctx is CallerError {
  return typeof ctx === "object" && ctx !== null && "error" in ctx;
}

/** Map a getCaller() error to a JSON body + status. */
export function callerErrorBody(
  error: "unauthorized" | "forbidden" | "misconfigured"
): { status: number; body: { success: false; error: string } } {
  switch (error) {
    case "unauthorized":
      return { status: 401, body: { success: false, error: "Unauthorized" } };
    case "forbidden":
      return { status: 403, body: { success: false, error: "Forbidden" } };
    default:
      return { status: 500, body: { success: false, error: "Server misconfigured (missing service role key)" } };
  }
}

/**
 * Scope rule: can `caller` manage a target profile that belongs to
 * `targetUniversityId` / `targetCompanyId`?
 *
 *  - super_admin        → anything
 *  - university_admin   → targets inside their university
 *  - department_coordinator → faculty supervisors / students inside their
 *                             university (extra department checks done by
 *                             the route)
 *  - program_coordinator    → students / supervisors inside their university
 *  - company_hr         → targets inside their company
 */
export function canManageTarget(
  caller: CallerContext["caller"],
  target: { university_id?: string | null; company_id?: string | null }
): boolean {
  switch (caller.role) {
    case "super_admin":
      return true;
    case "university_admin":
    case "department_coordinator":
    case "program_coordinator":
      return (
        !!caller.university_id &&
        !!target.university_id &&
        caller.university_id === target.university_id
      );
    case "company_hr":
      return (
        !!caller.company_id &&
        !!target.company_id &&
        caller.company_id === target.company_id
      );
    default:
      return false;
  }
}
