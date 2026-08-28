-- 0104_tasks_rls_no_faculty_supervisor.sql
--
-- CONTEXT
-- -------
-- Faculty supervisors do NOT create, edit or delete internship tasks.
-- Tasks are created and managed by the SITE SUPERVISOR (and platform
-- admins for out-of-band fixes). Faculty supervisors only VIEW the tasks
-- assigned to their students (task_select / ta_select) and evaluate the
-- students' work through the `evaluations` table.
--
-- The application layer already blocks faculty supervisors on
-- /api/faculty-supervisor/tasks (POST/PUT/DELETE → 403 unless super_admin).
-- This migration enforces the same rule at the DATABASE level so a
-- compromised or legacy client cannot insert/update task rows as a
-- faculty supervisor.
--
-- CHANGES (relative to migration 0071)
-- ------------------------------------
--   task_insert  : drop 'faculty_supervisor' from the allowed roles
--   task_update  : drop 'faculty_supervisor' from WITH CHECK
--                  (USING stays "creator or super_admin" — FS can never be
--                  a creator now, so they can never match it either)
--   ta_insert    : drop 'faculty_supervisor' from the allowed roles
--   ta_update    : drop 'faculty_supervisor' from both USING role-list
--                  and WITH CHECK role-list (creator/assigned_by path is
--                  preserved for site supervisors, who create assignments)
--
-- Everything else in each policy is byte-identical to 0071.
-- Idempotent: safe to re-run.

-- ----------------------------------------------------------------------------
-- 1. tasks
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS task_insert ON public.tasks;
CREATE POLICY task_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND internhub.current_role() IN (
      'super_admin',
      'site_supervisor',
      'external_evaluator',
      'university_admin',
      'department_coordinator'
    )
  );

DROP POLICY IF EXISTS task_update ON public.tasks;
CREATE POLICY task_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    internhub.current_role() IN (
      'super_admin',
      'site_supervisor',
      'external_evaluator',
      'university_admin',
      'department_coordinator'
    )
  );

-- ----------------------------------------------------------------------------
-- 2. task_assignments
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_insert ON public.task_assignments;
CREATE POLICY ta_insert ON public.task_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = (SELECT auth.uid())
    AND internhub.current_role() IN (
      'super_admin',
      'site_supervisor',
      'external_evaluator',
      'university_admin',
      'department_coordinator'
    )
    AND internhub.is_assigned_supervisor(student_user_id)
  );

DROP POLICY IF EXISTS ta_update ON public.task_assignments;
CREATE POLICY ta_update ON public.task_assignments
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR assigned_by = (SELECT auth.uid())
    OR internhub.current_role() IN (
      'site_supervisor', 'external_evaluator',
      'university_admin', 'department_coordinator'
    )
  )
  WITH CHECK (
    internhub.current_role() IN (
      'site_supervisor', 'external_evaluator',
      'university_admin', 'department_coordinator',
      'super_admin'
    )
  );
