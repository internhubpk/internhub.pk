-- ============================================================================
-- InternHub.pk — 0013 RLS recursion v3: rewrite current_university_id(),
--                current_department_id(), current_company_id() to read from
--                auth.users metadata (NOT profiles)
-- ----------------------------------------------------------------------------
-- PROBLEM
--   Migration 0009 rewrote internhub.current_role() to read from
--   auth.users.raw_app_meta_data instead of public.profiles, breaking the
--   RLS recursion structurally. The other helpers (current_university_id,
--   current_department_id, current_company_id) were left reading from
--   profiles because — at the time — super_admin was the only role being
--   tested, and super_admin's profiles_select policy short-circuits on
--   `current_role() = 'super_admin'` BEFORE the other helpers evaluate.
--
--   Migration 0009 EXPLICITLY says:
--     "For other roles (student, university_admin, etc.), the policy WILL
--      evaluate those other functions, which still query profiles. If FORCE
--      is genuinely off (step 1) and postgres bypasses RLS, they'll work.
--      If not, we'll need a bigger refactor (move every profile field into
--      auth.users.raw_app_meta_data). Cross that bridge if/when a non-super-
--      admin role fails."
--
--   We are now at that bridge. Symptom: a university_admin can INSERT a
--   department (the WITH CHECK on dept_insert passes because the upsert in
--   /api/admin/create-user wrote university_id to profiles just before the
--   INSERT), but SELECT returns 0 rows. This means current_university_id()
--   is returning NULL during the SELECT — i.e. the SECURITY DEFINER function
--   is failing to read profiles for the university_admin's auth.uid().
--
--   The cleanest fix (same pattern 0009 used for current_role) is to make
--   these helpers read from auth.users metadata, which is NOT subject to
--   RLS, so the function cannot trigger profiles_select, no matter what RLS
--   config is on profiles.
--
-- WHAT THIS DOES
--   1. Rewrites internhub.current_university_id(), current_department_id(),
--      current_company_id() to read from auth.users metadata first
--      (raw_app_meta_data, then raw_user_meta_data as fallback), with a
--      final fallback to profiles for legacy rows.
--   2. Rewrites internhub.sync_role_to_auth_users() (the trigger function
--      from 0011) to ALSO sync university_id, department_id, company_id
--      to BOTH raw_app_meta_data AND raw_user_meta_data whenever any of
--      those columns (or role) changes on profiles.
--   3. Renames the trigger to profiles_sync_auth_metadata (more accurate
--      now that it syncs more than just role). The old trigger name is
--      dropped. The function name is kept (sync_role_to_auth_users) for
--      backward compatibility with any external references.
--   4. One-time backfill: copies profiles.university_id / department_id /
--      company_id into raw_app_meta_data AND raw_user_meta_data for every
--      existing user that has a profiles row with those fields set but
--      metadata missing/stale.
--   5. Diagnostic at the end.
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS + CREATE TRIGGER +
--   conditional UPDATEs that only touch out-of-sync rows. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rewrite current_university_id() — auth.users metadata first
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.current_university_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    -- Priority 1: app_metadata (system-managed, kept in sync by trigger)
    (SELECT (raw_app_meta_data->>'university_id')::uuid
       FROM auth.users WHERE id = (select auth.uid())
       AND raw_app_meta_data ? 'university_id'),
    -- Priority 2: user_metadata (set at signup by /api/admin/create-user)
    (SELECT (raw_user_meta_data->>'university_id')::uuid
       FROM auth.users WHERE id = (select auth.uid())
       AND raw_user_meta_data ? 'university_id'),
    -- Priority 3: profiles table (legacy fallback for rows that haven't
    -- been synced yet, e.g. profiles updated directly via SQL before this
    -- migration was applied)
    (SELECT university_id FROM public.profiles WHERE user_id = (select auth.uid()))
  );
$$;

ALTER FUNCTION internhub.current_university_id() OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 2. Rewrite current_department_id() — same pattern
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.current_department_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT (raw_app_meta_data->>'department_id')::uuid
       FROM auth.users WHERE id = (select auth.uid())
       AND raw_app_meta_data ? 'department_id'),
    (SELECT (raw_user_meta_data->>'department_id')::uuid
       FROM auth.users WHERE id = (select auth.uid())
       AND raw_user_meta_data ? 'department_id'),
    (SELECT department_id FROM public.profiles WHERE user_id = (select auth.uid()))
  );
$$;

ALTER FUNCTION internhub.current_department_id() OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 3. Rewrite current_company_id() — same pattern
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.current_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT (raw_app_meta_data->>'company_id')::uuid
       FROM auth.users WHERE id = (select auth.uid())
       AND raw_app_meta_data ? 'company_id'),
    (SELECT (raw_user_meta_data->>'company_id')::uuid
       FROM auth.users WHERE id = (select auth.uid())
       AND raw_user_meta_data ? 'company_id'),
    (SELECT company_id FROM public.profiles WHERE user_id = (select auth.uid()))
  );
$$;

