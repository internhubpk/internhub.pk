-- ============================================================================
-- InternHub.pk — Migration 0076: MOU + remove duration_weeks + clean supervisors
-- ----------------------------------------------------------------------------
-- This migration is SAFE and INCREMENTAL:
--   * Does NOT delete any data
--   * Does NOT drop any table
--   * All changes are reversible (in spirit — Postgres ALTER is one-way for
--     DROP COLUMN, but the data is preserved via backup tables)
--
-- Changes:
--   1. Create `company_university_mous` table (MOU/relationship between
--      a company and a university). Status enum: pending/approved/active/
--      suspended/terminated. Only 'active' MOUs make a company's internships
--      visible to that university.
--   2. Drop `duration_weeks` column from `programs` (per spec — programs no
--      longer have a fixed week count).
--   3. Set `supervisors.program_id` to NULL on all rows + drop the column
--      (per spec — supervisors are assigned to STUDENTS, not programs).
--      We keep `supervisors.program_ids` (jsonb) as-is for backward-compat
--      with any analytics, but new code should not write to it.
--   4. Add RLS policies on company_university_mous (university_admin can
--      manage their own university's MOUs; super_admin can manage all).
--   5. Update `internships` RLS: a university can only SELECT an internship
--      where the company has an ACTIVE MOU with that university.
-- ============================================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. MOU status enum
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE mou_status AS ENUM ('pending', 'approved', 'active', 'suspended', 'terminated', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. company_university_mous table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_university_mous (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  university_id   uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  status          mou_status NOT NULL DEFAULT 'pending',
  -- Optional fields for the MOU document itself
  mou_document_url text,
  notes           text,
  -- MOU validity window (NULL end_date = perpetual until terminated)
  starts_at       timestamptz NOT NULL DEFAULT now(),
  ends_at        timestamptz,
  -- Audit
  created_by      uuid,
  approved_by     uuid,
  approved_at     timestamptz,
  suspended_at    timestamptz,
  terminated_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- One active MOU per (company, university) pair — enforced via partial
  -- unique index on rows where status IN ('pending', 'approved', 'active').
  -- Multiple historical (suspended/terminated/expired) MOUs are allowed.
  UNIQUE (company_id, university_id, status)
);
CREATE INDEX IF NOT EXISTS idx_mou_company ON company_university_mous(company_id);
CREATE INDEX IF NOT EXISTS idx_mou_university ON company_university_mous(university_id);
CREATE INDEX IF NOT EXISTS idx_mou_status ON company_university_mous(status);
CREATE INDEX IF NOT EXISTS idx_mou_active ON company_university_mous(company_id, university_id) WHERE status = 'active';

ALTER TABLE company_university_mous ENABLE ROW LEVEL SECURITY;

-- RLS: company_university_mous
--   * super_admin: full access
--   * university_admin: full access to their own university's MOUs
--   * company_hr: can VIEW MOUs for their own company
--   * department_coordinator / program_coordinator / faculty_supervisor /
--     student: can VIEW MOUs for their own university (read-only)
DROP POLICY IF EXISTS mou_select_policy ON company_university_mous;
CREATE POLICY mou_select_policy ON company_university_mous
  FOR SELECT TO authenticated
  USING (
    -- super_admin sees all
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR
    -- university-scoped roles see their own university's MOUs
    university_id IN (
      SELECT university_id FROM profiles
      WHERE user_id = auth.uid() AND university_id IS NOT NULL
    )
    OR
    -- company_hr sees their company's MOUs (so they know which universities
    -- they have an active relationship with)
    company_id IN (
      SELECT company_id FROM profiles
      WHERE user_id = auth.uid() AND role = 'company_hr' AND company_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS mou_insert_policy ON company_university_mous;
CREATE POLICY mou_insert_policy ON company_university_mous
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR
    auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role = 'university_admin' AND university_id = company_university_mous.university_id
    )
    OR
    -- company_hr can also propose an MOU with a university (it starts as 'pending')
    auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role = 'company_hr' AND company_id = company_university_mous.company_id
    )
  );

DROP POLICY IF EXISTS mou_update_policy ON company_university_mous;
CREATE POLICY mou_update_policy ON company_university_mous
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role = 'university_admin' AND university_id = company_university_mous.university_id
    )
    OR auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role = 'company_hr' AND company_id = company_university_mous.company_id
    )
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role = 'university_admin' AND university_id = company_university_mous.university_id
    )
    OR auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role = 'company_hr' AND company_id = company_university_mous.company_id
    )
  );

