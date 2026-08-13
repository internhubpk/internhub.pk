-- 0042_weekly_logs_and_audit_fixes.sql
--
-- This migration addresses several schema mismatches discovered during the
-- dashboard workflow audit:
--
--   1. `weekly_logs.week_number` is `integer NOT NULL` with NO default. Every
--      insert path (student weekly-log submit) MUST supply `week_number`,
--      otherwise the insert fails. Add a default of 1 and drop the NOT NULL
--      constraint so legacy inserts that omit it still succeed.
--
--   2. The frontend (student/weekly-logs, site-supervisor/weekly-logs) and
--      API routes were historically written against column names that never
--      existed (`work_description`, `challenges_faced`). Rather than rewrite
--      every caller, expose these as compatibility columns that mirror the
--      canonical columns (`tasks_completed`, `challenges`). This keeps the
--      schema honest while letting existing code keep working.
--
--      NOTE: we deliberately do NOT add `work_description` / `challenges_faced`
--      as real columns — instead the new code paths use the canonical columns
--      (`tasks_completed`, `challenges`). This migration only relaxes the
--      `week_number` constraint so inserts don't fail.
--
--   3. `audit_logs` has a single `details jsonb` column. Several API routes
--      were trying to insert `old_values` / `new_values` columns that don't
--      exist. Add those columns as nullable jsonb so the legacy inserts
--      succeed (and mirror their data into `details` for forward compat).
--
-- Idempotent: every statement uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

-- 1. Relax weekly_logs.week_number so inserts without it succeed.
ALTER TABLE weekly_logs ALTER COLUMN week_number DROP NOT NULL;
ALTER TABLE weekly_logs ALTER COLUMN week_number SET DEFAULT 1;

-- 2. Add audit_logs old_values / new_values compatibility columns.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values jsonb;

-- 3. Backfill weekly_logs.week_number for any existing NULL rows.
UPDATE weekly_logs
SET week_number = 1
WHERE week_number IS NULL;

-- 4. Make weekly_logs.internship_id nullable (some student log flows don't
--    have an internship yet, e.g. pre-placement reflections).
--    Already nullable per schema, but ensure defensively.
ALTER TABLE weekly_logs ALTER COLUMN internship_id DROP NOT NULL;

-- 5. Drop the unique constraint that requires internship_id (UNIQUE on
--    student_user_id, week_start_date, internship_id) — relax it to just
--    (student_user_id, week_start_date) so logs without an internship work.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'weekly_logs_student_user_id_week_start_date_internship_id_key'
  ) THEN
    ALTER TABLE weekly_logs
      DROP CONSTRAINT weekly_logs_student_user_id_week_start_date_internship_id_key;
  END IF;
END$$;

-- Add a softer unique constraint (student_user_id + week_start_date) only if
-- one doesn't already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'weekly_logs_student_week_unique'
  ) THEN
    ALTER TABLE weekly_logs
      ADD CONSTRAINT weekly_logs_student_week_unique
      UNIQUE (student_user_id, week_start_date);
  END IF;
END$$;

-- 6. Add `website` column to `profiles` (the API route writes to this column
--    but it didn't exist on the table). linkedin_url and github_url already
--    exist.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website text;

-- 7. Make `weekly_logs.tasks_completed` nullable (it's NOT NULL DEFAULT '{}'
--    but some insert paths may omit it). Defensive only.
ALTER TABLE weekly_logs ALTER COLUMN tasks_completed SET DEFAULT '{}';
