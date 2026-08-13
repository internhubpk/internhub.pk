-- 0039_supervisors_unique_user_type.sql
--
-- Adds a UNIQUE constraint on supervisors(user_id, type) so that
-- /api/admin/create-user can safely use `.upsert(..., { onConflict: "user_id,type" })`
-- when creating faculty_supervisor / site_supervisor / external_evaluator
-- accounts. Without this constraint, the upsert errors with
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification", which would prevent the supervisor row from being
-- created when a program is created.
--
-- Before adding the constraint, deduplicate any existing rows that share
-- the same (user_id, type) — keep the most recently updated one.

-- 1) Deduplicate: keep the latest row per (user_id, type) by updated_at,
--    then created_at, then id. Delete the rest.
DELETE FROM supervisors s
USING supervisors s_keep
WHERE s.user_id = s_keep.user_id
  AND s.type = s_keep.type
  AND s.id <> s_keep.id
  AND (
    -- s_keep is "newer" than s by this ordering — keep s_keep, delete s.
    s.updated_at < s_keep.updated_at
    OR (s.updated_at = s_keep.updated_at AND s.created_at < s_keep.created_at)
    OR (s.updated_at = s_keep.updated_at AND s.created_at = s_keep.created_at AND s.id < s_keep.id)
  );

-- 2) Create the unique index. If a partial unique index already exists
--    from an older migration, this is a no-op (IF NOT EXISTS).
CREATE UNIQUE INDEX IF NOT EXISTS supervisors_user_id_type_key
  ON supervisors(user_id, type);

-- 3) Backfill: for any profile with role = 'faculty_supervisor' /
--    'site_supervisor' / 'external_evaluator' that does NOT have a row
--    in supervisors, create one. This retroactively fixes accounts that
--    were created before /api/admin/create-user was patched to insert
--    into supervisors (e.g., supervisor accounts created via the program
--    creation flow before this fix). Service-role only — RLS-bypass.
INSERT INTO supervisors (
  user_id, type, university_id, department_id, company_id,
  is_active, first_name, last_name, email, phone,
  created_at, updated_at
)
SELECT
  p.user_id,
  CASE p.role
    WHEN 'faculty_supervisor' THEN 'faculty'::supervisor_type
    WHEN 'site_supervisor'    THEN 'site'::supervisor_type
    WHEN 'external_evaluator' THEN 'external'::supervisor_type
  END,
  p.university_id,
  p.department_id,
  p.company_id,
  COALESCE(p.is_active, true),
  p.first_name,
  p.last_name,
  p.email,
  p.phone,
  COALESCE(p.updated_at, now()),
  now()
FROM profiles p
WHERE p.role IN ('faculty_supervisor', 'site_supervisor', 'external_evaluator')
  AND NOT EXISTS (
    SELECT 1 FROM supervisors s
    WHERE s.user_id = p.user_id
      AND s.type = CASE p.role
        WHEN 'faculty_supervisor' THEN 'faculty'::supervisor_type
        WHEN 'site_supervisor'    THEN 'site'::supervisor_type
        WHEN 'external_evaluator' THEN 'external'::supervisor_type
      END
  )
ON CONFLICT (user_id, type) DO NOTHING;
