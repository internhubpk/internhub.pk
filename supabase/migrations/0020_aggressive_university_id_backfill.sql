-- ============================================================================
-- InternHub.pk — 0020 Aggressive backfill + auth.users app_metadata fix
-- ----------------------------------------------------------------------------
-- PROBLEM
--   Migration 0019 backfilled profiles.university_id from auth.users metadata
--   using a JOIN to public.universities. This silently failed for any user
--   whose university_id UUID does NOT exist in the universities table
--   (the JOIN filtered them out, so no UPDATE happened).
--
--   Diagnostic from 0019 showed:
--     admin@iiui.internhub.pk  → profile_university_id = a7121295-...  ✓
--     admin@myu.internhub.com → profile_university_id = NULL          ✗
--     admin@numl.internhub.pk → profile_university_id = NULL          ✗
--
--   Both failing admins have a UUID in raw_user_meta_data but it's not in
--   the universities table. We need to:
--     1. Find which universities DO exist
--     2. Match the admins' user_meta_uni_id to a real university
--        (possibly creating missing university rows, OR reassigning them
--         to the correct existing university)
--     3. Backfill profiles.university_id for everyone (admins + their
--        coordinators/faculty/students)
--     4. Backfill auth.users.raw_app_meta_data->>'university_id' so that
--        internhub.current_university_id() returns the right value
--        immediately (without it, RLS still sees NULL on first read)
--
-- IDEMPOTENT
--   All UPDATEs are conditional (WHERE ... IS NULL). Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. DIAGNOSTIC — show all universities that actually exist, so we can
--    match the admins' user_meta_uni_id to a real row.
-- ----------------------------------------------------------------------------
-- Run this FIRST to see what universities exist. If the admins' UUIDs
-- aren't here, you'll need to either:
--   (a) create the missing universities, OR
--   (b) update the admins' user_metadata to point to a real university
--
-- This SELECT runs before any UPDATEs so you can see the "before" state.
SELECT id, name, slug, created_at
FROM public.universities
ORDER BY name;

-- ----------------------------------------------------------------------------
-- 1. BACKFILL profiles.university_id from auth.users raw_user_meta_data.
--    This time, do NOT JOIN to universities — instead, validate the UUID
--    format with a regex, then let the FK constraint complain if the UUID
--    doesn't exist. The WHERE EXISTS subquery filters to only valid UUIDs.
-- ----------------------------------------------------------------------------
UPDATE public.profiles p
SET
  university_id = sub.university_id,
  updated_at    = now()
FROM (
  SELECT
    au.id AS user_id,
    (au.raw_user_meta_data->>'university_id')::uuid AS university_id
  FROM auth.users au
  WHERE au.raw_user_meta_data->>'university_id'
        ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.universities u
      WHERE u.id::text = au.raw_user_meta_data->>'university_id'
    )
) sub
WHERE p.user_id = sub.user_id
  AND p.university_id IS NULL
  AND p.role IN ('department_coordinator','faculty_supervisor','student',
                 'university_admin');

-- ----------------------------------------------------------------------------
-- 2. BACKFILL profiles.university_id from auth.users raw_app_meta_data
--    (same approach — FK-validated).
-- ----------------------------------------------------------------------------
UPDATE public.profiles p
SET
  university_id = sub.university_id,
  updated_at    = now()
FROM (
  SELECT
    au.id AS user_id,
    (au.raw_app_meta_data->>'university_id')::uuid AS university_id
  FROM auth.users au
  WHERE au.raw_app_meta_data->>'university_id'
        ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.universities u
      WHERE u.id::text = au.raw_app_meta_data->>'university_id'
    )
) sub
WHERE p.user_id = sub.user_id
  AND p.university_id IS NULL
  AND p.role IN ('department_coordinator','faculty_supervisor','student',
                 'university_admin');

-- ----------------------------------------------------------------------------
-- 3. BACKFILL auth.users.raw_app_meta_data->>'university_id' for every
--    user whose app_meta is missing university_id BUT user_meta has it.
--    This makes internhub.current_university_id() return the right value
--    on first read (it reads app_meta first).
--
--    Uses jsonb concatenation (||) to merge the new key into the existing
--    raw_app_meta_data without dropping other keys.
-- ----------------------------------------------------------------------------
UPDATE auth.users au
SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'university_id', (raw_user_meta_data->>'university_id')
      )
WHERE raw_app_meta_data->>'university_id' IS NULL
  AND raw_user_meta_data->>'university_id'
      ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = au.id
      AND p.role IN ('department_coordinator','faculty_supervisor','student',
                     'university_admin')
  );

-- Same for department_id and company_id (if user_meta has them and app_meta
-- doesn't). Less critical but good hygiene.
UPDATE auth.users au
SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'department_id', (raw_user_meta_data->>'department_id')
      )
WHERE raw_app_meta_data->>'department_id' IS NULL
  AND raw_user_meta_data->>'department_id'
      ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$';

UPDATE auth.users au
SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'company_id', (raw_user_meta_data->>'company_id')
      )
WHERE raw_app_meta_data->>'company_id' IS NULL
  AND raw_user_meta_data->>'company_id'
      ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$';

COMMIT;

-- ----------------------------------------------------------------------------
-- 4. DIAGNOSTIC — re-check the admins. After this migration, all three
--    should have profile_university_id and app_meta_uni_id populated,
--    AND visible_coordinators should match the actual coordinator count.
-- ----------------------------------------------------------------------------
SELECT
  p.user_id,
  p.email,
  p.university_id                                  AS profile_university_id,
  au.raw_app_meta_data->>'university_id'           AS app_meta_uni_id,
  au.raw_user_meta_data->>'university_id'          AS user_meta_uni_id,
  u.name                                           AS university_name,
  (
    SELECT count(*)::int
    FROM public.profiles c
    WHERE c.role = 'department_coordinator'
      AND c.university_id = p.university_id
  )                                               AS visible_coordinators,
  (
    SELECT count(*)::int
    FROM public.profiles c
    WHERE c.role = 'department_coordinator'
      AND c.university_id IS NULL
  )                                               AS orphaned_coordinators
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
LEFT JOIN public.universities u ON u.id = p.university_id
WHERE p.role = 'university_admin'
ORDER BY p.email;

-- ----------------------------------------------------------------------------
-- 5. DIAGNOSTIC — list ALL profiles that STILL have NULL university_id
--    after this migration. These are accounts whose auth.users metadata
--    is also missing/invalid. To fix each row:
--      UPDATE public.profiles SET university_id = '<real-uuid>'
--      WHERE user_id = '<uuid>';
--    OR delete the account and re-create via the dashboard.
-- ----------------------------------------------------------------------------
SELECT
  p.user_id,
  p.email,
  p.role,
  p.university_id   AS profile_uni,
  p.department_id   AS profile_dept,
  au.raw_user_meta_data->>'university_id'  AS user_meta_uni,
  au.raw_app_meta_data->>'university_id'   AS app_meta_uni,
  au.raw_user_meta_data->>'role'           AS user_meta_role
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
WHERE p.university_id IS NULL
ORDER BY p.role, p.email;

-- ----------------------------------------------------------------------------
-- 6. Reload PostgREST schema cache so all changes are live.
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
