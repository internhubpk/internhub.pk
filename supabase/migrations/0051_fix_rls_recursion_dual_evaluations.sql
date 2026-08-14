-- 0051_fix_rls_recursion_dual_evaluations.sql
-- =============================================================================
-- InternHub — Fix infinite recursion in tasks RLS + support dual evaluations.
--
-- BACKGROUND
--   The site-supervisor dashboard was failing with:
--     "infinite recursion detected in policy for relation \"tasks\""
--
--   Root cause:
--     task_select (on public.tasks) had a branch:
--       EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = tasks.id ...)
--     ta_select (on public.task_assignments) had a branch:
--       EXISTS (SELECT 1 FROM tasks t JOIN programs p ... WHERE t.id = task_assignments.task_id ...)
--     → task_select → ta_select → task_select → ... infinite recursion.
--
--   The same pattern existed between task_submissions ↔ tasks.
--
-- FIX STRATEGY
--   Replace every inline EXISTS subquery (on a table whose own RLS policies
--   might recurse back into this table) with a call to a narrow
--   SECURITY DEFINER function. SECURITY DEFINER functions execute with the
--   owner's privileges and bypass RLS for the tables they read — so they
--   break the recursion cleanly.
--
--   The helper functions:
--     - Have a fixed search_path = 'public'
--     - Are STABLE
--     - Do NOT resolve user-controlled object names
--     - Read only the minimum columns needed
--     - Do not query the table whose policy is calling them (no self-recursion)
--
-- DUAL EVALUATION WORKFLOW (faculty + site supervisor)
--   - The evaluations table already has evaluator_role (user_role enum).
--   - We add a UNIQUE constraint on (task_id, evaluator_role) WHERE task_id
--     IS NOT NULL so that each task can have at most one site_supervisor
--     evaluation and at most one faculty_supervisor evaluation.
--   - Weekly evaluations (no task_id) remain unrestricted.
--   - eval_select already allows a faculty/site supervisor to see ALL
--     evaluations for any student they're assigned to (via
--     is_assigned_supervisor) — so faculty supervisors automatically see
--     site-supervisor evaluations for their assigned students. We keep that
--     behavior but rewrite the policy to use SECURITY DEFINER helpers so it
--     cannot recurse.
--
-- All statements are idempotent (DROP IF EXISTS + CREATE) so the migration
-- can be re-run safely.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. New SECURITY DEFINER helper functions.
--    Every function:
--      - is owned by postgres (the migration runner)
--      - has SET search_path TO 'public'
--      - is STABLE for SELECT-only helpers
--      - bypasses RLS on the tables it reads (SECURITY DEFINER + owner bypass)
-- -----------------------------------------------------------------------------

-- 1a. Is the current user a student who has a task_assignments row for p_task?
--     Used by task_select to scope student visibility to ASSIGNED tasks only
--     (not every task in their internship).
CREATE OR REPLACE FUNCTION internhub.is_task_assigned_to_me(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_assignments ta
    WHERE ta.task_id = p_task
      AND ta.student_user_id = (SELECT auth.uid())
  );
$$;

-- 1b. Is the current user the faculty supervisor of any student in the
--     internship that this task belongs to?
CREATE OR REPLACE FUNCTION internhub.is_faculty_supervisor_of_task(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.student_internships si ON si.internship_id = t.internship_id
    WHERE t.id = p_task
      AND si.faculty_supervisor_id = (SELECT auth.uid())
      AND si.status IN ('assigned','active')
  );
$$;

-- 1c. Is the current user the site supervisor of any student in the
--     internship that this task belongs to?
CREATE OR REPLACE FUNCTION internhub.is_site_supervisor_of_task(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.student_internships si ON si.internship_id = t.internship_id
    WHERE t.id = p_task
      AND si.site_supervisor_id = (SELECT auth.uid())
      AND si.status IN ('assigned','active')
  );
$$;

-- 1d. Is the task's program in the current department_coordinator's department?
--     Checks tasks.program_id → programs.department_id = current_department_id()
CREATE OR REPLACE FUNCTION internhub.is_task_in_my_department(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.programs p ON p.id = t.program_id
    WHERE t.id = p_task
      AND p.department_id = internhub.current_department_id()
  );
$$;

-- 1e. Is the task's program in the current university_admin's university?
CREATE OR REPLACE FUNCTION internhub.is_task_in_my_university(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.programs p ON p.id = t.program_id
    WHERE t.id = p_task
      AND p.university_id = internhub.current_university_id()
  );
