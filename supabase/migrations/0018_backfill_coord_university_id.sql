-- ============================================================================
-- InternHub.pk — 0018 Backfill coordinators' university_id from auth.users
-- ----------------------------------------------------------------------------
-- PROBLEM
--   On the university admin → coordinators page:
--     • Deactivate button silently fails (UPDATE returns success with 0 rows)
--     • Department dropdown assignment silently fails (same root cause)
--     • "Show inactive" toggle appears to do nothing
--
--   Root cause: RLS UPDATE policy on `profiles` requires
--     `university_id = internhub.current_university_id()`
--   in both USING and WITH CHECK. If the coordinator's profile has
--   `university_id IS NULL`, BOTH clauses evaluate to NULL (not true), so
--   the UPDATE silently affects 0 rows. The admin can still SELECT the
--   coordinator (because SELECT also requires the same condition) — but
--   ONLY if the admin's own `current_university_id()` returns NULL too,
--   in which case the SELECT-ALL-with-NULL-match returns every row whose
--   university_id IS NULL. That's why the admin SEES the coordinator but
--   cannot UPDATE them.
--
--   (This is a classic SQL NULL-equality footgun: `NULL = NULL` is NULL,
--    not true. RLS treats NULL as "not allowed", so the admin can see
--    rows but not modify them.)
--
-- FIX
--   1. Backfill profiles.university_id for every coordinator whose
--      university_id IS NULL but whose auth.users metadata carries a
--      valid (FK-respecting) university_id. Both user_metadata AND
--      app_metadata are checked.
--   2. Diagnostic surfaces any coordinators that STILL have NULL
--      university_id after the backfill — these are the ones whose
--      auth.users metadata is also missing/invalid, and need manual
--      cleanup (the admin should re-create the coordinator or set the
--      university_id directly via SQL).
--   3. Reload PostgREST schema cache so any prior metadata changes
--      (from 0014/0016) are guaranteed to be visible to the API.
--
-- IDEMPOTENT
--   Conditional UPDATEs (only touch rows where university_id IS NULL).
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
--    can SEE (because their own university_id is also NULL — see the
--    comment at the top) but CANNOT update (because RLS WITH CHECK
--    fails on `NULL = current_university_id()`).
--
--    To fix each row: either set a real university_id on their profile
--    directly (via SQL), or re-create the coordinator through the
--    /api/admin/create-user flow with the correct university_id in
--    both user_metadata and app_metadata.
-- ----------------------------------------------------------------------------
SELECT
  p.user_id,
  p.email,
  p.role,
  p.university_id                                  AS profile_university_id,
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
-- 4. Reload PostgREST schema cache so any function body changes from
--    prior migrations (0013/0014/0016) are guaranteed to be live.
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
