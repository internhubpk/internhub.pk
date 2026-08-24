-- =============================================================================
-- 0089_students_semester_column.sql
-- =============================================================================
-- Adds the missing `semester` column to the `students` table.
--
-- BACKGROUND
--   The product spec for the Program Coordinator "Add Student" form requires:
--     Full name, Roll No (student_id_number), Semester, Program (dropdown),
--     Email, Password.
--   The DB had NO `semester` column on `students`, so every dashboard that
--   displayed a student's semester showed either "0" (faculty-supervisor) or
--   "-" (department-coordinator) — the literal "program=semester 0" / "Semester 0"
--   bug the user reported.
--
--   This migration:
--     1. Adds `students.semester` (smallint, nullable, CHECK 1..12).
--     2. Backfills NULL for existing rows (no default at column-add time so
--        the migration is reversible / explicit).
--     3. Registers a minimal RLS noop — the table is already RLS-enabled and
--        the existing policies cover the new column automatically.
--
--   Companion code changes (this commit):
--     - src/lib/validations.ts: CreateStudentSchema accepts `semester`
--       (1..12, optional).
--     - src/app/api/students/route.ts: POST inserts `semester`.
--     - src/app/api/program-coordinator/students/bulk/route.ts: CSV
--       `semester` column accepted.
--     - src/app/(dashboard)/program-coordinator/students/page.tsx: new form
--       layout with Semester field + Program dropdown + password actually
--       sent to the API.
--     - src/app/(dashboard)/faculty-supervisor/students/page.tsx,
--       src/app/(dashboard)/department-coordinator/students/page.tsx: read
--       `semester` from the DB record instead of defaulting to 0.
-- =============================================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS semester smallint;

-- Range check: 1..12 (standard university semester numbering).
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_semester_range_chk;
ALTER TABLE public.students
  ADD CONSTRAINT students_semester_range_chk
  CHECK (semester IS NULL OR (semester >= 1 AND semester <= 12));

COMMENT ON COLUMN public.students.semester IS
  'Current semester of the student (1..12). NULL = unknown / not yet assigned. Set by Program Coordinator at student-creation time.';
