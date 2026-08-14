-- 0054_fix_student_submission_rls.sql
-- =============================================================================
-- InternHub — Fix student task submission 403 and related RLS issues.
--
-- BACKGROUND
--   Students attempting to (re-)submit a task were receiving:
--     403 "You are not authorized to perform this action."
--
--   Root causes (verified against production RLS policies):
--
--   BUG 1: ts_update USING blocked resubmission after review.
--     The student branch of ts_update required:
--       reviewed_at IS NULL
--     When a supervisor requested changes (action=request_changes), the review
--     route set reviewed_at = NOW() and status = 'resubmitted'. The student
--     then tried to resubmit → UPSERT → ON CONFLICT DO UPDATE → ts_update
--     USING evaluated on the existing row → reviewed_at IS NOT NULL → USING
--     failed → PostgreSQL raised "new row violates row-level security policy"
--     → PostgREST returned 403 → sanitizeApiError converted to the user-facing
--     "You are not authorized to perform this action."
--
--     FIX: Replace `reviewed_at IS NULL` with `status != 'approved'`. This
--     allows resubmission when the previous submission was reviewed but not
--     approved (status IN ('submitted','resubmitted','rejected')), while still
--     blocking modification of approved submissions.
--
--   BUG 2: ta_update USING didn't include a student branch.
--     The student POST /api/student/tasks route updates task_assignments.status
--     to 'submitted' or 'resubmitted' after creating the submission. But
--     ta_update USING only allowed: super_admin, assigned_by, or
--     (faculty_supervisor/university_admin/department_coordinator AND
--     can_access_task). Students didn't match any branch → USING failed →
--     0 rows updated (silent failure, no error). The assignment status stayed
--     'pending' forever, so the supervisor's dashboard never showed the
--     submission.
--
--     FIX: Add a student branch: (current_role() = 'student' AND
--     student_user_id = auth.uid()). The WITH CHECK restricts the status
--     a student can set to 'submitted' or 'resubmitted' (defense-in-depth —
--     prevents a student from self-approving).
--
--   BUG 3 (bonus): ta_update USING was missing 'site_supervisor' in the
--     can_access_task branch. A site_supervisor who didn't create the
--     assignment (assigned_by != auth.uid()) couldn't update it even if
--     they're the actively assigned site_supervisor for that student.
--     The WITH CHECK already included site_supervisor, but USING didn't.
--
--     FIX: Add 'site_supervisor' to the USING role list for consistency.
--
--   BUG 4 (bonus): ts_update WITH CHECK for students had no status restriction.
--     A student could theoretically UPDATE their submission and set
--     status = 'approved' (self-approve). The API never does this, but RLS
--     should enforce it as defense-in-depth.
--
--     FIX: Add `status IN ('submitted','resubmitted')` to the student branch
--     of ts_update WITH CHECK.
--
-- SECURITY ANALYSIS
--   These fixes do NOT weaken authorization — they CORRECT it:
--   - Students can now resubmit when the supervisor explicitly requested
--     changes (status='resubmitted'). This is the intended workflow.
--   - Students still CANNOT modify approved submissions (status='approved').
--   - Students still CANNOT self-approve (WITH CHECK restricts status).
--   - Students can now update their own assignment status to 'submitted' or
--     'resubmitted' only — not to 'approved', 'rejected', etc.
--   - Cross-tenant access is still blocked (student_user_id = auth.uid()
--     ensures a student can only touch their own rows).
--   - All other roles (supervisors, admins) retain their existing access.
--
-- IDEMPOTENT
--   All statements use DROP POLICY IF EXISTS + CREATE POLICY, so the
-- migration can be re-run safely.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fix ts_update (task_submissions UPDATE policy)
--    OLD USING:  ... AND reviewed_at IS NULL ...          (blocks resubmission)
--    NEW USING:  ... AND status != 'approved' ...         (allows resubmission)
--    NEW WITH CHECK: ... AND status IN ('submitted','resubmitted') ... (defense-in-depth)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS ts_update ON public.task_submissions;
CREATE POLICY ts_update ON public.task_submissions
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR (
      internhub.current_role() = 'student'
      AND student_user_id = (SELECT auth.uid())
      -- Allow update when the submission is NOT yet approved.
      -- This covers: 'submitted' (pending review), 'resubmitted' (changes
      -- requested), 'rejected' (supervisor rejected). The student can
      -- re-submit in all these cases. Only 'approved' is final.
      AND status <> 'approved'
    )
    OR (
      internhub.current_role() IN (
        'faculty_supervisor',
        'site_supervisor',
        'external_evaluator'
      )
    )
  )
  WITH CHECK (
    internhub.is_super_admin()
    OR (
      internhub.current_role() = 'student'
      AND student_user_id = (SELECT auth.uid())
      -- Defense-in-depth: a student can only set status to 'submitted' or
      -- 'resubmitted'. They cannot self-approve, self-reject, or set any
      -- other status via a direct API call.
      AND status IN ('submitted', 'resubmitted')
    )
    OR (
      internhub.current_role() IN (
        'faculty_supervisor',
        'site_supervisor',
        'external_evaluator'
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Fix ta_update (task_assignments UPDATE policy)
--    OLD USING:  ... (faculty_supervisor, university_admin, department_coordinator) ...
--                — missing student AND site_supervisor branches.
--    NEW USING:  adds student branch (student_user_id = auth.uid())
--                adds site_supervisor to the role list for consistency.
--    NEW WITH CHECK: restricts student to status IN ('submitted','resubmitted').
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_update ON public.task_assignments;
CREATE POLICY ta_update ON public.task_assignments
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR assigned_by = (SELECT auth.uid())
    OR (
      internhub.current_role() = 'student'
      AND student_user_id = (SELECT auth.uid())
    )
    OR (
      internhub.current_role() IN (
        'faculty_supervisor',
        'site_supervisor',
        'university_admin',
        'department_coordinator'
      )
      AND internhub.can_access_task(task_id)
    )
  )
  WITH CHECK (
    internhub.is_super_admin()
    OR assigned_by = (SELECT auth.uid())
    OR (
      internhub.current_role() = 'student'
      AND student_user_id = (SELECT auth.uid())
      -- A student can only set their assignment status to 'submitted' or
      -- 'resubmitted' (matching their submission status). They cannot
      -- self-approve or set any other status.
      AND status IN ('submitted', 'resubmitted')
    )
    OR (
      internhub.current_role() IN (
        'faculty_supervisor',
        'site_supervisor',
        'university_admin',
        'department_coordinator'
      )
      AND internhub.can_access_task(task_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 3. Sanity: confirm RLS is still enabled and forced on both tables.
-- -----------------------------------------------------------------------------
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. Reload PostgREST schema cache so the new policies take effect immediately.
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- END OF MIGRATION 0054
-- =============================================================================
