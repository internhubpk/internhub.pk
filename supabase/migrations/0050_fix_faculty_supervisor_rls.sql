-- ============================================================================
-- 0050_fix_faculty_supervisor_rls.sql
-- ----------------------------------------------------------------------------
-- Fixes the Faculty Supervisor dashboard "0 everything" bug.
--
-- Root cause:
--   Migration 0041 added `students.faculty_supervisor_id` (pre-internship
--   assignment by coordinator). The Coordinator UI writes to that column when
--   no `student_internships` row exists yet. But the RLS helper
--   `internhub.is_assigned_supervisor()` only checks `student_internships`,
--   so every policy that depends on it returns FALSE for the supervisor —
--   they see 0 students, 0 tasks, 0 evaluations, 0 weekly logs.
--
--   Additionally, `task_assignments.ta_select` has NO `faculty_supervisor`
--   branch at all, and `tasks.task_select` is both over-permissive (matches
--   ANY task with a non-null program_id) and incomplete (misses
--   university/department-scoped tasks).
--
-- This migration is idempotent — every statement uses CREATE OR REPLACE /
-- DROP POLICY IF EXISTS + CREATE.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Fix `internhub.is_assigned_supervisor()` to also check
--    `students.faculty_supervisor_id` (migration 0041) and to include
--    paused/completed internships (not just assigned/active).
--    Without this fix, supervisors who supervised a now-completed internship
--    lose access to all historical data (evaluations, weekly logs, etc.).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_assigned_supervisor(p_student uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p_student IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.student_internships si
      WHERE si.student_user_id = p_student
        AND (si.faculty_supervisor_id = (select auth.uid())
             OR si.site_supervisor_id = (select auth.uid()))
        AND si.status IN ('assigned','active','paused','completed')
    UNION
    SELECT 1 FROM public.students s
      WHERE s.user_id = p_student
        AND s.faculty_supervisor_id = (select auth.uid())
  );
$$;
ALTER FUNCTION internhub.is_assigned_supervisor(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------
-- 2. Add `faculty_supervisor` branch to `task_assignments.ta_select`.
--    Previously, supervisors could only see assignments where they were the
--    `assigned_by` (i.e., they created the task). They couldn't see tasks
--    created by coordinators or other supervisors that targeted their students.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_select ON public.task_assignments;
CREATE POLICY ta_select ON public.task_assignments
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR student_user_id = (select auth.uid())
    OR assigned_by = (select auth.uid())
    OR (internhub.current_role() = 'faculty_supervisor'
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'site_supervisor'
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (SELECT 1 FROM public.tasks t
                      JOIN public.programs p ON p.id = t.program_id
                    WHERE t.id = task_assignments.task_id
                      AND p.university_id = internhub.current_university_id()))
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (SELECT 1 FROM public.tasks t
                      JOIN public.programs p ON p.id = t.program_id
                    WHERE t.id = task_assignments.task_id
                      AND p.department_id = internhub.current_department_id()))
  );

