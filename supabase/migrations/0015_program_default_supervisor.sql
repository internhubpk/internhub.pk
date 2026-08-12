-- ============================================================================
-- InternHub.pk — 0015 Add default faculty supervisor to programs
-- ----------------------------------------------------------------------------
-- PROBLEM
--   The user wants Department Coordinators to allot a Faculty Supervisor
--   when creating a Program. The existing `intern_supervisor_assignments`
--   table is NOT suitable for this — it requires a `student_internship_id`
--   (i.e., an active internship instance), which doesn't exist when
--   creating a Program (a Program is a curriculum template, not an
--   internship instance).
--
-- SOLUTION
--   Add a `default_faculty_supervisor_id` column to the `programs` table.
--   This is the supervisor allotted to the program by the coordinator at
--   creation time. When a student enrolls in the program and starts an
--   internship, this supervisor can be auto-assigned as the initial
--   faculty_supervisor_id on the student_internships row (that auto-
--   assignment is a future enhancement; this migration only adds the
--   column + RLS-friendly FK).
--
--   The column is nullable because:
--     - Existing programs don't have one (backfill is N/A).
--     - A coordinator may create a program first, allot supervisor later.
--
-- IDEMPOTENT
--   ADD COLUMN IF NOT EXISTS + DROP/CREATE policy. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add the column
-- ----------------------------------------------------------------------------
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS default_faculty_supervisor_id uuid
    REFERENCES profiles(user_id) ON DELETE SET NULL;

-- Index for looking up programs by their allotted supervisor
CREATE INDEX IF NOT EXISTS idx_programs_default_supervisor
  ON programs(default_faculty_supervisor_id)
  WHERE default_faculty_supervisor_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Re-assert RLS policies on programs (idempotent — same as 0002)
--    We re-create them so the new column is automatically covered by
--    the existing university/department scoping. No policy change needed
--    because the scoping is on university_id/department_id, not on the
--    supervisor column.
-- ----------------------------------------------------------------------------
-- (No changes to policies — the existing prog_select/insert/update/delete
--  policies from migration 0002 already cover the new column. A
--  university_admin can see all programs in their university; a
--  department_coordinator can see/create/edit programs in their
--  department. The supervisor_id is just another column they can set.)

-- ----------------------------------------------------------------------------
-- 3. Comment
-- ----------------------------------------------------------------------------
COMMENT ON COLUMN programs.default_faculty_supervisor_id IS
  'Faculty Supervisor allotted to this program by the coordinator at creation. '
  'Nullable — can be set later. When a student starts an internship in this '
  'program, this supervisor is the default faculty_supervisor_id (auto-assign '
  'logic is a future enhancement). This is distinct from '
  'intern_supervisor_assignments, which tracks per-internship supervisor '
  'history.';

-- ----------------------------------------------------------------------------
-- 4. Diagnostic — should show the new column exists
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'programs'
      AND column_name = 'default_faculty_supervisor_id') AS supervisor_column_exists,
  (SELECT count(*) FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_programs_default_supervisor') AS supervisor_index_exists;
