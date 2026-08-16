-- ============================================================================
-- InternHub.pk — 0072 Break infinite RLS recursion between profiles and
--                 internship_applications, and harden is_assigned_supervisor /
--                 is_external_evaluator_of_task against plan-time recursion.
-- ----------------------------------------------------------------------------
-- PROBLEM (production 500 on /super-admin and /super-admin/users)
--   After migration 0066 was applied, every SELECT on `public.profiles`
--   fails with:
--
--     ERROR: 42P17: infinite recursion detected in policy for relation
--     "profiles"
--
--   Reproduced by signing in as admin@internhub.pk and calling:
--     GET /rest/v1/profiles?select=*&order=created_at.desc
--     GET /rest/v1/profiles?select=*,...&user_id=eq.<admin-uuid>
--
-- ROOT CAUSE — recursive cycle between two SELECT policies
--   `profiles_select` (company_hr branch) does an inline EXISTS on
--   `internship_applications`:
--
--     EXISTS (SELECT 1 FROM internship_applications a
--             WHERE a.student_user_id = profiles.user_id
--               AND a.company_id = internhub.current_company_id())
--
--   `app_select` on `internship_applications` (university_admin branch,
--   added by migration 0066) does an inline EXISTS on `profiles`:
--
--     EXISTS (SELECT 1 FROM profiles p
--             WHERE p.user_id = internship_applications.student_user_id
--               AND p.university_id = internhub.current_university_id())
--
--   PostgreSQL detects this cycle at PLAN time and refuses to plan the
--   query — even for super_admin (whose branches would short-circuit at
--   runtime). The same bug exists in the department_coordinator branch
--   of `app_select`.
--
--   Migration 0065 had already broken this cycle by rewriting `app_select`
--   to use the SECURITY DEFINER + row_security=off helper functions
--   `internhub.is_user_in_my_university(p_user)` and
--   `internhub.is_user_in_my_department(p_user)`. Migration 0066 then
--   overwrote `app_select` with the inline-profiles version, reintroducing
--   the recursion.
--
-- SOLUTION
--   1. Rewrite `app_select` to use the existing
--      `internhub.is_user_in_my_university` and
--      `internhub.is_user_in_my_department` SECURITY DEFINER helpers
--      instead of inline `SELECT FROM profiles`. The helpers were created
--      by migration 0065 with `row_security = off`, so the planner does
--      not consider RLS on `profiles` when planning queries that call
--      them — the cycle is broken.
--
--      The semantic is identical: a university_admin / department_coordinator
--      can read an application if EITHER the internship is scoped to their
--      uni/dept OR the applicant's profile is in their uni/dept.
--
--   2. Re-apply `SET row_security = off` to `internhub.is_assigned_supervisor`
--      and `internhub.is_external_evaluator_of_task`. Migration 0063 had
--      added this GUC to `is_assigned_supervisor`, but migration 0071
--      recreated the function without it. Although no current SELECT
--      policy forms a cycle through these functions, the missing GUC is a
--      latent plan-time recursion bug — any future policy that calls
--      them and is itself referenced from `student_internships`,
--      `students`, `tasks`, or `programs` would immediately deadlock the
--      planner.
--
--   3. Add the missing `external_evaluator` branch to `task_select` and
--      `ta_select` so that external_evaluator can actually READ the tasks
--      and task_assignments they are now allowed to INSERT/UPDATE per
--      migration 0071. Uses `internhub.is_external_evaluator_of_task`
--      and `internhub.is_assigned_supervisor` (both SECURITY DEFINER,
--      row_security=off after this migration) — no inline subqueries,
--      no recursion risk.
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS + CREATE POLICY.
--   Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rewrite app_select (internship_applications) — break the cycle
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS app_select ON public.internship_applications;

CREATE POLICY app_select ON public.internship_applications
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    -- student sees own applications
    OR (internhub.current_role() = 'student'
        AND student_user_id = (SELECT auth.uid()))
    -- company_hr sees applications to their company's internships
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
    -- university_admin: internship is scoped to their university
    OR (internhub.current_role() = 'university_admin'
        AND internhub.is_internship_in_my_university(internship_id))
    -- university_admin ALSO sees applications submitted by their own
    -- students (covers company-published internships with university_id
    -- = NULL — open to all universities). Uses the SECURITY DEFINER
    -- helper to avoid inline `SELECT FROM profiles` (which would create
    -- an RLS recursion cycle with profiles_select).
    OR (internhub.current_role() = 'university_admin'
        AND internhub.is_user_in_my_university(student_user_id))
    -- department_coordinator: internship is scoped to their department
    OR (internhub.current_role() = 'department_coordinator'
        AND internhub.is_internship_in_my_department(internship_id))
    -- department_coordinator ALSO sees applications submitted by their
    -- own department's students (same rationale as above).
    OR (internhub.current_role() = 'department_coordinator'
        AND internhub.is_user_in_my_department(student_user_id))
    -- faculty / site / external supervisors: only if student is assigned to them
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor','external_evaluator')
        AND internhub.is_assigned_supervisor(student_user_id))
  );

