/**
 * Service Role Supabase Client
 *
 * This client uses the SERVICE_ROLE_KEY which BYPASSES all RLS (Row Level Security)
 * policies. Use this ONLY for:
 *
 * 1. Public API endpoints that serve data to unauthenticated users
 *    (e.g., /api/universities, /api/companies for public pages)
 * 2. Server-side operations that need full database access
 * 3. Admin operations that must bypass RLS
 *
 * ⚠️ SECURITY WARNING: Never expose this client or its responses to
 * client-side code in a way that could allow privilege escalation.
 * Only use in API routes (server-side).
 *
 * ----------------------------------------------------------------------------
 * WHY THIS IMPLEMENTATION (2026-08-25 fix)
 * ----------------------------------------------------------------------------
 * The previous version used `createServerClient` from `@supabase/ssr` with
 * the cookie store attached. That helper is designed for browser-session
 * continuity — it threads the user's JWT through every request via the
 * `Authorization: Bearer <jwt>` header. When the SERVICE_ROLE_KEY is
 * paired with a user JWT, Supabase's PostgREST may evaluate RLS based
 * on the JWT (not the service_role key), depending on the project's
 * `db-service-role` binding. In practice, that meant cross-tenant
 * lookups (e.g., company_hr searching for a university_admin's email
 * during MOU invite) returned 0 rows, and the API fell through to
 * "No account found with that email. The person must register first."
 *
 * The fix is to use `createClient` from `@supabase/supabase-js` directly
 * with `{ auth: { persistSession: false } }`. No cookies are read, no
 * JWT is attached, and the service_role key cleanly bypasses RLS for
 * every query.
 */

import { createClient } from "@supabase/supabase-js";

/**
 * Create a Supabase client with service role privileges (bypasses RLS).
 *
 * Usage in API routes:
 *   import { createServiceRoleClient } from "@/utils/supabase/service-role";
 *   const supabase = await createServiceRoleClient();
 *
 * Throws if NEXT_PUBLIC_SUPABASE_URL is unset OR
 * SUPABASE_SERVICE_ROLE_KEY is unset / empty / whitespace-only.
 *
 * The previous implementation silently fell back to the anon (RLS-bound)
 * client when the service-role key was missing. That fallback was the
 * root cause of multiple "No account found" / "Email not found" bugs in
 * production — the route thought it was bypassing RLS but was actually
 * subject to it. Failing loudly is safer than silently degrading.
 */
export async function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "createServiceRoleClient: NEXT_PUBLIC_SUPABASE_URL is not set. " +
      "Server-side RLS bypass is unavailable."
    );
  }

  if (!serviceRoleKey || !serviceRoleKey.trim()) {
    throw new Error(
      "createServiceRoleClient: SUPABASE_SERVICE_ROLE_KEY is not set or empty. " +
      "Set it in .env.local (server-only — never prefix with NEXT_PUBLIC_). " +
      "Cross-tenant lookups (MOU email search, admin create-user, certificate " +
      "verification) require the service-role key to bypass RLS."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // CRITICAL: do not persist a session, do not read cookies, do not
      // attach any Authorization header. The service-role key alone is
      // what grants RLS bypass — adding a JWT to the request can cause
      // PostgREST to downgrade the request to the JWT's role and apply
      // RLS, which defeats the whole point of using the service-role key.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
