-- ============================================================================
-- 0060_weekly_logs_student_registration_no.sql
--
-- Snapshots the student's registration number (e.g. "FA21-BSCS-001") onto
-- each weekly_log row at submit time, so the report PDF/view is stable even
-- if the student later changes their profile or coordinator reassigns IDs.
--
-- Why a snapshot column instead of always joining profiles/student?
--   - `profiles.student_id_number` is sometimes NULL (legacy accounts created
--     before the Add Student dialog saved it). The canonical source is
--     `students.student_id_number`, which the coordinator sets when creating
--     the student account.
--   - Snapshotting at submit time matches the existing pattern used for
--     `program_name` and `department_name` (see migration 0058).
--   - The View dialog renders from the snapshot — no extra join needed.
-- ============================================================================

ALTER TABLE weekly_logs
  ADD COLUMN IF NOT EXISTS student_registration_no text;

-- Backfill existing rows from `students` (canonical) → fallback to `profiles`.
UPDATE weekly_logs wl
  SET student_registration_no = COALESCE(s.student_id_number, p.student_id_number)
  FROM profiles p
  LEFT JOIN students s ON s.user_id = p.user_id
  WHERE p.user_id = wl.student_user_id
    AND wl.student_registration_no IS NULL;

-- Helpful index for "find reports by registration number" searches.
CREATE INDEX IF NOT EXISTS idx_wl_student_registration_no
  ON weekly_logs(student_registration_no);
