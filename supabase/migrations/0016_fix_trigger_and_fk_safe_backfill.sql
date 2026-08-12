-- ============================================================================
-- InternHub.pk — 0016 Fix new-user trigger + FK-safe tenant-id backfill
-- ----------------------------------------------------------------------------
-- PROBLEM (root cause of "coordinator not appearing in university admin"):
--   The `internhub_handle_new_user()` trigger creates a `profiles` row when a
--   new auth user is created, but it only copies a few fields from
--   `raw_user_meta_data` (full_name, first_name, last_name, avatar_url, phone,
--   role). It does NOT copy `university_id`, `department_id`, `company_id`, or
--   `program_id`. So when a university_admin creates a coordinator (via
--   /api/admin/create-user with user_metadata.university_id set), the trigger
--   fires and inserts a profiles row with university_id = NULL. The subsequent
--   explicit INSERT from the API then no-ops (ON CONFLICT DO NOTHING), so the
--   coordinator's profile stays university_id = NULL forever. University
--   admin's RLS scoping filters by university_id → no rows match → coordinator
--   is invisible.
--
-- PROBLEM (FK violation when first attempting this fix):
--   The original backfill blindly trusted whatever university_id was in
--   auth.users metadata. Some auth users carry a university_id that doesn't
--   exist in `universities` (stale UUID from before the universities row was
--   created, or a typo, or a deleted university). Writing that to profiles
--   violates `profiles_university_id_fkey` → whole migration aborts. This
--   migration validates every UUID against its parent table before writing
--   it — stale UUIDs become NULL instead of raising FK violations.
--
-- WHAT THIS MIGRATION DOES
--   1. Rewrites `internhub_handle_new_user()` to also propagate
--      university_id, department_id, company_id, program_id from
--      raw_user_meta_data / raw_app_meta_data → profiles. Every UUID is
--      validated against its parent table first; bogus UUIDs become NULL.
--   2. One-time backfill: repair legacy profiles that have NULL
--      university_id but whose auth.users row DOES carry a valid
--      (FK-respecting) university_id in metadata. Stale/bogus UUIDs are
--      skipped (and reported by the diagnostic in step 4).
--   3. Diagnostic SELECT surfaces every auth user whose metadata carries a
--      university_id that doesn't exist in `universities` — these are the
--      orphans that need manual cleanup.
--
-- NOTE
--   This migration does NOT add the programs.supervisor_id column — that's
--   handled by 0015_program_default_supervisor.sql (column named
--   `default_faculty_supervisor_id`). Don't run my older
--   0013_program_supervisor_and_trigger_fix.sql — it conflicts with the
--   canonical 0013_metadata_for_tenant_ids.sql on the remote.
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION + conditional UPDATEs (only touch rows where
--   university_id IS NULL). Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Rewrite the new-user trigger to propagate tenant fields from user_metadata.
--    DEFENSIVE: every UUID is validated against its parent table. Stale or
--    bogus UUIDs in metadata become NULL instead of raising FK violations.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role text;
  assigned_role user_role;
  meta_uni text;
  meta_dept text;
  meta_company text;
  meta_program text;
  v_uni uuid;
  v_dept uuid;
  v_company uuid;
  v_program uuid;
