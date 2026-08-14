-- 0053_fix_rls_returning_clause.sql
-- =============================================================================
-- InternHub — Fix RLS SELECT policies so they work during INSERT...RETURNING.
--
-- BACKGROUND
--   Student task submission (POST /api/student/tasks) was failing with:
--     403 "new row violates row-level security policy for table task_submissions"
--
--   Root cause (verified via direct PostgREST testing):
--     The student POST route uses Supabase's .upsert(..., { onConflict: ... })
--     which PostgREST translates to:
--       INSERT INTO task_submissions (...) VALUES (...) RETURNING *
--     (the `Prefer: return=representation` header adds RETURNING).
--
--     PostgreSQL evaluates the SELECT policy (ts_select) on each row returned
--     by RETURNING. The ts_select policy was:
--       USING (internhub.can_select_task_submission(id))
--
--     `can_select_task_submission(p_ts)` is a SECURITY DEFINER function that
--     does `SELECT 1 FROM task_submissions WHERE id = p_ts AND (...)`.
--     During INSERT...RETURNING, this function CANNOT see the newly-inserted
--     row — the function's snapshot doesn't include the row inserted by the
--     surrounding statement. So the EXISTS returns false, the SELECT policy
--     denies, and PostgREST reports the 403 as "new row violates row-level
--     security policy" (its generic message when RETURNING yields 0 rows).
--
--   Proof:
--     - INSERT with `Prefer: return=minimal` (no RETURNING) → 201 ✓
--     - INSERT with `Prefer: return=representation` (RETURNING *) → 403 ✗
--     - Changing can_select_task_submission to always return true → 201 ✓
--     - Changing it to `EXISTS(SELECT 1 FROM task_submissions WHERE id=p_ts)`
--       (no conditions) → still 403 ✗ (function can't see the new row at all)
--
-- FIX STRATEGY
--   The "self" check (e.g. `student_user_id = auth.uid()`) must be a DIRECT
--   column comparison in the policy itself, NOT inside a SECURITY DEFINER
--   function that reads from the same table. Direct column comparisons are
--   evaluated against the new row's values directly by the RLS engine, so
--   they always work — even during INSERT...RETURNING.
--
--   Cross-table checks (e.g. "is the task creator me?", "am I the assigned
--   supervisor of this student?") are kept in SECURITY DEFINER helpers
--   because they read from OTHER tables (tasks, student_internships) — those
--   tables' rows ARE visible to the function (they weren't just inserted),
--   and the SECURITY DEFINER functions prevent RLS recursion.
--
--   This pattern is applied to all four task-related tables:
--     - task_submissions.ts_select
--     - tasks.task_select
--     - task_assignments.ta_select
--     - evaluations.eval_select
--
--   The `can_select_*` functions are kept (for backwards compat and for any
--   code that calls them directly), but they are NO LONGER used by the SELECT
--   policies. The policies inline the self-check and use narrow helpers for
--   cross-table checks.
--
--   All statements are idempotent (DROP IF EXISTS + CREATE) so the migration
--   can be re-run safely.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. New helper: is the task in the `created_by` column = current user?
--    Reads from `tasks` (not the calling table), so no self-reference issue.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_task_created_by_me(p_task uuid)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task
      AND t.created_by = (SELECT auth.uid())
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Rewrite ts_select (task_submissions SELECT policy)
--    OLD: USING (internhub.can_select_task_submission(id))
--    NEW: inline self-check + narrow cross-table helpers
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS ts_select ON public.task_submissions;
CREATE POLICY ts_select ON public.task_submissions
  FOR SELECT TO authenticated
  USING (
    internhub.is_super_admin()
    OR student_user_id = (SELECT auth.uid())
    OR internhub.is_task_created_by_me(task_id)
    OR (
      internhub.current_role() IN ('faculty_supervisor','site_supervisor')
      AND internhub.is_assigned_supervisor(student_user_id)
    )
    OR (
      internhub.current_role() = 'external_evaluator'
      AND internhub.is_assigned_supervisor(student_user_id)
    )
    OR (
      internhub.current_role() = 'department_coordinator'
      AND internhub.is_task_in_my_department(task_id)
    )
    OR (
      internhub.current_role() = 'university_admin'
      AND internhub.is_task_in_my_university(task_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 3. Rewrite task_select (tasks SELECT policy)
--    OLD: complex policy using is_task_assignee, is_task_student_supervisor,
--         is_task_assigner, task_in_my_department, task_in_my_university
--    NEW: inline self-check (created_by = auth.uid()) + narrow helpers
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS task_select ON public.tasks;
CREATE POLICY task_select ON public.tasks
  FOR SELECT TO authenticated
  USING (
    internhub.is_super_admin()
    OR created_by = (SELECT auth.uid())
    OR (
      internhub.current_role() = 'student'
      AND internhub.is_task_assigned_to_me(id)
    )
    OR (
      internhub.current_role() = 'faculty_supervisor'
      AND internhub.is_faculty_supervisor_of_task(id)
    )
    OR (
      internhub.current_role() = 'site_supervisor'
      AND internhub.is_site_supervisor_of_task(id)
    )
    OR (
      internhub.current_role() = 'department_coordinator'
      AND internhub.is_task_in_my_department(id)
    )
    OR (
      internhub.current_role() = 'university_admin'
      AND internhub.is_task_in_my_university(id)
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Rewrite ta_select (task_assignments SELECT policy)
--    OLD: complex policy using is_assigned_supervisor, task_in_my_university,
--         task_in_my_department
--    NEW: inline self-checks (student_user_id, assigned_by) + narrow helpers
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_select ON public.task_assignments;
CREATE POLICY ta_select ON public.task_assignments
  FOR SELECT TO authenticated
  USING (
    internhub.is_super_admin()
    OR student_user_id = (SELECT auth.uid())
    OR assigned_by = (SELECT auth.uid())
    OR (
      internhub.current_role() IN ('faculty_supervisor','site_supervisor')
      AND internhub.is_assigned_supervisor(student_user_id)
    )
    OR (
      internhub.current_role() = 'department_coordinator'
      AND internhub.is_task_in_my_department(task_id)
    )
    OR (
      internhub.current_role() = 'university_admin'
      AND internhub.is_task_in_my_university(task_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 5. Rewrite eval_select (evaluations SELECT policy)
--    OLD: USING (internhub.can_select_evaluation(id))
--    NEW: inline self-checks + narrow cross-table helpers
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS eval_select ON public.evaluations;
CREATE POLICY eval_select ON public.evaluations
  FOR SELECT TO authenticated
  USING (
    internhub.is_super_admin()
    OR student_user_id = (SELECT auth.uid())
    OR evaluator_id = (SELECT auth.uid())
    OR (
      internhub.current_role() IN ('faculty_supervisor','site_supervisor','external_evaluator')
      AND internhub.is_assigned_supervisor(student_user_id)
    )
    OR (
      internhub.current_role() = 'university_admin'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = evaluations.student_user_id
          AND p.university_id = internhub.current_university_id()
      )
    )
    OR (
      internhub.current_role() = 'department_coordinator'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = evaluations.student_user_id
          AND p.department_id = internhub.current_department_id()
      )
    )
    OR (
      internhub.current_role() = 'company_hr'
      AND EXISTS (
        SELECT 1 FROM public.internships i
        WHERE i.id = evaluations.internship_id
          AND i.company_id = internhub.current_company_id()
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Grant EXECUTE on the new helper + revoke from anon/public
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION internhub.is_task_created_by_me(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internhub.is_task_created_by_me(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Sanity: confirm RLS is still enabled and forced on all four tables.
-- -----------------------------------------------------------------------------
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- END OF MIGRATION 0053
-- =============================================================================
