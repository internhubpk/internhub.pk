-- 0050_supervisor_tasks_and_faculty_rls.sql
-- =============================================================================
-- InternHub — Merged migration 0050.
--
-- This file MERGES two former migrations that both used version 0050 and thus
-- collided on the `supabase_migrations.schema_migrations` primary key:
--
--   0050_supervisor_tasks_workflow.sql   (added in 954dc9c)
--   0050_fix_faculty_supervisor_rls.sql  (added in 1e8129a)
--
-- Both files must apply in this exact order:
--   1. Schema extensions (tasks / task_submissions / evaluations columns)
--   2. RLS policy updates for site supervisors creating tasks
--   3. is_assigned_supervisor() broadened to also check students.faculty_supervisor_id
--   4. task_select / ta_select / profiles_select refreshed to use the new helper
--   5. Backfill students.faculty_supervisor_id and student_internships.faculty_supervisor_id
--
-- IMPORTANT: This migration REDEFINES task_select/ta_select with inline EXISTS
-- subqueries. Those introduce a recursion cycle (tasks ↔ task_assignments) that
-- is fixed in migration 0051_evaluations_recursion_fix_and_backfill.sql by
-- replacing the inline EXISTS with SECURITY DEFINER helper calls.
--
-- All statements are idempotent (CREATE OR REPLACE / DROP IF EXISTS + CREATE /
-- ADD COLUMN IF NOT EXISTS / IF NOT EXISTS) so the migration can be re-run
-- safely. This is critical because production may already have version 0050
-- recorded (in which case supabase CLI skips this file) OR may not (in which
-- case this file is applied fresh and must be safe to apply even if some of
-- its statements were already applied via the previously-split files).
--
-- NOTE: This file deliberately does NOT wrap its body in BEGIN/COMMIT. The
-- Supabase CLI migration runner wraps each file in its own transaction
-- automatically and detects transaction-incompatible statements (such as
-- ALTER TYPE ... ADD VALUE) to handle them correctly. Adding our own
-- BEGIN/COMMIT would interfere with that detection and could fail.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PART 1 — Schema extensions (from former 0050_supervisor_tasks_workflow.sql)
-- -----------------------------------------------------------------------------

-- 1.1 Extend `tasks` with weekly/daily structure + new task-content fields.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS week_number integer,
  ADD COLUMN IF NOT EXISTS day_number integer,
  ADD COLUMN IF NOT EXISTS expected_deliverable text,
  ADD COLUMN IF NOT EXISTS resources text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requires_previous_completion boolean NOT NULL DEFAULT true;

-- Helpful indexes for the Week → Day → Task navigation
CREATE INDEX IF NOT EXISTS idx_tasks_week_day
  ON public.tasks (internship_id, week_number, day_number);
CREATE INDEX IF NOT EXISTS idx_tasks_sort_order
  ON public.tasks (internship_id, sort_order);

-- 1.2 Extend `task_submissions` with the new student-submission fields.
ALTER TABLE public.task_submissions
  ADD COLUMN IF NOT EXISTS tools_used text,
  ADD COLUMN IF NOT EXISTS skills_learned text,
  ADD COLUMN IF NOT EXISTS problems_solved text,
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb;

-- `links` shape: array of { label, url, type? }
-- Example: [{"label":"GitHub","url":"https://github.com/...","type":"repo"},
--           {"label":"Live demo","url":"https://...","type":"demo"}]

-- 1.3 Extend `evaluations` for weekly supervisor evaluations.
--     Add new enum value `weekly` to evaluation_type.
--     Add week_number column so weekly evaluations are queryable by week.
ALTER TYPE public.evaluation_type ADD VALUE IF NOT EXISTS 'weekly';

ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS week_number integer;

CREATE INDEX IF NOT EXISTS idx_eval_week
  ON public.evaluations (student_user_id, week_number)
  WHERE week_number IS NOT NULL;

-- -----------------------------------------------------------------------------
-- PART 2 — RLS policy updates for site supervisors (from former
--          0050_supervisor_tasks_workflow.sql)
--
-- Allow `site_supervisor` to create tasks and task_assignments for their
-- assigned students. Previously only faculty_supervisor / university_admin /
-- department_coordinator could.
-- -----------------------------------------------------------------------------

-- 2a. tasks INSERT
DROP POLICY IF EXISTS task_insert ON public.tasks;
CREATE POLICY task_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND internhub.current_role() IN (
      'super_admin',
      'faculty_supervisor',
      'site_supervisor',
      'university_admin',
      'department_coordinator'
    )
  );

-- 2b. tasks UPDATE — allow creator (faculty OR site supervisor) to edit
DROP POLICY IF EXISTS task_update ON public.tasks;
CREATE POLICY task_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR created_by = (select auth.uid())
  )
  WITH CHECK (
    internhub.current_role() IN (
      'super_admin',
      'faculty_supervisor',
      'site_supervisor',
      'university_admin',
      'department_coordinator'
    )
  );

-- 2c. tasks DELETE — keep the original (super_admin OR creator)
-- (no change needed; creator covers both supervisor types)

-- 2d. task_assignments INSERT — allow site_supervisor
DROP POLICY IF EXISTS ta_insert ON public.task_assignments;
CREATE POLICY ta_insert ON public.task_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = (select auth.uid())
    AND internhub.current_role() IN (
      'super_admin',
      'faculty_supervisor',
      'site_supervisor',
      'university_admin',
      'department_coordinator'
    )
    AND internhub.is_assigned_supervisor(student_user_id)
  );

