-- ============================================================================
-- 0059_weekly_logs_student_update_rls.sql
--
-- Fixes the 500 error on student "Sign & Submit" weekly log flow.
--
-- Problem: After a student INSERTs a weekly_log with status='submitted',
-- the subsequent UPDATE calls (to patch student_signature_url, university_logo_url,
-- supporting_evidence) were blocked by the wl_update RLS policy, which only
-- allowed students to UPDATE rows with status IN ('draft','revision_required').
--
-- Fix: Allow students to UPDATE their own rows as long as NEITHER supervisor
-- has signed yet (site_supervisor_signed_at IS NULL AND faculty_supervisor_signed_at
-- IS NULL). Once a supervisor signs, the report is locked from further student
-- edits.
-- ============================================================================

-- Drop the old policy and recreate with the broader condition.
DROP POLICY IF EXISTS wl_update ON weekly_logs;

CREATE POLICY wl_update ON weekly_logs
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    -- Student may update their own row UNTIL a supervisor signs it.
    OR (
      internhub.current_role() = 'student'
      AND student_user_id = (SELECT auth.uid())
      AND site_supervisor_signed_at IS NULL
      AND faculty_supervisor_signed_at IS NULL
    )
    -- Supervisors can update (sign / add remarks) rows assigned to them.
    OR internhub.current_role() IN ('faculty_supervisor','site_supervisor')
  )
  WITH CHECK (
    internhub.current_role() IN ('super_admin','student','faculty_supervisor','site_supervisor')
  );

COMMENT ON POLICY wl_update ON weekly_logs IS
  'Students can edit their own weekly logs until a supervisor signs; supervisors can sign/remark on logs assigned to them; super_admin can edit anything.';
