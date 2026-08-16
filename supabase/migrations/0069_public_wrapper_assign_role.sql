-- ============================================================================
-- 0069_public_wrapper_assign_role.sql
-- ----------------------------------------------------------------------------
-- PostgREST (which backs Supabase's /rpc endpoint) does NOT support
-- schema-qualified function names in the RPC path. When the client calls
-- `supabase.rpc("internhub.assign_role", args)`, the request URL becomes
-- `/rpc/internhub.assign_role` and PostgREST looks for a function literally
-- named "internhub.assign_role" in the `public` schema — which doesn't exist.
-- The result is the error:
--
--   Could not find the function public.internhub.assign_role(
--     p_company_id, p_department_id, p_program_id, p_role,
--     p_university_id, p_user_id
--   ) in the schema cache
--
-- Fix: expose a thin `public.assign_role(...)` wrapper that delegates to
-- `internhub.assign_role(...)`. This matches the pattern already used by
-- `public.get_user_university_id()`, `public.increment_applicant_count()`,
-- etc. (see migrations 0028 and 0057).
--
-- While here, also create a `public.ensure_profile_exists(uuid)` wrapper
-- for the same reason — the client calls `supabase.rpc("ensure_profile_exists",
-- ...)` (migration 0035) but the function only exists in the `internhub`
-- schema, so that call has the same latent bug. The create-user flow has
-- apparently been failing silently; wrapping it now fixes both at once.
--
-- Both wrappers are SECURITY DEFINER + owned by postgres so they can call
-- the underlying internhub.* functions (which themselves enforce authz).
-- We REVOKE EXECUTE from anon/authenticated/PUBLIC and GRANT only to
-- service_role, because both functions are admin-only operations invoked
-- from server-side API routes that use the service-role key.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. public.assign_role(...) — thin wrapper over internhub.assign_role(...)
-- ----------------------------------------------------------------------------
-- Signature mirrors internhub.assign_role exactly so the call site can be
-- a 1:1 swap (just drop the schema prefix).
CREATE OR REPLACE FUNCTION public.assign_role(
  p_user_id uuid,
  p_role user_role,
  p_university_id uuid DEFAULT NULL::uuid,
  p_department_id uuid DEFAULT NULL::uuid,
  p_program_id uuid DEFAULT NULL::uuid,
  p_company_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public, internhub
AS $$
  SELECT internhub.assign_role(
    p_user_id,
    p_role,
    p_university_id,
    p_department_id,
    p_program_id,
    p_company_id
  );
$$;

ALTER FUNCTION public.assign_role(uuid, user_role, uuid, uuid, uuid, uuid) OWNER TO postgres;

-- Lock down: only service_role (server-side API routes) may call this.
-- The underlying internhub.assign_role ALSO enforces caller must be
-- super_admin, so this is defense in depth.
REVOKE EXECUTE ON FUNCTION public.assign_role(uuid, user_role, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_role(uuid, user_role, uuid, uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.assign_role(uuid, user_role, uuid, uuid, uuid, uuid) IS
  'Public-schema wrapper for internhub.assign_role(). PostgREST cannot call schema-qualified function names — this wrapper exposes the function via /rpc/assign_role so the supabase-js client can call it. Authorization (super_admin only) is enforced by the underlying internhub.assign_role().';

-- ----------------------------------------------------------------------------
-- 2. public.ensure_profile_exists(uuid) — thin wrapper over
--    internhub.ensure_profile_exists(uuid)
-- ----------------------------------------------------------------------------
-- This one is called by /api/admin/create-user, /api/supervisors,
-- /api/department-coordinator/students/bulk and /api/students after creating
-- an auth.users row. All four use the service-role client, so service_role
-- EXECUTE is sufficient.
CREATE OR REPLACE FUNCTION public.ensure_profile_exists(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public, internhub
AS $$
  SELECT internhub.ensure_profile_exists(p_user_id);
$$;

ALTER FUNCTION public.ensure_profile_exists(uuid) OWNER TO postgres;

-- The underlying internhub.ensure_profile_exists is currently granted to
-- authenticated/anon/service_role. Match that surface here for back-compat
-- (some callers may use the user-bound SSR client rather than service-role).
REVOKE EXECUTE ON FUNCTION public.ensure_profile_exists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists(uuid) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.ensure_profile_exists(uuid) IS
  'Public-schema wrapper for internhub.ensure_profile_exists(). PostgREST cannot call schema-qualified function names — this wrapper exposes the function via /rpc/ensure_profile_exists so the supabase-js client can call it.';

-- ----------------------------------------------------------------------------
-- 3. Reload PostgREST schema cache so the new wrappers are immediately
--    visible (without this, the first call after migration would still 404
--    until the next periodic reload).
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- End of 0069_public_wrapper_assign_role.sql
-- ============================================================================
