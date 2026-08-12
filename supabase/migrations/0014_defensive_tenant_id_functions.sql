-- ============================================================================
-- InternHub.pk — 0014 Defensive tenant-id functions (no profiles fallback)
-- ----------------------------------------------------------------------------
-- PROBLEM
--   After running 0013, the university admin dashboard started returning
--   HTTP 400 on profiles queries and HTTP 500 on /api/admin/create-user.
--
--   Root cause #1 — potential RLS recursion:
--     0013 kept a last-resort fallback to `public.profiles` inside
--     current_university_id(), current_department_id(), current_company_id().
--     If FORCE ROW LEVEL SECURITY got re-applied on `profiles` (which has
--     happened before on this project — see 0009's comments), that fallback
--     triggers profiles_select → current_university_id() → profiles →
--     profiles_select → ... → 42P17 error → PostgREST returns 400.
--
--   Root cause #2 — unsafe UUID cast:
--     0013's functions do `(raw_app_meta_data->>'university_id')::uuid`.
--     If any user's metadata has `university_id: ""` or
--     `university_id: "not-a-uuid"`, the cast throws, the function throws,
--     the RLS policy throws, PostgREST returns 400.
--
-- FIX
--   1. Remove the `public.profiles` fallback from all three tenant-id
--      functions. They now read from auth.users metadata ONLY. This
--      matches what 0009 did for current_role() — no profiles read, no
--      possibility of recursion, period.
--
--      If a user's metadata doesn't have the tenant id, the function
--      returns NULL. The RLS policy `university_id = NULL` evaluates to
--      NULL (not true), so the user sees no rows. That is the correct
--      behavior — a user without a university assignment should not see
--      university-scoped data.
--
--   2. Add a UUID regex check BEFORE the cast. Only cast if the string
--      matches `^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$`. Empty
--      strings, NULL, and garbage all return NULL instead of throwing.
--
--   3. Re-run the backfill from 0013 (same UPDATEs, idempotent) to make
--      absolutely sure every user with profiles.university_id set has
--      matching metadata.
--
--   4. Diagnostic at the end shows:
--        - users with profiles.university_id set but metadata missing
--        - users where current_university_id() would return NULL
--      Both should be 0 after this migration runs.
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION + conditional UPDATEs. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. current_university_id() — auth.users metadata only, safe cast
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.current_university_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    -- Priority 1: app_metadata (system-managed)
    (SELECT CASE
              WHEN raw_app_meta_data->>'university_id'
                   ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
              THEN (raw_app_meta_data->>'university_id')::uuid
              ELSE NULL
            END
       FROM auth.users WHERE id = (select auth.uid())),
    -- Priority 2: user_metadata (set at signup)
    (SELECT CASE
              WHEN raw_user_meta_data->>'university_id'
                   ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
              THEN (raw_user_meta_data->>'university_id')::uuid
              ELSE NULL
            END
       FROM auth.users WHERE id = (select auth.uid()))
    -- NO profiles fallback — prevents RLS recursion.
  );
$$;

ALTER FUNCTION internhub.current_university_id() OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 2. current_department_id() — same pattern
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.current_department_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT CASE
              WHEN raw_app_meta_data->>'department_id'
                   ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
              THEN (raw_app_meta_data->>'department_id')::uuid
              ELSE NULL
            END
       FROM auth.users WHERE id = (select auth.uid())),
    (SELECT CASE
              WHEN raw_user_meta_data->>'department_id'
                   ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
              THEN (raw_user_meta_data->>'department_id')::uuid
              ELSE NULL
            END
       FROM auth.users WHERE id = (select auth.uid()))
  );
$$;

ALTER FUNCTION internhub.current_department_id() OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 3. current_company_id() — same pattern
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.current_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT CASE
              WHEN raw_app_meta_data->>'company_id'
                   ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
              THEN (raw_app_meta_data->>'company_id')::uuid
              ELSE NULL
            END
       FROM auth.users WHERE id = (select auth.uid())),
    (SELECT CASE
              WHEN raw_user_meta_data->>'company_id'
                   ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
              THEN (raw_user_meta_data->>'company_id')::uuid
              ELSE NULL
            END
       FROM auth.users WHERE id = (select auth.uid()))
  );
$$;

ALTER FUNCTION internhub.current_company_id() OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 4. Re-run backfill (idempotent — only touches out-of-sync rows)
--    This is the same backfill from 0013, repeated here so it definitely
--    runs even if 0013 was applied partially.
-- ----------------------------------------------------------------------------

-- 4a. university_id
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

-- 4b. department_id
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

-- 4c. company_id
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

-- 4d. role (re-assert)
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
-- 5. BONUS: clear any INVALID metadata values (empty strings, garbage) that
--    might have been written by older code paths. These are the values that
--    would make the OLD (0013) functions throw. We delete the key from the
--    jsonb so the function returns NULL instead of throwing.
-- ----------------------------------------------------------------------------
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data - 'university_id'
WHERE raw_app_meta_data ? 'university_id'
  AND NOT (raw_app_meta_data->>'university_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$');

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'university_id'
WHERE raw_user_meta_data ? 'university_id'
  AND NOT (raw_user_meta_data->>'university_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$');

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data - 'department_id'
WHERE raw_app_meta_data ? 'department_id'
  AND NOT (raw_app_meta_data->>'department_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$');

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'department_id'
WHERE raw_user_meta_data ? 'department_id'
  AND NOT (raw_user_meta_data->>'department_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$');

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data - 'company_id'
WHERE raw_app_meta_data ? 'company_id'
  AND NOT (raw_app_meta_data->>'company_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$');

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'company_id'
WHERE raw_user_meta_data ? 'company_id'
  AND NOT (raw_user_meta_data->>'company_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$');

-- ----------------------------------------------------------------------------
-- 6. Diagnostic — after this migration, all counts should be 0
-- ----------------------------------------------------------------------------
SELECT
  -- Users with profiles.university_id set but app_metadata missing/stale
  (SELECT count(*) FROM auth.users u
     JOIN public.profiles p ON p.user_id = u.id
    WHERE p.university_id IS NOT NULL
      AND COALESCE(u.raw_app_meta_data->>'university_id', '') <> p.university_id::text)
                                                              AS app_meta_uni_out_of_sync,
  -- Users with invalid university_id in app_metadata (should be 0 after cleanup)
  (SELECT count(*) FROM auth.users
    WHERE raw_app_meta_data ? 'university_id'
      AND NOT (raw_app_meta_data->>'university_id'
               ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'))
                                                              AS app_meta_uni_invalid,
  -- Users with invalid university_id in user_metadata
  (SELECT count(*) FROM auth.users
    WHERE raw_user_meta_data ? 'university_id'
      AND NOT (raw_user_meta_data->>'university_id'
               ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'))
                                                              AS user_meta_uni_invalid,
  -- University admins who would get NULL from current_university_id()
  (SELECT count(*) FROM auth.users u
     JOIN public.profiles p ON p.user_id = u.id
    WHERE p.role = 'university_admin'
      AND COALESCE(u.raw_app_meta_data->>'university_id', '') = ''
      AND COALESCE(u.raw_user_meta_data->>'university_id', '') = '')
                                                              AS uni_admins_with_no_uni_in_metadata,
  -- Trigger should still be in place
  (SELECT count(*) FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'profiles'
      AND trigger_name = 'profiles_sync_auth_metadata')        AS trigger_exists;
