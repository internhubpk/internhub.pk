-- ============================================================================
-- 0051_backfill_pending_evaluations.sql
-- ----------------------------------------------------------------------------
-- Backfills missing `evaluations` rows (status='pending', evaluator_role=
-- 'faculty_supervisor') for existing task_submissions that don't yet have a
-- corresponding faculty evaluation.
--
-- Background:
--   /api/student/tasks/route.ts auto-creates a pending evaluation when a
--   student submits a task. But that auto-creation only fires for NEW
--   submissions — and historically it depended on
--   `student_internships.faculty_supervisor_id` being populated, which was
--   NULL for many rows before migration 0050's backfill ran.
--
--   This migration scans `task_submissions` and creates a pending evaluation
--   for each one that doesn't yet have one, attributing it to the student's
--   faculty supervisor (resolved via student_internships, falling back to
--   students.faculty_supervisor_id).
--
--   Idempotent: re-runnable. Uses a NOT EXISTS subquery to skip submissions
--   that already have an evaluation.
-- ============================================================================

BEGIN;

INSERT INTO evaluations (
    type,
    student_user_id,
    internship_id,
    student_internship_id,
    task_id,
    task_submission_id,
    evaluator_id,
    evaluator_role,
    status,
    scores,
    comments,
    created_at,
    updated_at
)
SELECT
    'task'::evaluation_type,
    ts.student_user_id,
    si.internship_id,
    si.id,
    ts.task_id,
    ts.id,
    COALESCE(si.faculty_supervisor_id, s.faculty_supervisor_id),
    'faculty_supervisor'::user_role,
    'pending'::evaluation_status,
    '{}'::jsonb,
    NULL,
    ts.submitted_at,
    now()
FROM task_submissions ts
JOIN tasks t ON t.id = ts.task_id
LEFT JOIN student_internships si
  ON si.student_user_id = ts.student_user_id
  AND si.internship_id = t.internship_id
LEFT JOIN students s
  ON s.user_id = ts.student_user_id
WHERE COALESCE(si.faculty_supervisor_id, s.faculty_supervisor_id) IS NOT NULL
  -- Skip submissions that already have a faculty evaluation.
  AND NOT EXISTS (
    SELECT 1 FROM evaluations e
    WHERE e.task_submission_id = ts.id
      AND e.evaluator_role = 'faculty_supervisor'
  );

-- Same backfill for weekly_logs: create a pending evaluation for each
-- submitted weekly log that doesn't yet have one. This populates the
-- faculty supervisor's "Pending Review" queue for weekly logs too.
INSERT INTO evaluations (
    type,
    student_user_id,
    internship_id,
    student_internship_id,
    evaluator_id,
    evaluator_role,
    status,
    scores,
    comments,
    created_at,
    updated_at
)
SELECT
    'weekly_log'::evaluation_type,
    wl.student_user_id,
    wl.internship_id,
    wl.student_internship_id,
    COALESCE(si.faculty_supervisor_id, s.faculty_supervisor_id),
    'faculty_supervisor'::user_role,
    'pending'::evaluation_status,
    '{}'::jsonb,
    NULL,
    wl.submitted_at,
    now()
FROM weekly_logs wl
LEFT JOIN student_internships si
  ON si.student_user_id = wl.student_user_id
  AND (si.internship_id = wl.internship_id OR wl.internship_id IS NULL)
LEFT JOIN students s
  ON s.user_id = wl.student_user_id
WHERE wl.status = 'submitted'
  AND COALESCE(si.faculty_supervisor_id, s.faculty_supervisor_id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM evaluations e
    WHERE e.student_user_id = wl.student_user_id
      AND e.evaluator_role = 'faculty_supervisor'
      AND e.type = 'weekly_log'
      AND (
        -- Match by submitted_at timestamp (close enough — weekly_logs don't
        -- have a direct FK to evaluations).
        ABS(EXTRACT(EPOCH FROM (e.created_at - wl.submitted_at))) < 60
      )
  );

COMMIT;

-- Diagnostic: how many pending faculty evaluations exist now?
SELECT
  (SELECT COUNT(*) FROM evaluations
    WHERE evaluator_role = 'faculty_supervisor' AND status = 'pending') AS pending_faculty_evaluations,
  (SELECT COUNT(*) FROM evaluations
    WHERE evaluator_role = 'faculty_supervisor' AND status IN ('submitted','approved','rejected')) AS completed_faculty_evaluations;
