-- =============================================================================
-- 0090_jwt_role_claim_fix.sql  (V5 — rename app_metadata.role → app_metadata.app_role)
-- =============================================================================
-- CRITICAL FIX: Authenticated API calls return Postgres error
-- `role "program_coordinator" does not exist` (SQLSTATE 22023).
--
-- ROOT CAUSE
--   GoTrue (Supabase Auth) puts `app_metadata.role` at the TOP LEVEL of the
--   JWT as the `role` claim. PostgREST reads the `role` claim and tries to
--   `SET LOCAL ROLE '<value>'`. The default PostgREST role is `authenticated`
--   (a real Postgres role that Supabase provisions). But when
--   `app_metadata.role` is `program_coordinator` / `student` / etc.,
--   PostgREST tries `SET LOCAL ROLE program_coordinator`, which fails
--   because no such Postgres role exists.
--
--   This was masked in the P1/P2 audit because those tests impersonated RLS
--   via `set_config('role','authenticated')` + `request.jwt.claims` directly
--   against the DB, bypassing PostgREST. Real authenticated app HTTP calls
--   to /api/* (which the Next.js API routes proxy through) NEVER worked
--   end-to-end after migration 0084 was applied.
--
-- FIX
--   Rename `app_metadata.role` to `app_metadata.app_role` for ALL users.
--   GoTrue will then default the JWT top-level `role` claim to `authenticated`
--   (a real Postgres role), and PostgREST can `SET LOCAL ROLE authenticated`
--   successfully. RLS helpers read `app_metadata.app_role` for the app-level
--   role.
--
--   Tried first: GoTrue Custom Access Token Hook (pg-functions://). The hook
--   ran correctly when called directly via SQL / PostgREST RPC, but GoTrue's
--   invocation returned a generic "Error running hook URI" 500. Hook disabled.
--   This rename approach is more reliable.
--
-- POST-APPLY STEPS
--   1. Apply this migration.
--   2. Code change: update every API route that writes app_metadata.role to
--      instead write app_metadata.app_role (next commit).
--   3. Existing JWTs in the wild expire after 1 hour. New sign-ins get the
--      corrected JWT (role: "authenticated").
-- =============================================================================

-- ============================================================================
-- 1. Rename `app_metadata.role` → `app_metadata.app_role` for all users
-- ============================================================================
-- IMPORTANT: parenthesise the concatenation BEFORE the `- 'role'` removal,
-- otherwise Postgres parses `a || b - 'key'` as `a || (b - 'key')`, which
-- leaves the legacy `role` key in place on `a`.
UPDATE auth.users
SET raw_app_meta_data =
  (raw_app_meta_data
    || jsonb_build_object('app_role', raw_app_meta_data->'role'))
  - 'role'
WHERE raw_app_meta_data ? 'role';

-- ============================================================================
-- 1b. Reset auth.users.role column to 'authenticated' for ALL users.
--     GoTrue's `auth.users.role` column is the ACTUAL source of the JWT
--     top-level `role` claim (NOT app_metadata.role — that was a
--     misunderstanding on my part). The role column was set to
--     `program_coordinator` / `student` / etc. by the migration 0084
--     createUser calls (GoTrue copies app_metadata.role into the role
--     column at user-creation time). Now that we've renamed app_metadata
--     keys (above), future createUser calls won't trigger this — but
--     existing rows still have the polluted role column.
-- ============================================================================
UPDATE auth.users
SET role = 'authenticated'
WHERE role <> 'authenticated';

-- ============================================================================
-- 2. Update internhub.current_role() to read app_metadata.app_role
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub."current_role"()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN raw_app_meta_data->>'app_role' IN (
          'super_admin','university_admin','department_coordinator',
          'program_coordinator','faculty_supervisor','student','company_hr',
          'site_supervisor','external_evaluator','pending_assignment'
        ) THEN (raw_app_meta_data->>'app_role')::user_role
        -- Backwards compat: legacy JWTs (issued before this migration
        -- rolled out to all sessions) still have `role` in app_metadata.
        -- Keep reading it until all sessions rotate.
        WHEN raw_app_meta_data->>'role' IN (
          'super_admin','university_admin','department_coordinator',
          'program_coordinator','faculty_supervisor','student','company_hr',
          'site_supervisor','external_evaluator','pending_assignment'
        ) THEN (raw_app_meta_data->>'role')::user_role
        ELSE 'pending_assignment'::user_role
      END
      FROM auth.users
      WHERE id = (SELECT auth.uid())
    ),
    'pending_assignment'::user_role
  );
$function$;

-- ============================================================================
-- 3. Update the sync trigger to write app_metadata.app_role
--    (instead of app_metadata.role). The trigger name and behaviour
--    come from migration 0009/0011/0084.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_role_to_auth_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Sync profiles.role → auth.users.raw_app_meta_data.app_role.
  -- We use app_role (not role) so GoTrue doesn't expose it as the JWT
  -- top-level `role` claim — see this migration's header for why.
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('app_role', NEW.role::text)
    -- also strip the legacy `role` key to prevent the GoTrue bug from
    -- re-surfacing on accounts that still have it.
    - 'role'
  WHERE id = NEW.user_id
    AND COALESCE(raw_app_meta_data->>'app_role', '') <> NEW.role::text;
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 4. Update assign_role / promote_to_super_admin to write app_role
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.assign_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'Permission denied: assign_role can only be called by postgres or service_role';
  END IF;
  IF p_role IS NULL OR p_role = '' THEN
    RAISE EXCEPTION 'Role cannot be empty';
  END IF;
  IF p_role NOT IN (
    'super_admin','university_admin','department_coordinator',
    'program_coordinator','faculty_supervisor','student','company_hr',
    'site_supervisor','external_evaluator','pending_assignment'
  ) THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- Update profiles.role
  UPDATE public.profiles
  SET role = p_role::user_role, updated_at = now()
  WHERE user_id = p_user_id;

  -- Update auth.users.app_metadata.app_role (renamed from `role` in this
  -- migration so GoTrue doesn't expose it as the JWT top-level role claim).
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('app_role', p_role)
    - 'role'
  WHERE id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION internhub.promote_to_super_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'Permission denied: promote_to_super_admin can only be called by postgres or service_role';
  END IF;
  PERFORM internhub.assign_role(p_user_id, 'super_admin');
END;
$function$;

COMMENT ON FUNCTION internhub."current_role"() IS
  'Returns the current user role from auth.users.raw_app_meta_data.app_role (renamed from `role` in migration 0090 to avoid GoTrue exposing it as the JWT top-level role claim, which PostgREST misinterprets as a Postgres role name). Falls back to legacy `role` key for sessions issued before this migration.';