BEGIN
  meta_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_app_meta_data->>'role',
    'pending_assignment'
  );
  assigned_role := CASE
    WHEN meta_role = 'super_admin' THEN 'super_admin'
    WHEN meta_role = 'university_admin' THEN 'university_admin'
    WHEN meta_role = 'department_coordinator' THEN 'department_coordinator'
    WHEN meta_role = 'faculty_supervisor' THEN 'faculty_supervisor'
    WHEN meta_role = 'student' THEN 'student'
    WHEN meta_role = 'company_hr' THEN 'company_hr'
    WHEN meta_role = 'site_supervisor' THEN 'site_supervisor'
    WHEN meta_role = 'external_evaluator' THEN 'external_evaluator'
    ELSE 'pending_assignment'
  END;

  -- Tenant fields: read from user_metadata first, fall back to app_metadata.
  meta_uni      := COALESCE(NEW.raw_user_meta_data->>'university_id',     NEW.raw_app_meta_data->>'university_id');
  meta_dept     := COALESCE(NEW.raw_user_meta_data->>'department_id',     NEW.raw_app_meta_data->>'department_id');
  meta_company  := COALESCE(NEW.raw_user_meta_data->>'company_id',        NEW.raw_app_meta_data->>'company_id');
  meta_program  := COALESCE(NEW.raw_user_meta_data->>'program_id',        NEW.raw_app_meta_data->>'program_id');

  -- Validate each UUID against its parent table. Anything that doesn't match
  -- becomes NULL — no FK violations, no failed user creation.
  v_uni := NULL;
  IF meta_uni ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v_uni FROM public.universities WHERE id = meta_uni::uuid;
  END IF;

  v_dept := NULL;
  IF meta_dept ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v_dept FROM public.departments WHERE id = meta_dept::uuid;
  END IF;

  v_company := NULL;
  IF meta_company ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v_company FROM public.companies WHERE id = meta_company::uuid;
  END IF;

  v_program := NULL;
  IF meta_program ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v_program FROM public.programs WHERE id = meta_program::uuid;
  END IF;

  INSERT INTO public.profiles (
    user_id, email, full_name, first_name, last_name, role,
    avatar_url, phone, status, is_active,
    university_id, department_id, company_id, program_id
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    assigned_role,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN assigned_role = 'pending_assignment' THEN 'pending' ELSE 'active' END,
    true,
    v_uni,
    v_dept,
    v_company,
    v_program
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name     = EXCLUDED.full_name,
    first_name    = EXCLUDED.first_name,
    last_name     = EXCLUDED.last_name,
    role          = EXCLUDED.role,
    avatar_url    = EXCLUDED.avatar_url,
    phone         = EXCLUDED.phone,
    status        = EXCLUDED.status,
    -- Only overwrite tenant fields if the incoming value is non-NULL
    -- (avoids wiping out a previously-set university_id when the trigger
    -- re-runs for some reason without tenant metadata).
    university_id = COALESCE(EXCLUDED.university_id, profiles.university_id),
    department_id = COALESCE(EXCLUDED.department_id, profiles.department_id),
    company_id    = COALESCE(EXCLUDED.company_id,    profiles.company_id),
    program_id    = COALESCE(EXCLUDED.program_id,    profiles.program_id),
    updated_at    = now();

  RETURN NEW;
END;
$$;

ALTER FUNCTION internhub_handle_new_user() OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 2. One-time backfill: repair legacy profiles that have NULL university_id
--    but whose auth.users row DOES carry a valid (FK-respecting) university_id
--    in user_metadata. The INNER JOIN against `universities` is the key guard
--    — any auth user whose metadata carries a stale/bogus UUID is silently
--    skipped here (they'll be surfaced by the diagnostic in step 4).
-- ----------------------------------------------------------------------------
UPDATE public.profiles p
SET
  university_id = sub.university_id,
  department_id = COALESCE(p.department_id, sub.department_id),
  company_id    = COALESCE(p.company_id,    sub.company_id),
  program_id    = COALESCE(p.program_id,    sub.program_id),
  updated_at    = now()
FROM (
  SELECT
    au.id        AS user_id,
    u.id         AS university_id,
    CASE
      WHEN (au.raw_user_meta_data->>'department_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (SELECT id FROM public.departments WHERE id = (au.raw_user_meta_data->>'department_id')::uuid)
      ELSE NULL
    END AS department_id,
    CASE
      WHEN (au.raw_user_meta_data->>'company_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (SELECT id FROM public.companies WHERE id = (au.raw_user_meta_data->>'company_id')::uuid)
      ELSE NULL
    END AS company_id,
    CASE
      WHEN (au.raw_user_meta_data->>'program_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (SELECT id FROM public.programs WHERE id = (au.raw_user_meta_data->>'program_id')::uuid)
      ELSE NULL
    END AS program_id
  FROM auth.users au
  JOIN public.universities u
    ON u.id::text = au.raw_user_meta_data->>'university_id'
  WHERE au.raw_user_meta_data->>'university_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
) sub
WHERE p.user_id = sub.user_id
  AND p.university_id IS NULL;

-- Same backfill but using app_metadata as the source (covers accounts created
-- before the user_metadata fix went live).
UPDATE public.profiles p
SET
  university_id = sub.university_id,
  department_id = COALESCE(p.department_id, sub.department_id),
  company_id    = COALESCE(p.company_id,    sub.company_id),
  program_id    = COALESCE(p.program_id,    sub.program_id),
  updated_at    = now()
FROM (
  SELECT
    au.id        AS user_id,
    u.id         AS university_id,
    CASE
      WHEN (au.raw_app_meta_data->>'department_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (SELECT id FROM public.departments WHERE id = (au.raw_app_meta_data->>'department_id')::uuid)
      ELSE NULL
    END AS department_id,
    CASE
      WHEN (au.raw_app_meta_data->>'company_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (SELECT id FROM public.companies WHERE id = (au.raw_app_meta_data->>'company_id')::uuid)
      ELSE NULL
    END AS company_id,
    CASE
      WHEN (au.raw_app_meta_data->>'program_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN (SELECT id FROM public.programs WHERE id = (au.raw_app_meta_data->>'program_id')::uuid)
      ELSE NULL
    END AS program_id
  FROM auth.users au
  JOIN public.universities u
    ON u.id::text = au.raw_app_meta_data->>'university_id'
  WHERE au.raw_app_meta_data->>'university_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
) sub
WHERE p.user_id = sub.user_id
  AND p.university_id IS NULL;

COMMIT;

-- ----------------------------------------------------------------------------
-- 3. Diagnostic A — should show 0 orphans after the backfill.
--    Rows here are profiles that SHOULD have had a university_id attached but
--    didn't (because the metadata UUID didn't exist in `universities`).
-- ----------------------------------------------------------------------------
SELECT
  COUNT(*) FILTER (
    WHERE p.university_id IS NULL
      AND p.role IN ('university_admin','department_coordinator','faculty_supervisor','student')
      AND (
        (au.raw_user_meta_data->>'university_id') IS NOT NULL
        OR (au.raw_app_meta_data->>'university_id') IS NOT NULL
      )
  ) AS orphan_tenant_profiles
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.user_id;

-- ----------------------------------------------------------------------------
-- 4. Diagnostic B — the actual orphan auth users. Each row here is a user
--    whose auth.users metadata carries a university_id that DOES NOT exist
--    in `universities`. These are the rows blocking the old migration and
--    hiding coordinators from the university admin dashboard.
--
--    To fix each row, EITHER:
--      (a) Create a matching `universities` row with that id, OR
--      (b) Update auth.users metadata (and the profiles row, if any) to
--          point to a real university_id.
-- ----------------------------------------------------------------------------
SELECT
  au.id                                        AS auth_user_id,
  au.email,
  au.raw_user_meta_data->>'role'               AS user_meta_role,
  au.raw_user_meta_data->>'university_id'      AS user_meta_uni_id,
  au.raw_app_meta_data->>'university_id'       AS app_meta_uni_id,
  au.created_at
FROM auth.users au
WHERE
  (
    (au.raw_user_meta_data->>'university_id') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.universities u
      WHERE u.id::text = au.raw_user_meta_data->>'university_id'
    )
  )
  OR
  (
    (au.raw_app_meta_data->>'university_id') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.universities u
      WHERE u.id::text = au.raw_app_meta_data->>'university_id'
    )
  )
ORDER BY au.created_at;

-- ----------------------------------------------------------------------------
-- 5. Reload PostgREST schema cache so the new function body is picked up
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
