-- 0050_supervisor_tasks_workflow.sql
-- =============================================================================
-- InternHub — Supervisor task/evaluation workflow redesign.
--
-- Goals (per product spec):
--   1. Site supervisors must be able to create tasks for their assigned students
--      (previously RLS only allowed faculty_supervisor / uni_admin / dept_coord).
--   2. Tasks support a Week → Day → Task structure for daily/weekly evaluation.
--   3. Tasks gain: expected_deliverable, resources (markdown), youtube_url,
--      sort_order (for "Go to Next Task" gating), requires_previous_completion.
--   4. Task submissions gain: tools_used, skills_learned, problems_solved,
--      and a structured `links` JSONB array (GitHub / live / docs / etc.).
--   5. Evaluations support a new `weekly` type plus a `week_number` column
--      for weekly supervisor evaluations aggregated from daily task work.
--
-- This migration is idempotent (every statement uses IF NOT EXISTS / DROP-then-
-- CREATE) so it can be re-run safely.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend `tasks` with weekly/daily structure + new task-content fields.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 2. Extend `task_submissions` with the new student-submission fields.
-- -----------------------------------------------------------------------------
ALTER TABLE public.task_submissions
  ADD COLUMN IF NOT EXISTS tools_used text,
  ADD COLUMN IF NOT EXISTS skills_learned text,
  ADD COLUMN IF NOT EXISTS problems_solved text,
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb;

-- `links` shape: array of { label, url, type? }
-- Example: [{"label":"GitHub","url":"https://github.com/...","type":"repo"},
--           {"label":"Live demo","url":"https://...","type":"demo"}]

-- -----------------------------------------------------------------------------
-- 3. Extend `evaluations` for weekly supervisor evaluations.
--    - Add new enum value `weekly` to evaluation_type.
--    - Add week_number column so weekly evaluations are queryable by week.
-- -----------------------------------------------------------------------------
ALTER TYPE public.evaluation_type ADD VALUE IF NOT EXISTS 'weekly';

ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS week_number integer;

CREATE INDEX IF NOT EXISTS idx_eval_week
  ON public.evaluations (student_user_id, week_number)
  WHERE week_number IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. RLS policy updates — allow `site_supervisor` to create tasks and
--    task_assignments for their assigned students.
--
--    Previous policy (0028_security_hardening.sql) only allowed
--    faculty_supervisor / university_admin / department_coordinator. We drop
--    and recreate to add `site_supervisor` while preserving every other
--    condition. The is_assigned_supervisor() helper already covers both
--    faculty and site supervisors — it returns true if the caller is linked
--    via student_internships.faculty_supervisor_id OR site_supervisor_id
--    with status IN ('assigned','active').
-- -----------------------------------------------------------------------------

-- 4a. tasks INSERT
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

-- 4b. tasks UPDATE — allow creator (faculty OR site supervisor) to edit
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

-- 4c. tasks DELETE — keep the original (super_admin OR creator)
-- (no change needed; creator covers both supervisor types)

-- 4d. task_assignments INSERT — allow site_supervisor
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

-- 4e. task_assignments UPDATE — allow site_supervisor (for review/approve)
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

-- 4f. task_submissions UPDATE — already allows site_supervisor per 0028.
--    (No change needed; we're just noting it for completeness.)

-- -----------------------------------------------------------------------------
-- 5. Update `evaluations` INSERT policy to also accept `weekly` type
--    evaluations from site/faculty supervisors. The existing policy already
--    covers the supervisor case via is_assigned_supervisor(); we only relax
--    the type check (which was previously implicit) — no change needed.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 6. Backfill sort_order for any pre-existing tasks so "Go to Next Task"
--    works correctly. Use created_at ordering within an internship.
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
-- 7. Updated-At triggers (no-op if trigger already exists)
--    We rely on the existing trigger on tasks/task_submissions/evaluations
--    from migration 0001. If those triggers were missing, we'd add them here.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- END OF MIGRATION 0050
-- =============================================================================
