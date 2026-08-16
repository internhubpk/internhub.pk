-- 0051_evaluations_recursion_fix_and_backfill.sql
-- =============================================================================
-- InternHub — Merged migration 0051.
--
-- This file MERGES two former migrations that both used version 0051 and thus
-- collided on the `supabase_migrations.schema_migrations` primary key:
--
--   0051_fix_rls_recursion_dual_evaluations.sql  (added in 0ec29df)
--   0051_backfill_pending_evaluations.sql        (added in 1e8129a)
--
-- Ordering rationale:
--   1. First create SECURITY DEFINER helper functions and rewrite the RLS
--      policies so the recursion that was INTRODUCED in migration 0050
--      (task_select ↔ ta_select inline EXISTS) is eliminated.
--   2. Then run the backfill INSERTs. The migration runner connects as a
--      role with BYPASSRLS (postgres / service_role), so the new policies
--      do not affect the INSERT...SELECT.
--   3. Then deduplicate any (task_id, evaluator_role) collisions that the
--      backfill might have introduced (e.g. one task with multiple
--      submissions each getting its own faculty evaluation).
--   4. Finally create the UNIQUE index to prevent future duplicates.
--
-- All statements are idempotent (CREATE OR REPLACE / DROP IF EXISTS + CREATE
-- / IF NOT EXISTS) so the migration can be re-run safely.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- PART 1 — SECURITY DEFINER helper functions (from former
--          0051_fix_rls_recursion_dual_evaluations.sql)
--
-- Every function:
--   - is owned by postgres (the migration runner)
--   - has SET search_path TO 'public'
--   - is STABLE for SELECT-only helpers
--   - bypasses RLS on the tables it reads (SECURITY DEFINER + owner bypass)
-- -----------------------------------------------------------------------------

-- 1a. Is the current user a student who has a task_assignments row for p_task?
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
          OR (
            internhub.current_role() = 'faculty_supervisor'
            AND internhub.is_assigned_supervisor(ta.student_user_id)
          )
          OR (
            internhub.current_role() = 'site_supervisor'
            AND internhub.is_assigned_supervisor(ta.student_user_id)
          )
          OR (
            internhub.current_role() = 'department_coordinator'
            AND internhub.is_task_in_my_department(ta.task_id)
          )
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
          OR (
            SELECT t.created_by = (SELECT auth.uid())
            FROM public.tasks t
            WHERE t.id = ts.task_id
          )
          OR (
            internhub.current_role() IN ('faculty_supervisor','site_supervisor')
            AND internhub.is_assigned_supervisor(ts.student_user_id)
          )
          OR (
            internhub.current_role() = 'external_evaluator'
            AND internhub.is_assigned_supervisor(ts.student_user_id)
          )
          OR (
            internhub.current_role() = 'department_coordinator'
            AND internhub.is_task_in_my_department(ts.task_id)
          )
          OR (
            internhub.current_role() = 'university_admin'
            AND internhub.is_task_in_my_university(ts.task_id)
          )
        )
    );
$$;

-- 1i. Combined: can the current user SELECT this evaluation?
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

-- 1j. Is the current user permitted to INSERT a task_submission for a given task?
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
-- PART 2 — Drop and recreate policies using helpers (from former
--          0051_fix_rls_recursion_dual_evaluations.sql)
-- -----------------------------------------------------------------------------

-- 2a. tasks policies
DROP POLICY IF EXISTS task_select ON public.tasks;
CREATE POLICY task_select ON public.tasks
  FOR SELECT TO authenticated
  USING (internhub.can_select_task(id));

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

DROP POLICY IF EXISTS task_delete ON public.tasks;
CREATE POLICY task_delete ON public.tasks
  FOR DELETE TO authenticated
  USING (
    internhub.is_super_admin()
    OR created_by = (SELECT auth.uid())
  );

-- 2b. task_assignments policies
DROP POLICY IF EXISTS ta_select ON public.task_assignments;
CREATE POLICY ta_select ON public.task_assignments
  FOR SELECT TO authenticated
  USING (internhub.can_select_task_assignment(id));

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

DROP POLICY IF EXISTS ta_delete ON public.task_assignments;
CREATE POLICY ta_delete ON public.task_assignments
  FOR DELETE TO authenticated
  USING (
    internhub.is_super_admin()
    OR assigned_by = (SELECT auth.uid())
  );

