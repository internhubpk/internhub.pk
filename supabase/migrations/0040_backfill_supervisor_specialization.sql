-- 0040_backfill_supervisor_specialization.sql
--
-- Backfills `supervisors.specialization` for existing supervisor rows
-- where specialization IS NULL or empty.
--
-- Background:
--   The `/api/admin/create-user` route (used by the program-creation
--   flow to create faculty_supervisor accounts) previously stored the
--   "Faculty Supervisor — <program name>" string only in
--   `supervisors.department_focus`. The `specialization` column (added
--   in migration 0024) was left NULL.
--
--   The `/department-coordinator/supervisors` page renders
--   `specialization` (not `department_focus`), so all previously-created
--   supervisors showed "—" in the Specialization column.
--
--   The route has now been patched to also populate `specialization`
--   (from an explicit field if provided, otherwise falling back to
--   `job_title`). This migration backfills the column for rows that
--   were created BEFORE that patch.
--
-- Strategy:
--   1. If `department_focus` is set, copy it to `specialization`.
--   2. Otherwise, derive a specialization from the program name via
--      the `programs.default_faculty_supervisor_id` → `supervisors.user_id`
--      join. The job_title stored in department_focus is
--      "Faculty Supervisor — <program name>"; if department_focus is
--      NULL but the supervisor IS the default for a program, use the
--      program name directly.
--   3. Otherwise, fall back to a sensible default ("Faculty Supervisor")
--      so the column is never blank on the Supervisors page.
--
-- Idempotent: re-running is safe (only touches rows where specialization
-- IS NULL OR empty).

-- 1) Copy department_focus → specialization where specialization is empty.
UPDATE supervisors
SET specialization = department_focus,
    updated_at = now()
WHERE (specialization IS NULL OR specialization = '')
  AND department_focus IS NOT NULL
  AND department_focus <> '';

-- 2) For supervisors with no department_focus but who ARE the default
--    faculty supervisor for some program, use the program name.
UPDATE supervisors s
SET specialization = p.name,
    updated_at = now()
FROM programs p
WHERE p.default_faculty_supervisor_id = s.user_id
  AND (s.specialization IS NULL OR s.specialization = '')
  AND (s.department_focus IS NULL OR s.department_focus = '');

-- 3) Last-resort default for any still-empty specialization.
UPDATE supervisors
SET specialization = 'Faculty Supervisor',
    updated_at = now()
WHERE specialization IS NULL OR specialization = '';

-- Diagnostic: confirm no rows remain with NULL/empty specialization.
SELECT
  COUNT(*) FILTER (WHERE specialization IS NULL OR specialization = '') AS still_empty,
  COUNT(*) AS total_supervisors
FROM supervisors;
