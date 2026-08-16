-- ============================================================================
-- InternHub.pk — 0073 Add default external evaluator to programs
-- ----------------------------------------------------------------------------
-- PROBLEM
--   Department coordinators can allot a "default Faculty Supervisor" to a
--   program (migration 0015). They have asked to also be able to allot a
--   "default External Evaluator" so that every student enrolling in the
--   program is automatically assigned that external evaluator without
--   needing a separate per-student assignment step.
--
--   Until now, external-evaluator support existed at the student_internships
--   level (column added by migration 0071) but NOT at the program level —
--   coordinators had no way to set a program-wide default.
--
-- SOLUTION
--   Add a `default_external_evaluator_id` column to the `programs` table.
--   Mirrors the existing `default_faculty_supervisor_id` pattern:
--     - Nullable (existing programs don't have one; can be set later).
--     - REFERENCES profiles(user_id) ON DELETE SET NULL.
--     - No RLS policy changes — the existing prog_select/insert/update/
--       delete policies already cover the new column (scoping is on
--       university_id/department_id).
--
-- IDEMPOTENT
--   ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add the column
-- ----------------------------------------------------------------------------
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS default_external_evaluator_id uuid
    REFERENCES profiles(user_id) ON DELETE SET NULL;

-- Index for looking up programs by their allotted external evaluator
CREATE INDEX IF NOT EXISTS idx_programs_default_external_evaluator
  ON programs(default_external_evaluator_id)
  WHERE default_external_evaluator_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Comment
-- ----------------------------------------------------------------------------
COMMENT ON COLUMN programs.default_external_evaluator_id IS
  'External Evaluator allotted to this program by the coordinator at creation. '
  'Nullable — can be set later. When a student starts an internship in this '
  'program, this evaluator can be auto-assigned as the initial '
  'external_evaluator_id on the student_internships row (auto-assign logic '
  'is a future enhancement). Mirrors default_faculty_supervisor_id.';

-- ----------------------------------------------------------------------------
-- 3. Diagnostic — should show the new column exists
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'programs'
      AND column_name = 'default_external_evaluator_id') AS evaluator_column_exists,
  (SELECT count(*) FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_programs_default_external_evaluator') AS evaluator_index_exists;
