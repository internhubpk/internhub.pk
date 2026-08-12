-- ============================================================================
-- InternHub.pk — 0009 Final fix: rewrite current_role() to read auth.users
-- ----------------------------------------------------------------------------
-- WHY 0008 WASN'T ENOUGH
--   0008 dropped FORCE ROW LEVEL SECURITY on every table. In theory, that
--   lets the table owner (postgres) bypass RLS, so the SECURITY DEFINER
--   function internhub.current_role() — owned by postgres — could query
--   profiles without triggering the profiles_select policy.
--
--   In practice, on this Supabase project, recursion is STILL happening.
--   The most likely reasons:
--     (a) The postgres role in this project doesn't actually have BYPASSRLS
--         (Supabase's default has changed over time and varies by project
--         age/region)
--     (b) The function owner isn't postgres (less likely, but possible if
--         a previous CREATE OR REPLACE was run by a different role)
--     (c) FORCE got re-applied by re-running an older migration
--
--   Diagnosing which one is a waste of your time. The fix below breaks the
--   recursion by STRUCTURE, not by configuration: current_role() stops
--   reading from `profiles` (RLS-protected) and starts reading from
--   `auth.users` (no RLS). Recursion becomes impossible.
--
-- WHAT THIS DOES
--   1. Drops FORCE on every table (idempotent belt-and-suspenders).
--   2. One-time sync: copies profiles.role -> auth.users.raw_app_meta_data->>'role'
--      so the new function returns the correct role for every existing user
--      (including your manually-set super_admin).
--   3. Rewrites internhub.current_role() to read from auth.users.
--      auth.users is in the auth schema and is NOT subject to RLS, so the
--      function cannot trigger profiles_select, no matter what RLS config
--      is on profiles.
--   4. Adds a trigger on profiles so that future role changes (manual or
--      via the admin UI) automatically propagate to auth.users.raw_app_meta_data.
--      Without this, an admin changing someone's role in profiles wouldn't
--      be reflected in current_role().
--   5. Diagnostic at the end.
--
-- WHAT THIS DOESN'T DO
--   The other internhub.* helpers (current_university_id, current_department_id,
--   current_company_id, is_assigned_supervisor) still read from profiles.
--   For super_admin, the profiles_select policy short-circuits on
--   `current_role() = 'super_admin'` BEFORE those other functions are
--   evaluated, so super_admin login will work after this fix.
--
--   For other roles (student, university_admin, etc.), the policy WILL
--   evaluate those other functions, which still query profiles. If FORCE
--   is genuinely off (step 1) and postgres bypasses RLS, they'll work.
--   If not, we'll need a bigger refactor (move every profile field into
--   auth.users.raw_app_meta_data). Cross that bridge if/when a non-super-
--   admin role fails.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop FORCE on every public table (idempotent loop)
-- ----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relforcerowsecurity = true
  LOOP
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. One-time sync: profiles.role -> auth.users.raw_app_meta_data->>'role'
--    (this picks up your manually-set super_admin)
-- ----------------------------------------------------------------------------
UPDATE auth.users u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', p.role::text)
FROM public.profiles p
WHERE p.user_id = u.id
  AND p.role IS NOT NULL
  AND COALESCE(u.raw_app_meta_data->>'role', '') <> p.role::text;

-- ----------------------------------------------------------------------------
-- 3. Rewrite current_role() to read from auth.users (NO RLS, NO recursion)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.current_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN raw_app_meta_data->>'role' IN
          ('super_admin','university_admin','department_coordinator',
           'faculty_supervisor','student','company_hr','site_supervisor',
           'external_evaluator','pending_assignment')
          THEN (raw_app_meta_data->>'role')::user_role
        WHEN raw_user_meta_data->>'role' IN
          ('super_admin','university_admin','department_coordinator',
           'faculty_supervisor','student','company_hr','site_supervisor',
           'external_evaluator','pending_assignment')
          THEN (raw_user_meta_data->>'role')::user_role
        ELSE 'pending_assignment'::user_role
      END
      FROM auth.users
      WHERE id = (select auth.uid())
    ),
    'pending_assignment'::user_role
  );
$$;

-- Make sure the function is owned by postgres (table owner)
ALTER FUNCTION internhub.current_role() OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 4. Trigger: keep auth.users.raw_app_meta_data->>'role' in sync with
--    profiles.role going forward (so admin role changes take effect)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.sync_role_to_auth_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.role IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role) THEN
    UPDATE auth.users
      SET raw_app_meta_data =
            COALESCE(raw_app_meta_data, '{}'::jsonb)
            || jsonb_build_object('role', NEW.role::text)
      WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION internhub.sync_role_to_auth_users() OWNER TO postgres;

DROP TRIGGER IF EXISTS profiles_sync_role_to_auth ON public.profiles;
CREATE TRIGGER profiles_sync_role_to_auth
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION internhub.sync_role_to_auth_users();

-- ----------------------------------------------------------------------------
-- 5. Diagnostic
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relforcerowsecurity = true)                       AS tables_with_FORCE_still_on,
  (SELECT count(*) FROM auth.users u
     JOIN public.profiles p ON p.user_id = u.id
    WHERE COALESCE(u.raw_app_meta_data->>'role', '') <> p.role::text)
                                                              AS users_out_of_sync,
  (SELECT count(*) FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'profiles'
      AND trigger_name = 'profiles_sync_role_to_auth')        AS sync_trigger_exists;