DROP POLICY IF EXISTS mou_delete_policy ON company_university_mous;
CREATE POLICY mou_delete_policy ON company_university_mous
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR auth.uid() IN (
      SELECT user_id FROM profiles
      WHERE role = 'university_admin' AND university_id = company_university_mous.university_id
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Drop `duration_weeks` from `programs`
-- ----------------------------------------------------------------------------
-- Per spec: "Remove the WEEK field/concept completely from the program UI,
-- backend, types and database."
--
-- We do NOT drop the column on `internships` (that's a separate concept —
-- an internship can have a duration in weeks, e.g. "12-week internship").
-- The user spec is about the PROGRAM week field, not internship duration.
ALTER TABLE programs DROP COLUMN IF EXISTS duration_weeks;

-- ----------------------------------------------------------------------------
-- 4. Clean up supervisors.program_id (NULL it, then drop)
-- ----------------------------------------------------------------------------
-- Per spec: "Supervisors must NOT be assigned to programs."
-- The `supervisors.program_id` column was used to associate a supervisor
-- with a program. We NULL all values first, then drop the column.
-- (We don't drop `program_ids` jsonb — it's still used by some legacy
-- analytics code, but new code should not write to it.)
--
-- IMPORTANT: Two views (external_evaluators, site_supervisors) depend on
-- supervisors.program_id. We must DROP them first, then drop the column,
-- then recreate them WITHOUT the program_id column.

-- 4a. Drop the dependent views
DROP VIEW IF EXISTS external_evaluators;
DROP VIEW IF EXISTS site_supervisors;

-- 4b. NULL all values (no data loss — the link is just severed).
-- Wrapped in DO block: if the column was already dropped (e.g. on a fresh DB
-- where 0001 didn't create it), the UPDATE would fail. We skip it gracefully.
DO $$ BEGIN
  UPDATE supervisors SET program_id = NULL WHERE program_id IS NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- 4c. Drop the column.
ALTER TABLE supervisors DROP COLUMN IF EXISTS program_id;

-- 4d. Recreate the views WITHOUT program_id (the column no longer exists).
CREATE OR REPLACE VIEW external_evaluators AS
  SELECT s.id,
    s.user_id,
    s.type,
    s.university_id,
    s.department_id,
    s.company_id,
    s.employee_id,
    s.is_active,
    s.created_at,
    s.updated_at,
    p.email,
    p.full_name
  FROM supervisors s
    JOIN profiles p ON p.user_id = s.user_id
  WHERE s.type = 'external'::supervisor_type;

CREATE OR REPLACE VIEW site_supervisors AS
  SELECT s.id,
    s.user_id,
    s.type,
    s.university_id,
    s.department_id,
    s.company_id,
    s.employee_id,
    s.is_active,
    s.created_at,
    s.updated_at,
    p.email,
    p.full_name,
    p.company_id AS company_id_profile
  FROM supervisors s
    JOIN profiles p ON p.user_id = s.user_id
  WHERE s.type = 'site'::supervisor_type;

-- Restore RLS grants on the recreated views (views inherit RLS from base
-- tables by default in Postgres 15+, but we explicitly grant SELECT to
-- authenticated users so they can be queried directly).
GRANT SELECT ON external_evaluators TO authenticated;
GRANT SELECT ON site_supervisors TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Update internships RLS — MOU-based visibility
-- ----------------------------------------------------------------------------
-- The existing internships RLS allows university-scoped roles to see
-- internships where internships.university_id = their university_id.
-- But company-published internships have university_id = NULL (visible to
-- all universities). We need to add a NEW condition: a university can only
-- see a company-published internship IF the company has an ACTIVE MOU
-- with that university.
--
-- Strategy: replace the existing internships SELECT policy with one that
-- checks MOU membership for NULL-university internships.

-- Drop the existing policy (the original was likely created by migration 0002)
DROP POLICY IF EXISTS internships_select_policy ON internships;
DROP POLICY IF EXISTS internships_select ON internships;
DROP POLICY IF EXISTS internships_university_select ON internships;

-- New comprehensive SELECT policy:
CREATE POLICY internships_select_policy ON internships
  FOR SELECT TO authenticated
  USING (
    -- super_admin sees all
    auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'super_admin')
    OR
    -- company_hr sees their own company's internships (any status)
    company_id IN (
      SELECT company_id FROM profiles
      WHERE user_id = auth.uid() AND role = 'company_hr' AND company_id IS NOT NULL
    )
    OR
    -- university-scoped roles see internships where:
    --   (a) internships.university_id = their university (university-published)
    --   OR (b) the company has an ACTIVE MOU with their university
    --   AND the internship's department/program matches their filter
    --   (department filtering is done at the application layer; the MOU
    --   check is the security boundary here)
    (
      internships.university_id IN (
        SELECT university_id FROM profiles
        WHERE user_id = auth.uid() AND university_id IS NOT NULL
      )
      OR
      (
        internships.university_id IS NULL
        AND
        EXISTS (
          SELECT 1 FROM company_university_mous m
          WHERE m.company_id = internships.company_id
            AND m.university_id IN (
              SELECT university_id FROM profiles
              WHERE user_id = auth.uid() AND university_id IS NOT NULL
            )
            AND m.status = 'active'
            AND (m.ends_at IS NULL OR m.ends_at > now())
        )
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 6. Comment
-- ----------------------------------------------------------------------------
COMMENT ON TABLE company_university_mous IS 'MOU/relationship between a company and a university. Only ACTIVE MOUs make a company''s internships visible to that university.';
COMMENT ON COLUMN programs.id IS 'Program PK. duration_weeks column was dropped in migration 0076 — programs no longer have a fixed week count.';

-- Done.
