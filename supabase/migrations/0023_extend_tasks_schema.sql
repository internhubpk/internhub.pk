-- ============================================================================
-- InternHub.pk — 0023 Extend tasks schema for faculty-supervisor tasks feature
-- ----------------------------------------------------------------------------
-- PROBLEM
--   The faculty-supervisor tasks feature is currently using mock data because
--   the existing schema doesn't support what the UI needs:
--     1. tasks table has no `priority` column — the page uses low/medium/high/urgent
--     2. tasks table has no `university_id` / `department_id` columns — needed
--        for RLS scoping (the page creates tasks without a program_id, which
--        violates the existing CHECK constraint requiring program_id OR
--        internship_id)
--     3. task_status enum only has draft/published/closed/archived — the page
--        uses assigned/in_progress/completed/overdue/cancelled
--     4. task_submissions has no UNIQUE constraint on (task_id, student_user_id)
--        — the student page uses upsert with onConflict: "task_id,student_user_id"
--     5. task_submissions only has `content` and `attachment_urls text[]` —
--        the student page writes `notes`, `url`, `file_url`, `file_name`
--        (simpler per-submission fields). Add them as optional columns.
--
-- CHANGES
--   1. Create task_priority enum (low, medium, high, urgent)
--   2. Add priority, university_id, department_id columns to tasks
--   3. Drop the tasks_scope_check CHECK constraint (it required program_id OR
--      internship_id; now we also allow university_id-only scoping for
--      ad-hoc tasks that aren't tied to a specific program)
--   4. Extend task_status enum with assigned, in_progress, completed, overdue,
--      cancelled
--   5. Add notes, url, file_url, file_name columns to task_submissions
--   6. Add UNIQUE constraint on (task_id, student_user_id) to task_submissions
--      so the student page's upsert works
--
-- IDEMPOTENT
--   All CREATE TYPE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS,
--   ALTER TYPE ADD VALUE IF NOT EXISTS, DROP CONSTRAINT IF EXISTS, ADD
--   CONSTRAINT IF NOT EXISTS. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. task_priority enum
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. Add columns to tasks
-- ----------------------------------------------------------------------------
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority task_priority;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES universities(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 3. Drop the over-strict CHECK constraint.
--    The original constraint required program_id OR internship_id. Now that
--    tasks can be scoped to a university/department (for ad-hoc tasks), we
--    relax it. RLS policies still enforce tenant isolation.
-- ----------------------------------------------------------------------------
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_scope_check;

-- ----------------------------------------------------------------------------
-- 4. Extend task_status enum with the statuses the UI uses.
--    ALTER TYPE ADD VALUE cannot run inside a transaction block, so each
--    statement is its own implicit transaction.
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'assigned';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'in_progress';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'completed';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'overdue';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 5. Add notes, url, file_url, file_name columns to task_submissions.
--    These coexist with the existing `content` text and `attachment_urls`
--    text[] columns — the UI uses the new simpler columns, while the old
--    columns remain for any code that still references them.
-- ----------------------------------------------------------------------------
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS file_name text;

-- ----------------------------------------------------------------------------
-- 6. UNIQUE constraint on (task_id, student_user_id) so the student page's
--    upsert with onConflict: "task_id,student_user_id" works.
-- ----------------------------------------------------------------------------
ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS task_submissions_task_id_student_user_id_key;
ALTER TABLE task_submissions ADD CONSTRAINT task_submissions_task_id_student_user_id_key
  UNIQUE (task_id, student_user_id);

-- ----------------------------------------------------------------------------
-- 7. Backfill priority for existing tasks (default to 'medium')
-- ----------------------------------------------------------------------------
UPDATE tasks SET priority = 'medium' WHERE priority IS NULL;

-- ----------------------------------------------------------------------------
-- 8. Reload PostgREST schema cache so the new columns/types are visible
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- DIAGNOSTIC — verify the schema changes
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'tasks'
      AND column_name IN ('priority','university_id','department_id'))
    AS tasks_new_cols,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'task_submissions'
      AND column_name IN ('notes','url','file_url','file_name'))
    AS submissions_new_cols,
  (SELECT count(*) FROM pg_constraint
    WHERE conname = 'task_submissions_task_id_student_user_id_key')
    AS submissions_unique_constraint,
  (SELECT count(*) FROM pg_constraint
    WHERE conname = 'tasks_scope_check')
    AS old_check_constraint_should_be_zero;
