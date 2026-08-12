-- ============================================================================
-- InternHub.pk — 0019 Backfill + diagnostic for NULL university_id profiles
-- ----------------------------------------------------------------------------
-- PROBLEM
--   After the previous migrations, some coordinators (especially ones
--   created via /api/admin/create-user before the verify-and-fix step was
--   added) may still have profiles.university_id = NULL even though their
--   auth.users metadata carries a valid university_id.
--
--   Symptom: university admin can see the coordinator in the list (because
--   RLS SELECT evaluates `university_id = current_university_id()` — if
--   both sides are NULL the result is NULL = not allowed, so the admin
--   actually CANNOT see them — they appear "missing"). The admin cannot
--   deactivate them or change their department (RLS UPDATE USING/WITH
--   CHECK fails the same way).
--
--   Also: this script surfaces any coordinators whose auth.users metadata
--   is ALSO missing university_id — these need manual cleanup.
--
-- IDEMPOTENT
--   Conditional UPDATEs only (touch rows where university_id IS NULL).
--   Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Backfill from auth.users raw_user_meta_data (FK-safe — only write
--    UUIDs that actually exist in `universities`).
-- ----------------------------------------------------------------------------
UPDATE public.profiles p
SET
  university_id = sub.university_id,
  updated_at    = now()
FROM (
  SELECT
    au.id  AS user_id,
    u.id   AS university_id
  FROM auth.users au
  JOIN public.universities u
    ON u.id::text = au.raw_user_meta_data->>'university_id'
  WHERE au.raw_user_meta_data->>'university_id'
        ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
) sub
WHERE p.user_id = sub.user_id
  AND p.university_id IS NULL
  AND p.role IN ('department_coordinator','faculty_supervisor','student','university_admin');

-- ----------------------------------------------------------------------------
-- 2. Backfill from auth.users raw_app_meta_data (covers accounts created
--    before user_metadata was reliably populated).
-- ----------------------------------------------------------------------------
UPDATE public.profiles p
SET
  university_id = sub.university_id,
  updated_at    = now()
FROM (
  SELECT
    au.id  AS user_id,
    u.id   AS university_id
  FROM auth.users au
  JOIN public.universities u
    ON u.id::text = au.raw_app_meta_data->>'university_id'
  WHERE au.raw_app_meta_data->>'university_id'
        ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
) sub
WHERE p.user_id = sub.user_id
  AND p.university_id IS NULL
  AND p.role IN ('department_coordinator','faculty_supervisor','student','university_admin');

COMMIT;

-- ----------------------------------------------------------------------------
-- 3. Diagnostic — coordinators who STILL have NULL university_id after
--    the backfill. Each row here is a coordinator the university admin
--    CANNOT see or update. To fix:
--      a) Find their correct university_id (e.g. by asking the admin who
--         created them).
--      b) UPDATE public.profiles SET university_id = '<uuid>' WHERE user_id = '<uuid>';
--    OR delete the coordinator and re-create them through the dashboard
--    (the create-user flow now verifies and fixes the profile).
-- ----------------------------------------------------------------------------
SELECT
  p.user_id,
  p.email,
  p.role,
  p.university_id                                  AS profile_university_id,
  p.department_id                                  AS profile_department_id,
  p.is_active,
  au.raw_user_meta_data->>'university_id'          AS user_meta_uni_id,
  au.raw_app_meta_data->>'university_id'           AS app_meta_uni_id,
  au.raw_user_meta_data->>'role'                   AS user_meta_role,
  au.raw_app_meta_data->>'role'                    AS app_meta_role,
  au.created_at
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
WHERE p.university_id IS NULL
  AND p.role IN ('department_coordinator','faculty_supervisor','student','university_admin')
ORDER BY p.role, p.email;

-- ----------------------------------------------------------------------------
-- 4. Diagnostic — for each university admin, show their university_id
--    (from auth.users metadata) and the count of coordinators they
--    SHOULD be able to see. If the admin's university_id is NULL, they
--    can't see ANY coordinators — they need to be re-assigned to a
--    university.
-- ----------------------------------------------------------------------------
SELECT
  p.user_id,
  p.email,
  p.university_id                                  AS profile_university_id,
  au.raw_app_meta_data->>'university_id'           AS app_meta_uni_id,
  au.raw_user_meta_data->>'university_id'          AS user_meta_uni_id,
  (
    SELECT count(*)::int
    FROM public.profiles c
    WHERE c.role = 'department_coordinator'
      AND c.university_id = p.university_id
  )                                               AS visible_coordinators
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.user_id
WHERE p.role = 'university_admin'
ORDER BY p.email;

-- ----------------------------------------------------------------------------
-- 5. Reload PostgREST schema cache so any function body changes from
--    prior migrations (0013/0014/0016/0018) are guaranteed to be live.
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