-- 2c. task_submissions policies
DROP POLICY IF EXISTS ts_select ON public.task_submissions;
CREATE POLICY ts_select ON public.task_submissions
  FOR SELECT TO authenticated
  USING (internhub.can_select_task_submission(id));

DROP POLICY IF EXISTS ts_insert ON public.task_submissions;
CREATE POLICY ts_insert ON public.task_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_user_id = (SELECT auth.uid())
    AND internhub.current_role() = 'student'
    AND internhub.can_submit_task(task_id, student_user_id)
  );

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

-- 2d. evaluations policies
DROP POLICY IF EXISTS eval_select ON public.evaluations;
CREATE POLICY eval_select ON public.evaluations
  FOR SELECT TO authenticated
  USING (internhub.can_select_evaluation(id));

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

DROP POLICY IF EXISTS eval_delete ON public.evaluations;
CREATE POLICY eval_delete ON public.evaluations
  FOR DELETE TO authenticated
  USING (
    internhub.is_super_admin()
    OR evaluator_id = (SELECT auth.uid())
  );

-- -----------------------------------------------------------------------------
-- PART 3 — Backfill missing pending evaluations (from former
--          0051_backfill_pending_evaluations.sql)
--
-- The /api/student/tasks route auto-creates a pending evaluation when a
-- student submits a task. But that auto-creation only fires for NEW
-- submissions — and historically it depended on
-- `student_internships.faculty_supervisor_id` being populated, which was
-- NULL for many rows before migration 0050's backfill ran.
--
-- This section scans `task_submissions` and creates a pending evaluation
-- for each one that doesn't yet have one, attributing it to the student's
-- faculty supervisor (resolved via student_internships, falling back to
-- students.faculty_supervisor_id).
--
-- Runs as the migration runner (postgres / service_role), which bypasses
-- RLS, so the eval_insert WITH CHECK constraint does not gate this INSERT.
-- -----------------------------------------------------------------------------

-- 3a. Backfill for task_submissions
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

-- 3b. Backfill for weekly_logs: create a pending evaluation for each
--     submitted weekly log that doesn't yet have one. This populates the
--     faculty supervisor's "Pending Review" queue for weekly logs too.
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
        ABS(EXTRACT(EPOCH FROM (e.created_at - wl.submitted_at))) < 60
      )
  );

-- -----------------------------------------------------------------------------
-- PART 4 — Deduplicate evaluations per (task_id, evaluator_role) (from former
--          0051_fix_rls_recursion_dual_evaluations.sql)
--
-- The backfill in Part 3 might create multiple faculty evaluations for the
-- same task (e.g. one per submission). Before we add the UNIQUE index in
-- Part 5, we deduplicate — keep only the newest evaluation per
-- (task_id, evaluator_role) where task_id IS NOT NULL.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  -- For each (task_id, evaluator_role) group with >1 row, delete all but
  -- the one with the MAX updated_at (ties broken by MAX created_at).
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

-- -----------------------------------------------------------------------------
-- PART 5 — Create UNIQUE index on evaluations (task_id, evaluator_role) (from
--          former 0051_fix_rls_recursion_dual_evaluations.sql)
--
-- Ensures each task can have at most one site_supervisor evaluation and at
-- most one faculty_supervisor evaluation. Weekly evaluations (task_id IS
-- NULL) remain unrestricted.
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uniq_eval_task_evaluator_role
  ON public.evaluations (task_id, evaluator_role)
  WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eval_student
  ON public.evaluations (student_user_id, evaluator_role);

-- -----------------------------------------------------------------------------
-- PART 6 — Sanity: confirm RLS is still enabled on all four tables.
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

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Diagnostic: how many pending faculty evaluations exist now?
SELECT
  (SELECT COUNT(*) FROM evaluations
    WHERE evaluator_role = 'faculty_supervisor' AND status = 'pending') AS pending_faculty_evaluations,
  (SELECT COUNT(*) FROM evaluations
    WHERE evaluator_role = 'faculty_supervisor' AND status IN ('submitted','approved','rejected')) AS completed_faculty_evaluations;

-- =============================================================================
-- END OF MIGRATION 0051
-- =============================================================================
