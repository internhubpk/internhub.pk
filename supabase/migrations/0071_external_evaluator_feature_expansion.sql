-- ============================================================================
-- InternHub.pk — 0071 External Evaluator feature expansion
-- ----------------------------------------------------------------------------
-- PROBLEM
--   The external_evaluator role currently has only minimal features:
--   read-only access to evaluations assigned to them. The user wants
--   external_evaluator to have ALL site_supervisor features (tasks,
--   weekly logs, student management, notifications) but remain
--   external and independent — i.e. a separate person from the
--   site_supervisor, with their own assignment relationship to the
--   student.
--
--   Currently, external_evaluators are linked to students ONLY through
--   the `evaluations` table (evaluator_id + evaluator_role). There is
--   no `student_internships.external_evaluator_id` column, so:
--     - is_assigned_supervisor() returns false for them
--     - RLS blocks them from tasks, weekly_logs, task_submissions
--     - The site-supervisor dashboard pages won't show any data
--     - Company HR / coordinators can't assign students to them
--
-- SOLUTION
--   1. Add `external_evaluator_id` column to `student_internships`
--      (mirrors `site_supervisor_id`).
--
--   2. Broaden `internhub.is_assigned_supervisor(p_student)` to also
--      check `student_internships.external_evaluator_id = auth.uid()`.
--      (Existing Path 1, 2, 3 are preserved; we just add external_evaluator_id
--      to the Path 1 OR clause.)
--
--   3. Add new helper `internhub.is_external_evaluator_of_task(p_task)`
--      mirroring `is_site_supervisor_of_task`. Add it to
--      `can_select_task()` and `can_select_task_assignment()`.
--
--   4. Broaden `task_insert`, `task_update`, `ta_insert`, `ta_update`
--      WITH CHECK clauses to include `external_evaluator`.
--
--   5. Add `weekly_logs.external_evaluator_*` signature columns.
--
--   6. Broaden `wl_update` policy to include `external_evaluator` (mirror
--      site_supervisor branch).
--
--   7. Broaden `profiles_select` policy's external_evaluator branch to
--      also accept the new `student_internships.external_evaluator_id`
--      link (in addition to the existing `evaluations.evaluator_id` check).
--
--   8. Update `weekly_logs_with_names` view to include external_evaluator.
--
--   9. Backfill `student_internships.external_evaluator_id` from existing
--      active evaluations rows.
--
-- IDEMPOTENT
--   ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION, DROP POLICY
--   IF EXISTS + CREATE POLICY. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add student_internships.external_evaluator_id
-- ----------------------------------------------------------------------------
ALTER TABLE public.student_internships
  ADD COLUMN IF NOT EXISTS external_evaluator_id uuid
    REFERENCES profiles(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_si_external_evaluator
  ON public.student_internships(external_evaluator_id)
  WHERE external_evaluator_id IS NOT NULL;

COMMENT ON COLUMN public.student_internships.external_evaluator_id IS
  'The external evaluator assigned to this student-internship. Mirrors '
  'site_supervisor_id but for the external_evaluator role. Set by '
  'company HR or department coordinators via the Assign External '
  'Evaluator UI. NULL when no external evaluator is assigned.';

-- ----------------------------------------------------------------------------
-- 2. Broaden is_assigned_supervisor() — add external_evaluator_id to Path 1
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_assigned_supervisor(p_student uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- A supervisor is "assigned" to a student if ANY of the following holds:
  --
  --   Path 1 (internship-time): there exists a student_internships row
  --     where the current user is the faculty_supervisor_id,
  --     site_supervisor_id, OR external_evaluator_id AND the internship
  --     is in an active state.
  --
  --   Path 2 (pre-internship direct): the student's row in `students`
  --     has faculty_supervisor_id = current user.
  --
  --   Path 3 (program-level indirect): the student is enrolled in a
  --     program whose default_faculty_supervisor_id = current user.
  SELECT
    EXISTS (
      SELECT 1 FROM public.student_internships si
        WHERE si.student_user_id = p_student
          AND (
            si.faculty_supervisor_id = (select auth.uid())
            OR si.site_supervisor_id = (select auth.uid())
            OR si.external_evaluator_id = (select auth.uid())
          )
          AND si.status IN ('assigned','active')
    )
    OR EXISTS (
      SELECT 1 FROM public.students s
        WHERE s.user_id = p_student
          AND s.faculty_supervisor_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1
        FROM public.students s
        JOIN public.programs p ON p.id = s.program_id
        WHERE s.user_id = p_student
          AND p.default_faculty_supervisor_id = (select auth.uid())
    );
$$;

COMMENT ON FUNCTION internhub.is_assigned_supervisor(uuid) IS
  'Returns true if the current auth user is an assigned supervisor for the '
  'given student user_id. Checks three assignment paths: (1) '
  'student_internships.faculty_supervisor_id, site_supervisor_id, OR '
  'external_evaluator_id with active status; (2) students.faculty_'
  'supervisor_id (pre-internship direct assignment, migration 0041); '
  '(3) programs.default_faculty_supervisor_id for the student''s program '
  '(program-level indirect, migration 0015). SECURITY DEFINER — bypasses '
  'RLS to avoid recursion.';

GRANT EXECUTE ON FUNCTION internhub.is_assigned_supervisor(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 3. Add is_external_evaluator_of_task helper (mirrors is_site_supervisor_of_task)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_external_evaluator_of_task(p_task uuid)
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
      AND si.external_evaluator_id = (SELECT auth.uid())
      AND si.status IN ('assigned','active')
  );
$$;

COMMENT ON FUNCTION internhub.is_external_evaluator_of_task(uuid) IS
  'Returns true if the current auth user is the external_evaluator of '
  'any student in the internship that this task belongs to. Mirrors '
  'is_site_supervisor_of_task. SECURITY DEFINER — bypasses RLS.';

REVOKE EXECUTE ON FUNCTION internhub.is_external_evaluator_of_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internhub.is_external_evaluator_of_task(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Broaden can_select_task() to include external_evaluator
-- ----------------------------------------------------------------------------
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
        internhub.current_role() = 'external_evaluator'
        AND internhub.is_external_evaluator_of_task(p_task)
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

REVOKE EXECUTE ON FUNCTION internhub.can_select_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internhub.can_select_task(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Broaden can_select_task_assignment() to include external_evaluator
-- ----------------------------------------------------------------------------
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
            internhub.current_role() = 'external_evaluator'
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

REVOKE EXECUTE ON FUNCTION internhub.can_select_task_assignment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internhub.can_select_task_assignment(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Add weekly_logs.external_evaluator_* columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.weekly_logs
  ADD COLUMN IF NOT EXISTS external_evaluator_id            uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_evaluator_signature_url text,
  ADD COLUMN IF NOT EXISTS external_evaluator_remarks       text,
  ADD COLUMN IF NOT EXISTS external_evaluator_signed_at     timestamptz;

CREATE INDEX IF NOT EXISTS idx_wl_external_evaluator
  ON public.weekly_logs(external_evaluator_id)
  WHERE external_evaluator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wl_external_signed_at
  ON public.weekly_logs(external_evaluator_signed_at);

-- ----------------------------------------------------------------------------
-- 7. Broaden task_insert, task_update, ta_insert, ta_update to include external_evaluator
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS task_insert ON public.tasks;
CREATE POLICY task_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND internhub.current_role() IN (
      'super_admin',
      'faculty_supervisor',
      'site_supervisor',
      'external_evaluator',
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
      'external_evaluator',
      'university_admin',
      'department_coordinator'
    )
  );

DROP POLICY IF EXISTS ta_insert ON public.task_assignments;
CREATE POLICY ta_insert ON public.task_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = (SELECT auth.uid())
    AND internhub.current_role() IN (
      'super_admin',
      'faculty_supervisor',
      'site_supervisor',
      'external_evaluator',
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
      'faculty_supervisor', 'site_supervisor', 'external_evaluator',
      'university_admin', 'department_coordinator'
    )
  )
  WITH CHECK (
    internhub.current_role() IN (
      'faculty_supervisor', 'site_supervisor', 'external_evaluator',
      'university_admin', 'department_coordinator',
      'super_admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 8. Broaden wl_update to include external_evaluator
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wl_update ON public.weekly_logs;
CREATE POLICY wl_update ON public.weekly_logs
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (
      internhub.current_role() = 'student'
      AND student_user_id = (SELECT auth.uid())
      AND site_supervisor_signed_at IS NULL
      AND faculty_supervisor_signed_at IS NULL
      AND external_evaluator_signed_at IS NULL
    )
    OR (
      internhub.current_role() IN (
        'faculty_supervisor',
        'site_supervisor',
        'external_evaluator'
      )
      AND internhub.is_assigned_supervisor(student_user_id)
    )
  )
  WITH CHECK (
    internhub.current_role() IN (
      'super_admin',
      'student',
      'faculty_supervisor',
      'site_supervisor',
      'external_evaluator'
    )
  );

COMMENT ON POLICY wl_update ON public.weekly_logs IS
  'Students can edit their own weekly logs until a supervisor signs; '
  'supervisors (faculty / site / external) can sign/remark ONLY on logs '
  'for students assigned to them; super_admin can edit anything.';

-- ----------------------------------------------------------------------------
-- 9. Broaden profiles_select — external_evaluator branch
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR internhub.is_super_admin()
    OR (
      internhub.current_role() = 'university_admin'
      AND university_id = internhub.current_university_id()
    )
    OR (
      internhub.current_role() = 'department_coordinator'
      AND department_id = internhub.current_department_id()
    )
    OR (
      internhub.current_role() = 'company_hr'
      AND (
        company_id = internhub.current_company_id()
        OR EXISTS (
          SELECT 1 FROM public.internship_applications a
            WHERE a.student_user_id = profiles.user_id
              AND a.company_id = internhub.current_company_id()
        )
      )
    )
    OR (
      internhub.current_role() IN ('faculty_supervisor','site_supervisor')
      AND internhub.is_assigned_supervisor(user_id)
    )
    OR (
      internhub.current_role() = 'external_evaluator'
      AND (
        internhub.is_assigned_supervisor(user_id)
        OR EXISTS (
          SELECT 1 FROM public.evaluations e
            WHERE e.evaluator_id = (select auth.uid())
              AND e.student_user_id = profiles.user_id
        )
      )
    )
    -- Students can see their assigned supervisors (faculty / site / external)
    OR (
      internhub.current_role() = 'student'
      AND user_id IN (
        SELECT si.faculty_supervisor_id FROM public.student_internships si
          WHERE si.student_user_id = (select auth.uid())
            AND si.faculty_supervisor_id IS NOT NULL
        UNION
        SELECT si.site_supervisor_id FROM public.student_internships si
          WHERE si.student_user_id = (select auth.uid())
            AND si.site_supervisor_id IS NOT NULL
        UNION
        SELECT si.external_evaluator_id FROM public.student_internships si
          WHERE si.student_user_id = (select auth.uid())
            AND si.external_evaluator_id IS NOT NULL
      )
    )
  );

COMMENT ON POLICY profiles_select ON public.profiles IS
  'Self + super_admin sees all. University admin sees their university. '
  'Department coordinator sees their department. Faculty/site/external '
  'supervisors see students assigned to them. Company HR sees their '
  'company. Students see their assigned supervisors (faculty, site, '
  'external).';

-- ----------------------------------------------------------------------------
-- 10. Update weekly_logs_with_names view to include external_evaluator
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.weekly_logs_with_names AS
SELECT
  wl.*,
  st.full_name         AS student_name,
  st.email             AS student_email,
  st.avatar_url        AS student_avatar_url,
  ssp.full_name        AS site_supervisor_name,
  fsp.full_name        AS faculty_supervisor_name,
  eesp.full_name       AS external_evaluator_name,
  i.title              AS internship_title,
  c.name               AS internship_host_org
FROM public.weekly_logs wl
LEFT JOIN profiles   st  ON st.user_id  = wl.student_user_id
LEFT JOIN profiles   ssp ON ssp.user_id = wl.site_supervisor_id
LEFT JOIN profiles   fsp ON fsp.user_id = wl.faculty_supervisor_id
LEFT JOIN profiles   eesp ON eesp.user_id = wl.external_evaluator_id
LEFT JOIN internships i  ON i.id        = wl.internship_id
LEFT JOIN companies   c  ON c.id        = i.company_id;

COMMENT ON VIEW public.weekly_logs_with_names IS
  'Weekly logs joined with student/site-supervisor/faculty-supervisor/'
  'external-evaluator profiles + internship + company names.';

-- ----------------------------------------------------------------------------
-- 11. Backfill student_internships.external_evaluator_id from evaluations
-- ----------------------------------------------------------------------------
UPDATE public.student_internships si
SET external_evaluator_id = sub.evaluator_id,
    updated_at = COALESCE(si.updated_at, now())
FROM (
  SELECT DISTINCT ON (e.student_internship_id)
    e.student_internship_id,
    e.evaluator_id
  FROM public.evaluations e
  WHERE e.evaluator_role = 'external_evaluator'
    AND e.evaluator_id IS NOT NULL
    AND e.student_internship_id IS NOT NULL
    AND e.status IN ('pending','in_progress','submitted')
  ORDER BY e.student_internship_id, e.updated_at DESC
) sub
WHERE si.id = sub.student_internship_id
  AND si.external_evaluator_id IS NULL;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 12. Diagnostic — verify everything is in place
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_col_exists boolean;
  v_fn_count int;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'student_internships'
        AND column_name = 'external_evaluator_id'
  ) INTO v_col_exists;
  IF NOT v_col_exists THEN
    RAISE EXCEPTION 'student_internships.external_evaluator_id column missing — migration failed';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'weekly_logs'
        AND column_name = 'external_evaluator_id'
  ) INTO v_col_exists;
  IF NOT v_col_exists THEN
    RAISE EXCEPTION 'weekly_logs.external_evaluator_id column missing — migration failed';
  END IF;

  SELECT COUNT(*) INTO v_fn_count
    FROM pg_proc
    WHERE proname = 'is_external_evaluator_of_task'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'internhub');
  IF v_fn_count = 0 THEN
    RAISE EXCEPTION 'is_external_evaluator_of_task function missing — migration failed';
  END IF;

  RAISE NOTICE 'Migration 0071 complete: external_evaluator feature plumbing in place';
END $$;

-- ----------------------------------------------------------------------------
-- 13. Summary — show backfill results
-- ----------------------------------------------------------------------------
SELECT
  'student_internships with external_evaluator_id' AS metric,
  COUNT(*) AS value
FROM public.student_internships
WHERE external_evaluator_id IS NOT NULL
UNION ALL
SELECT
  'weekly_logs external_evaluator columns' AS metric,
  COUNT(*) AS value
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'weekly_logs'
  AND column_name LIKE 'external_evaluator%';
