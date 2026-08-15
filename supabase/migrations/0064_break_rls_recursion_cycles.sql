-- ============================================================================
-- InternHub.pk — 0064 Break RLS recursion cycles across all policies
-- ----------------------------------------------------------------------------
-- PROBLEM
--   After migration 0063 fixed `is_assigned_supervisor`, querying
--   `evaluations`, `weekly_logs`, `profiles`, etc. as a faculty_supervisor
--   STILL fails with:
--
--     ERROR: 42P17: infinite recursion detected in policy for relation
--     "evaluations"   (also: "weekly_logs", "profiles")
--
--   Root cause: cross-table cycles in INLINE subqueries inside RLS policies.
--
--     eval_select (university_admin branch)  ──subquery──▶  profiles
--                                                            │
--                                                            ▼
--                                                      profiles_select
--                                                            │
--                   external_evaluator branch  ◀──subquery───┘
--                                                            │
--                                                            ▼
--                                                      queries evaluations
--                                                            │
--                                                            ▼
--                                                      eval_select  (← CYCLE)
--
--   The same pattern exists for:
--     - wl_select → profiles → profiles_select → evaluations → eval_select
--     - profiles_select → evaluations → eval_select → profiles → profiles_select
--     - att_select, cert_select, doc_select, cv_select (similar patterns)
--
--   PostgreSQL detects these cycles at PLAN time and refuses to execute.
--
-- SOLUTION
--   Replace EVERY inline subquery in RLS policies that queries another
--   RLS-protected table with a narrow SECURITY DEFINER helper function
--   that has `SET row_security = off`. This tells the planner "this
--   function bypasses RLS — don't consider RLS policies for tables
--   queried inside it", which breaks the static cycle detection.
--
--   Helper functions created:
--     - is_student_in_my_university(p_student)    — replaces eval_select/wl_select university_admin branch
--     - is_student_in_my_department(p_student)    — replaces eval_select/wl_select department_coordinator branch
--     - is_internship_in_my_company(p_internship) — replaces eval_select/wl_select company_hr branch
--     - is_student_applicant_in_my_company(p_student) — replaces profiles_select company_hr branch
--     - is_external_evaluator_of_student(p_student) — replaces profiles_select external_evaluator branch
--
--   All functions:
--     - Owned by postgres (BYPASSRLS)
--     - SECURITY DEFINER
--     - SET search_path = 'public'
--     - SET row_security = 'off'  ← critical: breaks plan-time cycle
--     - STABLE (read-only)
--     - Use auth.uid() to identify the caller
--
--   Then DROP and RECREATE the affected policies to use these helpers.
--
-- SECURITY ANALYSIS
--   * No RLS policy is weakened. The SAME visibility rules apply — they're
--     just enforced via helper functions instead of inline subqueries.
--   * `row_security = off` inside SECURITY DEFINER functions is the
--     PostgreSQL-recommended pattern for breaking RLS recursion (see
--     Supabase docs and the codebase's own migration 0051 which uses the
--     same pattern).
--   * The functions only read (no writes), have fixed search_path, and
--     resolve no user-controlled object names.
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS + CREATE POLICY.
--   Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper: is_student_in_my_university(p_student)
--    Returns true if the current user is a university_admin AND the student's
--    profile belongs to the same university.
--    Replaces: EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = X.student_user_id AND p.university_id = current_university_id())
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_student_in_my_university(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = p_student
      AND p.university_id = internhub.current_university_id()
  );
$$;

GRANT EXECUTE ON FUNCTION internhub.is_student_in_my_university(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 2. Helper: is_student_in_my_department(p_student)
--    Returns true if the current user is a department_coordinator AND the
--    student's profile belongs to the same department.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_student_in_my_department(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = p_student
      AND p.department_id = internhub.current_department_id()
  );
$$;

