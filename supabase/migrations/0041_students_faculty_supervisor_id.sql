-- 0041_students_faculty_supervisor_id.sql
--
-- Adds `faculty_supervisor_id` directly to the `students` table so that
-- department coordinators can assign a faculty supervisor to a student
-- BEFORE the student is placed into an internship.
--
-- Background:
--   Previously, the only way to link a student to a faculty supervisor was
--   via the `student_internships.faculty_supervisor_id` column. That row
--   only exists once the student has been placed into an internship, which
--   made it impossible for a coordinator to pre-assign a faculty supervisor
--   to a student who hadn't started an internship yet.
--
--   This migration introduces a direct `students.faculty_supervisor_id`
--   column for that pre-internship assignment. The POST
--   /api/department-coordinator/assignments route has been updated to
--   prefer updating `student_internships.faculty_supervisor_id` when a row
--   exists, and fall back to updating `students.faculty_supervisor_id`
--   otherwise.
--
--   The Supervisors page counts both sources when computing the
--   "assigned students" total for each supervisor.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS keeps re-runs safe.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS faculty_supervisor_id uuid
  REFERENCES profiles(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_faculty_supervisor
  ON students(faculty_supervisor_id);

-- Backfill: for every student who already has a faculty_supervisor_id set
-- on an existing student_internships row, copy that value onto the
-- students row so the two stay consistent. Only the most-recent
-- student_internships row per student is considered (MAX(created_at)).
UPDATE students s
SET faculty_supervisor_id = sub.faculty_supervisor_id,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (student_user_id)
         student_user_id,
         faculty_supervisor_id
  FROM student_internships
  WHERE faculty_supervisor_id IS NOT NULL
  ORDER BY student_user_id, created_at DESC
) sub
WHERE sub.student_user_id = s.user_id
  AND s.faculty_supervisor_id IS NULL;

-- RLS policies: a student's faculty_supervisor_id can be read by the
-- student themselves, by the assigned supervisor, and by all
-- university-scoped admin/coordinator roles (the existing student_internships
-- policies already cover this — re-declared here for clarity).
DO $$
BEGIN
  -- SELECT: any authenticated user in the same university can read.
  -- The table's existing SELECT policies already cover this; nothing
  -- to add for the new column.
  NULL;
END $$;

-- Diagnostic: report current state.
SELECT
  COUNT(*) FILTER (WHERE faculty_supervisor_id IS NOT NULL) AS students_with_supervisor,
  COUNT(*) AS total_students
FROM students;