COMMENT ON POLICY app_select ON public.internship_applications IS
  'super_admin sees all. Students see their own. Company HR sees their '
  'company''s. University admin / department coordinator see applications '
  'whose internship OR applicant profile is in their scope (the applicant-'
  'profile path uses is_user_in_my_university/department SECURITY DEFINER '
  'helpers to avoid RLS recursion with profiles_select). Faculty / site / '
  'external supervisors see applications for students assigned to them.';

-- ----------------------------------------------------------------------------
-- 2. Re-apply row_security = off to is_assigned_supervisor
-- ----------------------------------------------------------------------------
-- CREATE OR REPLACE preserves the OID and all dependent policies.
CREATE OR REPLACE FUNCTION internhub.is_assigned_supervisor(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
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
  --
  -- The function runs as `postgres` (SECURITY DEFINER + BYPASSRLS) and
  -- explicitly sets `row_security = off` so the planner does NOT consider
  -- RLS policies on the inner tables when planning the caller's query.
  -- This breaks the static recursion cycle that would otherwise occur
  -- because students_select / eval_select / profiles_select call this
  -- function and this function queries students / student_internships.
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
  '(program-level indirect, migration 0015). SECURITY DEFINER + '
  'row_security=off — bypasses RLS at both plan time and runtime to '
  'break recursion cycles in dependent SELECT policies.';

-- ----------------------------------------------------------------------------
-- 3. Re-apply row_security = off to is_external_evaluator_of_task
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_external_evaluator_of_task(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
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
  'is_site_supervisor_of_task. SECURITY DEFINER + row_security=off — '
  'bypasses RLS to break recursion cycles.';

-- ----------------------------------------------------------------------------
-- 4. Add external_evaluator branch to task_select
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS task_select ON public.tasks;

CREATE POLICY task_select ON public.tasks
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'::user_role
    OR created_by = (SELECT auth.uid())
    OR (internhub.current_role() = 'student'::user_role
        AND internhub.is_task_assigned_to_me(id))
    OR (internhub.current_role() = 'faculty_supervisor'::user_role AND (
        created_by = (SELECT auth.uid())
        OR internhub.is_task_assigned_to_my_student(id)
        OR internhub.is_internship_assigned_to_me_as_faculty(internship_id)
        OR internhub.is_task_in_my_faculty_programs(id)
    ))
    OR (internhub.current_role() = 'site_supervisor'::user_role AND (
        created_by = (SELECT auth.uid())
        OR internhub.is_task_assigned_to_my_student(id)
        OR internhub.is_internship_assigned_to_me_as_site(internship_id)
    ))
    OR (internhub.current_role() = 'external_evaluator'::user_role AND (
        created_by = (SELECT auth.uid())
        OR internhub.is_task_assigned_to_my_student(id)
        OR internhub.is_external_evaluator_of_task(id)
    ))
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND internhub.is_task_in_my_department(id))
    OR (internhub.current_role() = 'university_admin'::user_role
        AND internhub.is_task_in_my_university(id))
  );

COMMENT ON POLICY task_select ON public.tasks IS
  'Super admin sees all. Creator sees their own. Student sees tasks '
  'assigned to them. Faculty / site / external supervisors see tasks they '
  'created OR tasks for students/internships assigned to them. Coordinator '
  'sees tasks in their department; university admin sees tasks in their '
  'university.';

-- ----------------------------------------------------------------------------
-- 5. Add external_evaluator branch to ta_select (task_assignments)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_select ON public.task_assignments;

CREATE POLICY ta_select ON public.task_assignments
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'::user_role
    OR student_user_id = (SELECT auth.uid())
    OR assigned_by = (SELECT auth.uid())
    OR (internhub.current_role() = 'faculty_supervisor'::user_role
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'site_supervisor'::user_role
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'external_evaluator'::user_role
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'university_admin'::user_role
        AND internhub.is_task_in_my_university(task_id))
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND internhub.is_task_in_my_department(task_id))
  );

COMMENT ON POLICY ta_select ON public.task_assignments IS
  'Super admin sees all. Assignee and assigner see their own. Faculty / '
  'site / external supervisors see assignments for students they supervise. '
  'Coordinator / university admin see assignments in their scope.';

-- ----------------------------------------------------------------------------
-- 6. Reload PostgREST schema cache so the new policies take effect
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 7. Diagnostic — verify all functions have row_security = off
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'internhub'
      AND p.proname IN ('is_assigned_supervisor','is_external_evaluator_of_task',
                        'is_user_in_my_university','is_user_in_my_department',
                        'is_user_in_my_company')
      AND p.prosecdef = true
      AND p.proconfig IS NOT NULL
      AND array_to_string(p.proconfig, ',') LIKE '%row_security=off%';

  IF v_count < 5 THEN
    RAISE EXCEPTION 'Expected >= 5 SECURITY DEFINER + row_security=off helpers, found %', v_count;
  END IF;

  RAISE NOTICE 'Migration 0072: % SECURITY DEFINER helpers have row_security=off', v_count;
END $$;