-- 2e. task_assignments UPDATE — allow site_supervisor (for review/approve)
DROP POLICY IF EXISTS ta_update ON public.task_assignments;
CREATE POLICY ta_update ON public.task_assignments
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR assigned_by = (select auth.uid())
    OR internhub.current_role() IN (
      'faculty_supervisor', 'site_supervisor',
      'university_admin', 'department_coordinator'
    )
  )
  WITH CHECK (
    internhub.current_role() IN (
      'faculty_supervisor', 'site_supervisor',
      'university_admin', 'department_coordinator',
      'super_admin'
    )
  );

-- 2f. task_submissions UPDATE — already allows site_supervisor per 0028.
--    (No change needed; we're just noting it for completeness.)

-- -----------------------------------------------------------------------------
-- PART 3 — Backfill sort_order for pre-existing tasks (from former
--          0050_supervisor_tasks_workflow.sql)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  -- Only backfill rows where sort_order is at its default of 0 AND no other
  -- row already has a non-zero sort_order in the same internship (avoid
  -- clobbering intentional values). We use a window function to assign a
  -- 1-based rank per internship ordered by created_at.
  IF EXISTS (
    SELECT 1 FROM public.tasks WHERE sort_order = 0 LIMIT 1
  ) THEN
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY COALESCE(internship_id, '00000000-0000-0000-0000-000000000000')
               ORDER BY created_at
             ) AS rn
      FROM public.tasks
      WHERE sort_order = 0
    )
    UPDATE public.tasks t
    SET sort_order = ranked.rn
    FROM ranked
    WHERE t.id = ranked.id;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- PART 4 — Fix is_assigned_supervisor() and dependent policies
-- (from former 0050_fix_faculty_supervisor_rls.sql)
--
-- Root cause being fixed:
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
-- NOTE: This 2-path definition (Path 1 + Path 2) is later superseded by
--   migration 0062, which broadens to 3 paths (adds Path 3: program-level
--   default_faculty_supervisor_id). The ordering of 0050 < 0062 is essential.
-- -----------------------------------------------------------------------------

-- 4.1 Broaden is_assigned_supervisor to also check students.faculty_supervisor_id
--     and include paused/completed internships (not just assigned/active).
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

-- 4.2 Add `faculty_supervisor` branch to `task_assignments.ta_select`.
--     Previously, supervisors could only see assignments where they were the
--     `assigned_by` (i.e., they created the task). They couldn't see tasks
--     created by coordinators or other supervisors that targeted their students.
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

-- 4.3 Fix `tasks.task_select`:
--    (a) Remove the over-permissive `program_id IS NOT NULL` branch (info leak).
--    (b) Add a faculty_supervisor branch that checks task_assignments for any
--        of the supervisor's assigned students.
--    (c) Add site_supervisor branch (same logic).
--    (d) Preserve existing student / coordinator / university_admin / super_admin.
--
-- WARNING: This policy uses inline EXISTS on task_assignments and
--    student_internships. ta_select (4.2 above) also uses inline EXISTS on
--    tasks. Together these create a recursion cycle that PostgreSQL will
--    reject at query time with "infinite recursion detected in policy for
--    relation tasks". Migration 0051 replaces both policies with
--    non-recursive SECURITY DEFINER helper calls.
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

-- 4.4 Re-add the `external_evaluator` branch to `profiles_select` that was
--    accidentally dropped in migration 0048.
--    External evaluators need to read the profile of any student they're
--    evaluating (evaluations.evaluator_id = auth.uid()).
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

-- -----------------------------------------------------------------------------
-- PART 5 — Backfill supervisor assignments (from former
--          0050_fix_faculty_supervisor_rls.sql)
-- -----------------------------------------------------------------------------

-- 5.1 Sync `students.faculty_supervisor_id` from any existing
--     `student_internships.faculty_supervisor_id` rows that were never
--     propagated. This makes the two columns consistent for any student
--     that has ever been assigned a faculty supervisor.
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

-- 5.2 Backfill the reverse: ensure `student_internships.faculty_supervisor_id`
--     is populated for any active internship where the student has a
--     pre-internship `students.faculty_supervisor_id` assignment.
--     Only update rows that are currently NULL on student_internships — we
--     never overwrite an explicit NULL (which would mean "supervisor removed").
UPDATE student_internships si
SET faculty_supervisor_id = s.faculty_supervisor_id,
    updated_at = now()
FROM students s
WHERE si.student_user_id = s.user_id
  AND si.faculty_supervisor_id IS NULL
  AND s.faculty_supervisor_id IS NOT NULL
  AND si.status IN ('assigned','active','paused');

NOTIFY pgrst, 'reload schema';

-- Diagnostic: how many rows are now linkable?
SELECT
  (SELECT COUNT(*) FROM students WHERE faculty_supervisor_id IS NOT NULL) AS students_with_faculty_supervisor,
  (SELECT COUNT(*) FROM student_internships WHERE faculty_supervisor_id IS NOT NULL) AS internships_with_faculty_supervisor,
  (SELECT COUNT(*) FROM students s WHERE s.faculty_supervisor_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM student_internships si
                  WHERE si.student_user_id = s.user_id
                    AND si.faculty_supervisor_id = s.faculty_supervisor_id)) AS consistent_count;

-- =============================================================================
-- END OF MIGRATION 0050
-- =============================================================================