ALTER FUNCTION internhub.current_company_id() OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 4. Rewrite the sync trigger function to keep role + university_id +
--    department_id + company_id in lockstep across profiles ↔ auth.users
--    metadata (both raw_app_meta_data and raw_user_meta_data).
--
--    The function name is kept as sync_role_to_auth_users for backward
--    compatibility (it's referenced by name in other migrations' comments
--    and in the /api/admin/create-user route's docstring). Its behavior is
--    broader now — it syncs all four tenant-id columns, not just role.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.sync_role_to_auth_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb;
BEGIN
  -- Build a jsonb object with ONLY the non-null / changed fields. This
  -- keeps the metadata payload small and avoids overwriting fields with
  -- null when only one of them changed.
  meta := '{}'::jsonb;

  IF (TG_OP = 'INSERT' AND NEW.role IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role) THEN
    meta := meta || jsonb_build_object('role', NEW.role::text);
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.university_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.university_id IS DISTINCT FROM OLD.university_id) THEN
    meta := meta || jsonb_build_object('university_id', NEW.university_id::text);
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.department_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.department_id IS DISTINCT FROM OLD.department_id) THEN
    meta := meta || jsonb_build_object('department_id', NEW.department_id::text);
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.company_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id) THEN
    meta := meta || jsonb_build_object('company_id', NEW.company_id::text);
  END IF;

  -- Only UPDATE auth.users if we actually have something to sync.
  IF meta <> '{}'::jsonb THEN
    UPDATE auth.users
      SET raw_app_meta_data =
            COALESCE(raw_app_meta_data, '{}'::jsonb) || meta,
          raw_user_meta_data =
            COALESCE(raw_user_meta_data, '{}'::jsonb) || meta
      WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION internhub.sync_role_to_auth_users() OWNER TO postgres;

-- Re-attach the trigger with a more accurate name. Fire on INSERT OR UPDATE
-- OF any of the four synced columns so any direct DB-level change to
-- profiles (e.g. by an admin editing a user) propagates to auth.users
-- metadata immediately.
DROP TRIGGER IF EXISTS profiles_sync_role_to_auth ON public.profiles;
DROP TRIGGER IF EXISTS profiles_sync_auth_metadata ON public.profiles;

CREATE TRIGGER profiles_sync_auth_metadata
  AFTER INSERT OR UPDATE OF role, university_id, department_id, company_id
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION internhub.sync_role_to_auth_users();

-- ----------------------------------------------------------------------------
-- 5. One-time backfill — copy profiles.university_id / department_id /
--    company_id into BOTH raw_app_meta_data AND raw_user_meta_data for
--    every existing user that has them set in profiles but missing/stale
--    in metadata. (Same approach 0009/0011 used for role.)
-- ----------------------------------------------------------------------------

-- 5a. Backfill university_id
UPDATE auth.users u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('university_id', p.university_id::text)
FROM public.profiles p
WHERE p.user_id = u.id
  AND p.university_id IS NOT NULL
  AND COALESCE(u.raw_app_meta_data->>'university_id', '') <> p.university_id::text;

UPDATE auth.users u
SET raw_user_meta_data =
      COALESCE(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('university_id', p.university_id::text)
FROM public.profiles p
WHERE p.user_id = u.id
  AND p.university_id IS NOT NULL
  AND COALESCE(u.raw_user_meta_data->>'university_id', '') <> p.university_id::text;

-- 5b. Backfill department_id
UPDATE auth.users u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('department_id', p.department_id::text)
FROM public.profiles p
WHERE p.user_id = u.id
  AND p.department_id IS NOT NULL
  AND COALESCE(u.raw_app_meta_data->>'department_id', '') <> p.department_id::text;

UPDATE auth.users u
SET raw_user_meta_data =
      COALESCE(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('department_id', p.department_id::text)
FROM public.profiles p
WHERE p.user_id = u.id
  AND p.department_id IS NOT NULL
  AND COALESCE(u.raw_user_meta_data->>'department_id', '') <> p.department_id::text;

-- 5c. Backfill company_id
UPDATE auth.users u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('company_id', p.company_id::text)
FROM public.profiles p
WHERE p.user_id = u.id
  AND p.company_id IS NOT NULL
  AND COALESCE(u.raw_app_meta_data->>'company_id', '') <> p.company_id::text;

UPDATE auth.users u
SET raw_user_meta_data =
      COALESCE(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('company_id', p.company_id::text)
FROM public.profiles p
WHERE p.user_id = u.id
  AND p.company_id IS NOT NULL
  AND COALESCE(u.raw_user_meta_data->>'company_id', '') <> p.company_id::text;

-- 5d. Re-assert role is in sync (covers the case where 0011 was run, then
--     a role change happened, then 0011 was NOT re-run on the new change.
--     This is the same UPDATE 0011 does; safe to repeat.)
UPDATE auth.users u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', p.role::text)
FROM public.profiles p
WHERE p.user_id = u.id
  AND p.role IS NOT NULL
  AND COALESCE(u.raw_app_meta_data->>'role', '') <> p.role::text;

UPDATE auth.users u
SET raw_user_meta_data =
      COALESCE(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', p.role::text)
FROM public.profiles p
WHERE p.user_id = u.id
  AND p.role IS NOT NULL
  AND COALESCE(u.raw_user_meta_data->>'role', '') <> p.role::text;

-- ----------------------------------------------------------------------------
-- 6. Diagnostic — should show 0 out-of-sync rows after this runs, and the
--    new trigger in place.
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM auth.users u
     JOIN public.profiles p ON p.user_id = u.id
    WHERE p.university_id IS NOT NULL
      AND COALESCE(u.raw_app_meta_data->>'university_id', '') <> p.university_id::text)
                                                              AS app_meta_university_out_of_sync,
  (SELECT count(*) FROM auth.users u
     JOIN public.profiles p ON p.user_id = u.id
    WHERE p.university_id IS NOT NULL
      AND COALESCE(u.raw_user_meta_data->>'university_id', '') <> p.university_id::text)
                                                              AS user_meta_university_out_of_sync,
  (SELECT count(*) FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'profiles'
      AND trigger_name = 'profiles_sync_auth_metadata')        AS new_trigger_exists,
  (SELECT count(*) FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'profiles'
      AND trigger_name = 'profiles_sync_role_to_auth')         AS old_trigger_still_exists;