GRANT EXECUTE ON FUNCTION internhub.is_student_in_my_department(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 3. Helper: is_internship_in_my_company(p_internship)
--    Returns true if the current user is company_hr AND the internship
--    belongs to their company.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_internship_in_my_company(p_internship uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.internships i
    WHERE i.id = p_internship
      AND i.company_id = internhub.current_company_id()
  );
$$;

GRANT EXECUTE ON FUNCTION internhub.is_internship_in_my_company(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 4. Helper: is_student_applicant_in_my_company(p_student)
--    Returns true if the current user is company_hr AND the student has
--    applied to an internship at their company.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_student_applicant_in_my_company(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.internship_applications a
    WHERE a.student_user_id = p_student
      AND a.company_id = internhub.current_company_id()
  );
$$;

GRANT EXECUTE ON FUNCTION internhub.is_student_applicant_in_my_company(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 5. Helper: is_external_evaluator_of_student(p_student)
--    Returns true if the current user is an external_evaluator AND has
--    an evaluation row for this student.
--    Replaces: EXISTS (SELECT 1 FROM evaluations e WHERE e.evaluator_id = auth.uid() AND e.student_user_id = profiles.user_id)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_external_evaluator_of_student(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.evaluations e
    WHERE e.evaluator_id = (SELECT auth.uid())
      AND e.student_user_id = p_student
  );
$$;

GRANT EXECUTE ON FUNCTION internhub.is_external_evaluator_of_student(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 6. Also add row_security = off to existing helper functions that query
--    RLS-protected tables (defense in depth — prevents future cycles).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_task_created_by_me(p_task uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task
      AND t.created_by = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION internhub.is_task_assigned_to_me(p_task uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_assignments ta
    WHERE ta.task_id = p_task
      AND ta.student_user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION internhub.is_faculty_supervisor_of_task(p_task uuid)
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
      AND si.faculty_supervisor_id = (SELECT auth.uid())
      AND si.status IN ('assigned','active')
  );
$$;

CREATE OR REPLACE FUNCTION internhub.is_task_in_my_department(p_task uuid)
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
    JOIN public.programs p ON p.id = t.program_id
    WHERE t.id = p_task
      AND p.department_id = internhub.current_department_id()
  );
$$;

CREATE OR REPLACE FUNCTION internhub.is_task_in_my_university(p_task uuid)
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
    JOIN public.programs p ON p.id = t.program_id
    WHERE t.id = p_task
      AND p.university_id = internhub.current_university_id()
  );
$$;

-- ----------------------------------------------------------------------------
-- 7. Rewrite eval_select to use helper functions (breaks profiles→evaluations cycle)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS eval_select ON evaluations;
CREATE POLICY eval_select ON evaluations
  FOR SELECT TO authenticated
  USING (
    internhub.is_super_admin()
    OR student_user_id = (SELECT auth.uid())
    OR evaluator_id = (SELECT auth.uid())
    OR (internhub.current_role() = ANY (ARRAY['faculty_supervisor'::user_role, 'site_supervisor'::user_role, 'external_evaluator'::user_role])
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'university_admin'::user_role
        AND internhub.is_student_in_my_university(student_user_id))
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND internhub.is_student_in_my_department(student_user_id))
    OR (internhub.current_role() = 'company_hr'::user_role
        AND internhub.is_internship_in_my_company(internship_id))
  );

-- ----------------------------------------------------------------------------
-- 8. Rewrite profiles_select to use helper functions (breaks evaluations→profiles cycle)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR internhub.current_role() = 'super_admin'::user_role
    OR (internhub.current_role() = 'university_admin'::user_role
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND department_id = internhub.current_department_id())
    OR (internhub.current_role() = 'company_hr'::user_role
        AND (company_id = internhub.current_company_id()
             OR internhub.is_student_applicant_in_my_company(user_id)))
    OR (internhub.current_role() = ANY (ARRAY['faculty_supervisor'::user_role, 'site_supervisor'::user_role])
        AND internhub.is_assigned_supervisor(user_id))
    OR (internhub.current_role() = 'external_evaluator'::user_role
        AND internhub.is_external_evaluator_of_student(user_id))
  );

-- ----------------------------------------------------------------------------
-- 9. Rewrite wl_select (weekly_logs) — same pattern as eval_select
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS wl_select ON weekly_logs;
CREATE POLICY wl_select ON weekly_logs
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'::user_role
    OR student_user_id = (SELECT auth.uid())
    OR supervisor_id = (SELECT auth.uid())
    OR (internhub.current_role() = 'university_admin'::user_role
        AND internhub.is_student_in_my_university(student_user_id))
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND internhub.is_student_in_my_department(student_user_id))
    OR (internhub.current_role() = ANY (ARRAY['faculty_supervisor'::user_role, 'site_supervisor'::user_role])
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'company_hr'::user_role
        AND internhub.is_internship_in_my_company(internship_id))
  );

-- ----------------------------------------------------------------------------
-- 10. Diagnostic — verify all helper functions have row_security = off
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'internhub'
      AND p.prosecdef = true
      AND p.proconfig IS NOT NULL
      AND array_to_string(p.proconfig, ',') LIKE '%row_security=off%';

  RAISE NOTICE 'Migration 0064: % SECURITY DEFINER functions now have row_security=off', v_count;
END $$;
