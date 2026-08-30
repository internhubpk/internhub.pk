-- 0106_superadmin_cannot_report_issues.sql
--
-- CONTEXT
-- -------
-- Follow-up to 0105_issue_reports.sql. Product decision: the super_admin is
-- the support staff who triage the incoming report queue — they should NOT
-- be able to file issue reports themselves (and have no personal "My
-- Issues" list). The app layer already blocks it:
--   * sidebar hides "My Issues" + "Report an Issue" for super_admin
--   * POST /api/issues returns 403 after a DB-verified role check
-- This migration closes the last gap at the database level so even a
-- super_admin calling the API directly cannot insert a report.
--
-- super_admin retains full SELECT (all users' reports), UPDATE (status /
-- admin_note) and DELETE (spam cleanup) — that part of the workflow is
-- unchanged.
--
-- Idempotent: safe to re-run.

-- ----------------------------------------------------------------------------
-- 1. INSERT policy — any authenticated user EXCEPT super_admin, only as
--    themselves, with a forced 'open' status (same guarantees as 0105 plus
--    the new role guard).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS issue_reports_insert ON issue_reports;
CREATE POLICY issue_reports_insert ON issue_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_user_id = (SELECT auth.uid())
    AND status = 'open'
    AND resolved_by IS NULL
    AND resolved_at IS NULL
    AND NOT internhub.is_super_admin()
  );

COMMENT ON POLICY issue_reports_insert ON issue_reports IS
  'Reporters may file issues only as themselves; super_admin is excluded (they triage the queue, migration 0106).';
