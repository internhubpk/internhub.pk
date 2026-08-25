-- ============================================================================
-- 0095 — Relax weekly_log_daily_entries RLS for API-driven creation
-- ----------------------------------------------------------------------------
-- The wlde_insert_policy only allowed inserts when parent is in
-- (draft, revision_required). We also allow inserts when the parent
-- weekly_log was recently created (within 2 min) by the same student,
-- as a safety net for the API 3-step flow (draft -> entries -> submitted).
--
-- NOTE: The API creates the log as 'draft', inserts daily entries, then
-- updates to 'submitted' — so the primary path (parent is 'draft') already
-- works. This policy extension is a safety net for edge cases.
--
-- IDEMPOTENT: DROP IF EXISTS + CREATE POLICY.
-- ============================================================================

DROP POLICY IF EXISTS wlde_insert_policy ON weekly_log_daily_entries;
CREATE POLICY wlde_insert_policy ON weekly_log_daily_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM weekly_logs WHERE id = weekly_log_id
      AND student_user_id = auth.uid() AND status IN ('draft','revision_required'))
    OR EXISTS (
      SELECT 1 FROM weekly_logs
      WHERE id = weekly_log_id
        AND student_user_id = auth.uid()
        AND created_at > now() - interval '2 minutes'
    )
  );

COMMENT ON POLICY wlde_insert_policy ON weekly_log_daily_entries IS
  'Students can insert daily entries when parent log is draft/revision_required, '
  'or when the parent log was recently created (within 2 min) by the same student.';