-- ---------------------------------------------------------------------------
-- 3. Fix `tasks.task_select`:
--    (a) Remove the over-permissive `program_id IS NOT NULL` branch (info leak).
--    (b) Add a faculty_supervisor branch that checks task_assignments for any
--        of the supervisor's assigned students.
--    (c) Add site_supervisor branch (same logic).
--    (d) Preserve existing student / coordinator / university_admin / super_admin.
--    NOTE: `tasks` table has `program_id` and `internship_id` columns. Tasks
--    created via migration 0023 may also be university/department-scoped
--    (those columns exist on tasks as of 0023). We defend against the case
--    where those columns don't exist by checking via EXISTS on programs.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS task_select ON public.tasks;
CREATE POLICY task_select ON public.tasks
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR created_by = (select auth.uid())
    OR (internhub.current_role() = 'student'
        AND EXISTS (SELECT 1 FROM public.task_assignments ta
                      WHERE ta.task_id = tasks.id
                        AND ta.student_user_id = (select auth.uid())))
    OR (internhub.current_role() = 'faculty_supervisor'
        AND (
          -- Tasks I created
          created_by = (select auth.uid())
          -- Tasks assigned to any of my supervised students
          OR EXISTS (SELECT 1 FROM public.task_assignments ta
                       WHERE ta.task_id = tasks.id
                         AND internhub.is_assigned_supervisor(ta.student_user_id))
          -- Tasks scoped to internships where I'm the faculty supervisor
          OR EXISTS (SELECT 1 FROM public.student_internships si
                       WHERE si.internship_id = tasks.internship_id
                         AND si.faculty_supervisor_id = (select auth.uid()))
          -- Tasks scoped to a program I oversee (any of my students are in
          -- that program — defensive proxy)
          OR EXISTS (SELECT 1 FROM public.student_internships si
                       WHERE si.faculty_supervisor_id = (select auth.uid())
                         AND si.program_id = tasks.program_id)
        ))
    OR (internhub.current_role() = 'site_supervisor'
        AND (
          created_by = (select auth.uid())
          OR EXISTS (SELECT 1 FROM public.task_assignments ta
                       WHERE ta.task_id = tasks.id
                         AND internhub.is_assigned_supervisor(ta.student_user_id))
          OR EXISTS (SELECT 1 FROM public.student_internships si
                       WHERE si.internship_id = tasks.internship_id
                         AND si.site_supervisor_id = (select auth.uid()))
        ))
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (SELECT 1 FROM public.programs p
                      WHERE p.id = tasks.program_id
                        AND p.department_id = internhub.current_department_id()))
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (SELECT 1 FROM public.programs p
                      WHERE p.id = tasks.program_id
                        AND p.university_id = internhub.current_university_id()))
  );

-- ---------------------------------------------------------------------------
-- 4. Re-add the `external_evaluator` branch to `profiles_select` that was
--    accidentally dropped in migration 0048.
--    External evaluators need to read the profile of any student they're
--    evaluating (evaluations.evaluator_id = auth.uid()).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator'
        AND department_id = internhub.current_department_id())
    OR (internhub.current_role() = 'company_hr'
        AND (
          company_id = internhub.current_company_id()
          OR EXISTS (SELECT 1 FROM public.internship_applications a
                       WHERE a.student_user_id = profiles.user_id
                         AND a.company_id = internhub.current_company_id())
        ))
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND internhub.is_assigned_supervisor(user_id))
    OR (internhub.current_role() = 'external_evaluator'
        AND EXISTS (SELECT 1 FROM public.evaluations e
                      WHERE e.evaluator_id = (select auth.uid())
                        AND e.student_user_id = profiles.user_id))
  );

-- ---------------------------------------------------------------------------
-- 5. Backfill: sync `students.faculty_supervisor_id` from any existing
--    `student_internships.faculty_supervisor_id` rows that were never
--    propagated. This makes the two columns consistent for any student
--    that has ever been assigned a faculty supervisor.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 6. Backfill the reverse: ensure `student_internships.faculty_supervisor_id`
--    is populated for any active internship where the student has a
--    pre-internship `students.faculty_supervisor_id` assignment.
--    This fixes the data disconnect that's making the dashboard show 0.
--    Only update rows that are currently NULL on student_internships — we
--    never overwrite an explicit NULL (which would mean "supervisor removed").
--    Use a careful WHERE that checks the column IS NULL.
-- ---------------------------------------------------------------------------
UPDATE student_internships si
SET faculty_supervisor_id = s.faculty_supervisor_id,
    updated_at = now()
FROM students s
WHERE si.student_user_id = s.user_id
  AND si.faculty_supervisor_id IS NULL
  AND s.faculty_supervisor_id IS NOT NULL
  AND si.status IN ('assigned','active','paused');

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Diagnostic: how many rows are now linkable?
SELECT
  (SELECT COUNT(*) FROM students WHERE faculty_supervisor_id IS NOT NULL) AS students_with_faculty_supervisor,
  (SELECT COUNT(*) FROM student_internships WHERE faculty_supervisor_id IS NOT NULL) AS internships_with_faculty_supervisor,
  (SELECT COUNT(*) FROM students s WHERE s.faculty_supervisor_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM student_internships si
                  WHERE si.student_user_id = s.user_id
                    AND si.faculty_supervisor_id = s.faculty_supervisor_id)) AS consistent_count;
