-- ============================================================================
-- InternHub.pk — 0022 AGGRESSIVE backfill of profiles.university_id
-- ----------------------------------------------------------------------------
-- PROBLEM
--   The on_auth_user_created trigger (internhub_handle_new_user) was fixed in
--   migration 0021 to write university_id from auth metadata into the profiles
--   row. But existing accounts created BEFORE 0021 was applied still have
--   profiles.university_id = NULL.
--
--   This causes two visible bugs:
--     1. University admin's RLS-scoped SELECT on profiles returns 0 rows for
--        coordinators with NULL university_id — so newly-created coordinators
--        don't appear in the dashboard list.
--     2. UPDATE on those rows is silently rejected by RLS WITH CHECK
--        (`university_id = current_university_id()` evaluates to NULL when
--        the row's university_id is NULL), so PATCH /api/coordinators/[id]
--        returns 500 with "0 rows affected".
--
--   The PATCH endpoint has been rewritten (v2) to use the service role client
--   and HEAL NULL university_id on each successful update. But for rows that
--   are never touched by a PATCH (e.g. a coordinator that the admin never
--   reassigns), we need a one-shot backfill.
--
-- STRATEGIES (in priority order — each strategy only touches rows still NULL
-- after the previous one)
--   A. Copy from auth.users.raw_app_meta_data (if it has a valid UUID that
--      matches a real university).
--   B. Copy from auth.users.raw_user_meta_data (same UUID validation).
--   C. Lookup via profiles.department_id → departments.university_id (only
--      if the dept's university_id is not NULL).
--   D. Match by email domain → universities.domain (case-insensitive,
--      substring match: profile.email LIKE '%@' || universities.domain).
--      This handles legacy accounts whose department_id is also NULL but
--      whose email clearly belongs to a known university.
--
-- IDEMPOTENT
--   Each UPDATE only touches rows where university_id IS NULL, so re-running
--   is safe. The diagnostic at the end shows any rows that STILL have NULL
--   university_id after all four strategies — these need manual cleanup
--   (e.g. assign a university_id by hand via SQL or the super admin UI).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Strategy A: backfill from auth.users.raw_app_meta_data
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
-- Strategy B: backfill from auth.users.raw_user_meta_data
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
-- Strategy C: backfill via department_id → departments.university_id
-- ----------------------------------------------------------------------------
UPDATE public.profiles p
SET
  university_id = d.university_id,
  updated_at    = now()
FROM public.departments d
WHERE p.department_id = d.id
  AND d.university_id IS NOT NULL
  AND p.university_id IS NULL
  AND p.role IN ('department_coordinator','faculty_supervisor','student',
                 'university_admin');

-- ----------------------------------------------------------------------------
-- Strategy D: backfill by email domain match against universities.domain
-- (case-insensitive, suffix match). Handles legacy accounts that have neither
-- auth metadata nor a department_id but whose email clearly belongs to a
-- known university.
-- ----------------------------------------------------------------------------
UPDATE public.profiles p
SET
  university_id = u.id,
  updated_at    = now()
FROM public.universities u
WHERE u.domain IS NOT NULL
  AND u.domain <> ''
  AND lower(p.email) LIKE '%@' || lower(u.domain)
  AND p.university_id IS NULL
  AND p.role IN ('department_coordinator','faculty_supervisor','student',
                 'university_admin');

-- ----------------------------------------------------------------------------
-- Sync the freshly-backfilled university_id back into auth.users metadata
-- so the RLS helper functions (current_university_id, current_department_id)
-- return the right value for these users.
-- ----------------------------------------------------------------------------
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

COMMIT;

-- ============================================================================
-- DIAGNOSTIC — list any profiles that STILL have NULL university_id after
-- all four backfill strategies. These accounts need manual cleanup:
--   UPDATE public.profiles SET university_id = '<uuid>' WHERE user_id = '<uuid>';
-- OR delete the account via the super admin UI and re-create it.
-- ============================================================================
SELECT
  p.user_id,
  p.email,
  p.role,
  p.department_id    AS profile_dept,
  au.raw_user_meta_data->>'university_id'  AS user_meta_uni,
  au.raw_app_meta_data->>'university_id'   AS app_meta_uni
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
WHERE p.university_id IS NULL
  AND p.role IN ('department_coordinator','faculty_supervisor','student',
                 'university_admin')
ORDER BY p.role, p.email;

-- Reload PostgREST schema cache (harmless if no schema changes)
NOTIFY pgrst, 'reload schema';
