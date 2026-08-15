-- ============================================================================
-- InternHub.pk — 0063 Fix infinite recursion in is_assigned_supervisor()
-- ----------------------------------------------------------------------------
-- PROBLEM
--   The Faculty Supervisor dashboard shows 0 for EVERY metric (students,
--   tasks, evaluations, logs, notifications) even though the data exists in
--   the database. Direct SQL queries as the supervisor fail with:
--
--     ERROR: 42P17: infinite recursion detected in policy for relation
--     "evaluations"   (also: "weekly_logs", "profiles", "students")
--
--   Root cause: the `internhub.is_assigned_supervisor(p_student)` helper
--   is SECURITY DEFINER (owned by postgres, which has BYPASSRLS), but the
--   PostgreSQL planner still detects a static policy-recursion cycle:
--
--     eval_select policy  ──calls──▶  is_assigned_supervisor()
--                                            │
--                                            ▼
--                                       queries students
--                                            │
--                                            ▼
--                                     students_select policy
--                                            │
--                                            ▼
--                                  calls is_assigned_supervisor()
--                                            │
--                                       ↺ infinite cycle
--
--   Even though the function would bypass RLS at runtime (postgres has
--   BYPASSRLS), the planner flags the cycle at PLAN time and refuses to
--   create a plan. Result: every query that touches evaluations,
--   weekly_logs, profiles, students, task_submissions, etc. returns 0
--   rows (the JS client silently swallows the error).
--
-- SOLUTION
--   1. Recreate `internhub.is_assigned_supervisor(p_student)` with the
--      explicit `SET row_security = off` GUC. This tells the planner:
--        "this function bypasses RLS — do NOT consider RLS policies for
--         any table queried inside this function when planning the
--         caller's query."
--      This breaks the plan-time cycle detection and lets the query
--      proceed. At runtime, the function's SECURITY DEFINER + postgres
--      ownership already bypass RLS (no security change).
--
--   2. Broaden the function to cover all THREE supervisor-assignment
--      paths (re-applying the logic from migration 0062, which was
--      apparently never applied to the live DB — the function in
--      production only covers paths 1 + 2):
--        Path 1: student_internships.faculty_supervisor_id
--                (or site_supervisor_id) with active status
--        Path 2: students.faculty_supervisor_id (pre-internship, 0041)
--        Path 3: programs.default_faculty_supervisor_id (program-level, 0015)
--
-- SECURITY ANALYSIS
--   * The function is SECURITY DEFINER owned by `postgres` (BYPASSRLS).
--     Setting `row_security = off` does NOT change the function's
--     security posture — it only makes the planner aware that RLS will
--     be bypassed, so it stops flagging the static recursion cycle.
--   * The function only reads (no writes), is STABLE, has a fixed
--     search_path, and resolves no user-controlled object names.
--   * The function still uses `auth.uid()` to identify the caller —
--     the `auth.uid()` function is itself SECURITY DEFINER owned by
--     `supabase_auth_admin` and reads the JWT `sub` claim. It is not
--     affected by the caller's row_security setting.
--   * No RLS policy is weakened, disabled, or replaced with
--     `USING (true)`. The policies still call this function — they
--     just no longer trigger a planner-side recursion error.
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Recreate is_assigned_supervisor with row_security = off + 3 paths
-- ----------------------------------------------------------------------------
-- Use CREATE OR REPLACE so we don't have to DROP (which would fail because
-- ~24 RLS policies depend on this function). CREATE OR REPLACE preserves
-- the function's OID and dependencies while replacing the body and config.
CREATE OR REPLACE FUNCTION internhub.is_assigned_supervisor(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  -- A supervisor is "assigned" to a student if ANY of the following holds.
  --
  -- The function runs as `postgres` (SECURITY DEFINER + BYPASSRLS) and
  -- explicitly sets `row_security = off` so the planner does NOT consider
  -- RLS policies on the inner tables when planning the caller's query.
  -- This breaks the static recursion cycle:
  --
  --   eval_select  ─▶  is_assigned_supervisor  ─▶  students
  --                                                  ▲
  --                  students_select  ──────────────┘
  --                        │
  --                        ▼
  --                  is_assigned_supervisor  (← cycle)
  --
  -- With row_security = off inside this function, the planner knows the
  -- inner `students` / `student_internships` / `programs` queries will
  -- NOT trigger students_select / si_select / programs_select, so the
  -- cycle is broken at plan time.
  SELECT
    -- Path 1: internship-time direct assignment.
    -- Includes all non-terminated statuses so historical (completed/paused)
    -- internships stay visible to the supervisor.
    EXISTS (
      SELECT 1 FROM public.student_internships si
        WHERE si.student_user_id = p_student
          AND (si.faculty_supervisor_id = (SELECT auth.uid())
               OR si.site_supervisor_id = (SELECT auth.uid()))
          AND si.status IN ('assigned','active','paused','completed')
    )
    -- Path 2: pre-internship direct assignment (migration 0041).
    OR EXISTS (
      SELECT 1 FROM public.students s
        WHERE s.user_id = p_student
          AND s.faculty_supervisor_id = (SELECT auth.uid())
    )
    -- Path 3: program-level indirect assignment (migration 0015).
    -- When a coordinator creates a program, the supervisor is created
    -- and `programs.default_faculty_supervisor_id` is set. Every student
    -- subsequently enrolled in that program is "theirs".
    OR EXISTS (
      SELECT 1
        FROM public.students s
        JOIN public.programs p ON p.id = s.program_id
        WHERE s.user_id = p_student
          AND p.default_faculty_supervisor_id = (SELECT auth.uid())
    );
$$;

COMMENT ON FUNCTION internhub.is_assigned_supervisor(uuid) IS
  'Returns true if the current auth user is an assigned supervisor for the '
  'given student user_id. Checks three assignment paths: (1) '
  'student_internships.faculty_supervisor_id or site_supervisor_id with '
  'active status, (2) students.faculty_supervisor_id (pre-internship '
  'direct assignment, migration 0041), (3) programs.default_faculty_'
  'supervisor_id for the student''s program (program-level indirect, '
  'migration 0015). SECURITY DEFINER + row_security=off to bypass RLS '
  'and break the static plan-time recursion cycle with students_select / '
  'eval_select / wl_select / profiles_select policies.';

-- Re-grant execute (in case a later migration revoked it).
GRANT EXECUTE ON FUNCTION internhub.is_assigned_supervisor(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 2. Diagnostic — verify the function is correctly installed
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('internhub.is_assigned_supervisor(uuid)'::regprocedure)
    INTO v_def;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'is_assigned_supervisor function not found — migration failed';
  END IF;

  IF NOT v_def LIKE '%row_security%off%' THEN
    RAISE EXCEPTION 'is_assigned_supervisor missing row_security=off — recursion will persist';
  END IF;

  IF NOT v_def LIKE '%default_faculty_supervisor_id%' THEN
    RAISE EXCEPTION 'is_assigned_supervisor missing Path 3 (programs.default_faculty_supervisor_id) — pre-internship students invisible';
  END IF;

  RAISE NOTICE 'Migration 0063 OK: is_assigned_supervisor now bypasses RLS (row_security=off) + covers all 3 assignment paths';
END $$;