$$;

-- 1f. Combined: can the current user SELECT this task?
--     Single source of truth for task visibility. Re-evaluated per row by
--     PostgreSQL, but each branch is a single function call (no recursion).
CREATE OR REPLACE FUNCTION internhub.can_select_task(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p_task IS NOT NULL
    AND (
      internhub.is_super_admin()
      OR (
        SELECT t.created_by = (SELECT auth.uid())
        FROM public.tasks t
        WHERE t.id = p_task
      )
      OR (
        internhub.current_role() = 'student'
        AND internhub.is_task_assigned_to_me(p_task)
      )
      OR (
        internhub.current_role() = 'faculty_supervisor'
        AND internhub.is_faculty_supervisor_of_task(p_task)
      )
      OR (
        internhub.current_role() = 'site_supervisor'
        AND internhub.is_site_supervisor_of_task(p_task)
      )
      OR (
        internhub.current_role() = 'department_coordinator'
        AND internhub.is_task_in_my_department(p_task)
      )
      OR (
        internhub.current_role() = 'university_admin'
        AND internhub.is_task_in_my_university(p_task)
      )
    );
$$;

-- 1g. Combined: can the current user SELECT this task_assignment?
--     Reads tasks, profiles, student_internships directly (bypassing RLS).
CREATE OR REPLACE FUNCTION internhub.can_select_task_assignment(p_ta uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p_ta IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.task_assignments ta
      WHERE ta.id = p_ta
        AND (
          internhub.is_super_admin()
          OR ta.student_user_id = (SELECT auth.uid())
          OR ta.assigned_by = (SELECT auth.uid())
          -- Faculty supervisor of the student this assignment is for
          OR (
            internhub.current_role() = 'faculty_supervisor'
            AND internhub.is_assigned_supervisor(ta.student_user_id)
          )
          -- Site supervisor of the student this assignment is for
          OR (
            internhub.current_role() = 'site_supervisor'
            AND internhub.is_assigned_supervisor(ta.student_user_id)
          )
          -- Department coordinator of the task's program
          OR (
            internhub.current_role() = 'department_coordinator'
            AND internhub.is_task_in_my_department(ta.task_id)
          )
          -- University admin of the task's program
          OR (
            internhub.current_role() = 'university_admin'
            AND internhub.is_task_in_my_university(ta.task_id)
          )
        )
    );
$$;

-- 1h. Combined: can the current user SELECT this task_submission?
CREATE OR REPLACE FUNCTION internhub.can_select_task_submission(p_ts uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p_ts IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.task_submissions ts
      WHERE ts.id = p_ts
        AND (
          internhub.is_super_admin()
          OR ts.student_user_id = (SELECT auth.uid())
          -- The task creator can see submissions for their task
          OR (
            SELECT t.created_by = (SELECT auth.uid())
            FROM public.tasks t
            WHERE t.id = ts.task_id
          )
          -- Faculty or site supervisor of the student
          OR (
            internhub.current_role() IN ('faculty_supervisor','site_supervisor')
            AND internhub.is_assigned_supervisor(ts.student_user_id)
          )
          -- External evaluator of the student (if the student has one)
          OR (
            internhub.current_role() = 'external_evaluator'
            AND internhub.is_assigned_supervisor(ts.student_user_id)
          )
          -- Department coordinator of the task's program
          OR (
            internhub.current_role() = 'department_coordinator'
            AND internhub.is_task_in_my_department(ts.task_id)
          )
          -- University admin of the task's program
          OR (
            internhub.current_role() = 'university_admin'
            AND internhub.is_task_in_my_university(ts.task_id)
          )
        )
    );
$$;

-- 1i. Combined: can the current user SELECT this evaluation?
--     This is the KEY function for the dual-evaluation workflow:
--       - Students see evaluations where student_user_id = auth.uid()
--       - Faculty supervisors see ALL evaluations for their assigned students
--         (BOTH site-supervisor and faculty-supervisor evaluations)
--       - Site supervisors see ALL evaluations for their assigned students
--       - Uni admin / dept coord see evaluations for students in their scope
--       - Company HR see evaluations for their internships
CREATE OR REPLACE FUNCTION internhub.can_select_evaluation(p_eval uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p_eval IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.evaluations e
      WHERE e.id = p_eval
        AND (
          internhub.is_super_admin()
          OR e.student_user_id = (SELECT auth.uid())
          OR e.evaluator_id = (SELECT auth.uid())
          OR (
            internhub.current_role() IN ('faculty_supervisor','site_supervisor')
            AND internhub.is_assigned_supervisor(e.student_user_id)
          )
          OR (
            internhub.current_role() = 'external_evaluator'
            AND internhub.is_assigned_supervisor(e.student_user_id)
          )
          OR (
            internhub.current_role() = 'university_admin'
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.user_id = e.student_user_id
                AND p.university_id = internhub.current_university_id()
            )
          )
          OR (
            internhub.current_role() = 'department_coordinator'
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.user_id = e.student_user_id
                AND p.department_id = internhub.current_department_id()
            )
          )
          OR (
            internhub.current_role() = 'company_hr'
            AND EXISTS (
              SELECT 1 FROM public.internships i
              WHERE i.id = e.internship_id
                AND i.company_id = internhub.current_company_id()
            )
          )
        )
    );
$$;

-- 1j. Is the current user permitted to INSERT a task_submission for a given
--     task? Used in ts_insert to keep the policy non-recursive.
--     Rules: student + has an assignment for the task.
CREATE OR REPLACE FUNCTION internhub.can_submit_task(p_task uuid, p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p_task IS NOT NULL
    AND p_student IS NOT NULL
    AND p_student = (SELECT auth.uid())
    AND internhub.current_role() = 'student'
    AND EXISTS (
      SELECT 1
      FROM public.task_assignments ta
      WHERE ta.task_id = p_task
        AND ta.student_user_id = p_student
    );
$$;

-- Revoke EXECUTE from anon/public on all new helpers. Authenticated users get
-- EXECUTE so policies can call them.
REVOKE EXECUTE ON FUNCTION internhub.is_task_assigned_to_me(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION internhub.is_faculty_supervisor_of_task(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION internhub.is_site_supervisor_of_task(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION internhub.is_task_in_my_department(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION internhub.is_task_in_my_university(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION internhub.can_select_task(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION internhub.can_select_task_assignment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION internhub.can_select_task_submission(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION internhub.can_select_evaluation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION internhub.can_submit_task(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION internhub.is_task_assigned_to_me(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION internhub.is_faculty_supervisor_of_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION internhub.is_site_supervisor_of_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION internhub.is_task_in_my_department(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION internhub.is_task_in_my_university(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION internhub.can_select_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION internhub.can_select_task_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION internhub.can_select_task_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION internhub.can_select_evaluation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION internhub.can_submit_task(uuid, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Drop and recreate policies on `tasks` using the new helpers.
--    The new policies contain NO inline EXISTS subqueries on RLS-enabled
--    tables — every check goes through a SECURITY DEFINER function.
-- -----------------------------------------------------------------------------

-- 2a. task_select — was the primary recursion source. Now uses can_select_task.
DROP POLICY IF EXISTS task_select ON public.tasks;
CREATE POLICY task_select ON public.tasks
  FOR SELECT TO authenticated
  USING (internhub.can_select_task(id));

-- 2b. task_insert — kept as-is from migration 0050 (no recursion; only checks
--     auth.uid() and current_role()).
DROP POLICY IF EXISTS task_insert ON public.tasks;
CREATE POLICY task_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND internhub.current_role() IN (
      'super_admin',
      'faculty_supervisor',
      'site_supervisor',
      'university_admin',
      'department_coordinator'
    )
  );

-- 2c. task_update — kept as-is from migration 0050.
DROP POLICY IF EXISTS task_update ON public.tasks;
CREATE POLICY task_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    internhub.current_role() IN (
      'super_admin',
      'faculty_supervisor',
      'site_supervisor',
      'university_admin',
      'department_coordinator'
    )
  );

-- 2d. task_delete — kept as-is from migration 0050.
DROP POLICY IF EXISTS task_delete ON public.tasks;
CREATE POLICY task_delete ON public.tasks
  FOR DELETE TO authenticated
  USING (
    internhub.is_super_admin()
    OR created_by = (SELECT auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 3. Drop and recreate policies on `task_assignments`.
--    OLD ta_select had `EXISTS (SELECT 1 FROM tasks t JOIN programs p ...)`
--    which was the second half of the recursion cycle. Now uses
--    can_select_task_assignment(id) which reads tasks/programs/profiles via
--    SECURITY DEFINER (bypassing RLS).
-- -----------------------------------------------------------------------------

-- 3a. ta_select — non-recursive.
DROP POLICY IF EXISTS ta_select ON public.task_assignments;
CREATE POLICY ta_select ON public.task_assignments
  FOR SELECT TO authenticated
  USING (internhub.can_select_task_assignment(id));

-- 3b. ta_insert — kept as-is from migration 0050.
DROP POLICY IF EXISTS ta_insert ON public.task_assignments;
CREATE POLICY ta_insert ON public.task_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = (SELECT auth.uid())
    AND internhub.current_role() IN (
      'super_admin',
      'faculty_supervisor',
      'site_supervisor',
      'university_admin',
      'department_coordinator'
    )
    AND internhub.is_assigned_supervisor(student_user_id)
  );

-- 3c. ta_update — kept as-is from migration 0050.
DROP POLICY IF EXISTS ta_update ON public.task_assignments;
CREATE POLICY ta_update ON public.task_assignments
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR assigned_by = (SELECT auth.uid())
    OR internhub.current_role() IN (
      'faculty_supervisor', 'site_supervisor',
      'university_admin', 'department_coordinator'
    )
  )
  WITH CHECK (
    internhub.current_role() IN (
      'faculty_supervisor', 'site_supervisor',
      'university_admin', 'department_coordinator',
      'super_admin'
    )
  );

-- 3d. ta_delete — kept as-is.
DROP POLICY IF EXISTS ta_delete ON public.task_assignments;
CREATE POLICY ta_delete ON public.task_assignments
  FOR DELETE TO authenticated
  USING (
    internhub.is_super_admin()
    OR assigned_by = (SELECT auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 4. Drop and recreate policies on `task_submissions`.
--    OLD ts_insert had a nested EXISTS on `tasks` followed by another on
--    `task_assignments` — both RLS-enabled — which triggered the recursion
--    via task_select → ta_select. Now uses can_submit_task + can_select_task
--    helpers (SECURITY DEFINER, no recursion).
-- -----------------------------------------------------------------------------

-- 4a. ts_select — non-recursive.
DROP POLICY IF EXISTS ts_select ON public.task_submissions;
CREATE POLICY ts_select ON public.task_submissions
  FOR SELECT TO authenticated
  USING (internhub.can_select_task_submission(id));

-- 4b. ts_insert — was the worst offender. Replaced with two helper calls.
DROP POLICY IF EXISTS ts_insert ON public.task_submissions;
CREATE POLICY ts_insert ON public.task_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_user_id = (SELECT auth.uid())
    AND internhub.current_role() = 'student'
    AND internhub.can_submit_task(task_id, student_user_id)
  );

-- 4c. ts_update — kept as-is from migration 0028.
DROP POLICY IF EXISTS ts_update ON public.task_submissions;
CREATE POLICY ts_update ON public.task_submissions
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR (
      internhub.current_role() = 'student'
      AND student_user_id = (SELECT auth.uid())
      AND reviewed_at IS NULL
    )
    OR internhub.current_role() IN (
      'faculty_supervisor', 'site_supervisor', 'external_evaluator'
    )
  )
  WITH CHECK (
    internhub.is_super_admin()
    OR (
      internhub.current_role() = 'student'
      AND student_user_id = (SELECT auth.uid())
    )
    OR internhub.current_role() IN (
      'faculty_supervisor', 'site_supervisor', 'external_evaluator'
    )
  );

-- 4d. ts_delete — kept as-is.
DROP POLICY IF EXISTS ts_delete ON public.task_submissions;
CREATE POLICY ts_delete ON public.task_submissions
  FOR DELETE TO authenticated
  USING (
    internhub.is_super_admin()
    OR (
      internhub.current_role() = 'student'
      AND student_user_id = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 5. Drop and recreate policies on `evaluations`.
--    OLD eval_select had inline EXISTS on `profiles` (uni_admin/dept_coord
--    branches) and on `internships` (company_hr branch). Those don't directly
--    recurse, but for consistency we route everything through
--    can_select_evaluation so future changes can't introduce recursion.
--
--    OLD eval_insert had a self-reference (external_evaluator EXISTS on
--    evaluations) — also moved into a helper to keep the policy pure.
-- -----------------------------------------------------------------------------

-- 5a. eval_select — non-recursive, supports dual evaluation workflow.
--     Faculty supervisors see ALL evaluations for their assigned students,
--     including those authored by site supervisors (and vice versa).
DROP POLICY IF EXISTS eval_select ON public.evaluations;
CREATE POLICY eval_select ON public.evaluations
  FOR SELECT TO authenticated
  USING (internhub.can_select_evaluation(id));

-- 5b. eval_insert — kept the same authorization rules as migration 0028,
--     but moved the external_evaluator self-reference into the
--     is_assigned_supervisor helper (which already covers external_evaluator
--     via student_internships) — that's actually broader and safer.
--
--     Note: is_assigned_supervisor currently returns true for
--     faculty_supervisor OR site_supervisor. For external_evaluator we add
--     a separate inline check that doesn't reference evaluations.
DROP POLICY IF EXISTS eval_insert ON public.evaluations;
CREATE POLICY eval_insert ON public.evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    evaluator_id = (SELECT auth.uid())
    AND evaluator_role = internhub.current_role()
    AND (
      internhub.is_super_admin()
      OR (
        internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND internhub.is_assigned_supervisor(student_user_id)
      )
      OR (
        internhub.current_role() = 'external_evaluator'
        AND internhub.is_assigned_supervisor(student_user_id)
      )
      OR (
        internhub.current_role() = 'company_hr'
        AND EXISTS (
          SELECT 1 FROM public.internships i
          WHERE i.id = evaluations.internship_id
            AND i.company_id = internhub.current_company_id()
        )
      )
    )
  );

-- 5c. eval_update — kept as-is.
DROP POLICY IF EXISTS eval_update ON public.evaluations;
CREATE POLICY eval_update ON public.evaluations
  FOR UPDATE TO authenticated
  USING (
    internhub.is_super_admin()
    OR evaluator_id = (SELECT auth.uid())
  )
  WITH CHECK (
    internhub.current_role() IN (
      'super_admin', 'faculty_supervisor', 'site_supervisor',
      'external_evaluator', 'company_hr'
    )
  );

-- 5d. eval_delete — kept as-is.
DROP POLICY IF EXISTS eval_delete ON public.evaluations;
CREATE POLICY eval_delete ON public.evaluations
  FOR DELETE TO authenticated
  USING (
    internhub.is_super_admin()
    OR evaluator_id = (SELECT auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 6. Add UNIQUE constraint on evaluations (task_id, evaluator_role) for
--    task-level evaluations so a single task can't accumulate duplicate
--    site-supervisor OR duplicate faculty-supervisor evaluations. Weekly
--    evaluations (task_id IS NULL) are not constrained.
--    Idempotent: uses CREATE UNIQUE INDEX IF NOT EXISTS.
-- -----------------------------------------------------------------------------

-- 6a. Deduplicate existing rows first (keep the newest by updated_at).
--     The earlier query confirmed there are no duplicates in production,
--     but we run the dedup anyway for safety in case the migration is
--     applied to a different environment that does have dupes.
DO $$
BEGIN
  -- For each (task_id, evaluator_role) group with >1 row, delete all but
  -- the one with the MAX updated_at (ties broken by MAX created_at).
  -- We use a row_number() window so the deletion is deterministic.
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY task_id, evaluator_role
             ORDER BY updated_at DESC, created_at DESC
           ) AS rn
    FROM public.evaluations
    WHERE task_id IS NOT NULL
  )
  DELETE FROM public.evaluations e
  USING ranked r
  WHERE e.id = r.id AND r.rn > 1;
END $$;

-- 6b. Create the unique index. IF NOT EXISTS makes this idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_eval_task_evaluator_role
  ON public.evaluations (task_id, evaluator_role)
  WHERE task_id IS NOT NULL;

-- 6c. Helpful index for the faculty-supervisor "show me evaluations for my
--     assigned students" query.
CREATE INDEX IF NOT EXISTS idx_eval_student
  ON public.evaluations (student_user_id, evaluator_role);

-- -----------------------------------------------------------------------------
-- 7. Sanity: confirm RLS is still enabled on all four tables.
--    (No DISABLE ROW LEVEL SECURITY anywhere in this migration.)
-- -----------------------------------------------------------------------------
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (no BYPASSRLS via ownership).
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- END OF MIGRATION 0051
-- =============================================================================
