-- ============================================================================
-- InternHub.pk — 0065 Break remaining RLS recursion cycles (tasks, attendance,
-- cv_uploads, documents, internship_applications, internships)
-- ----------------------------------------------------------------------------
-- After 0063 + 0064, the evaluations/profiles/weekly_logs cycle is broken.
-- But querying `tasks`, `task_assignments`, `attendance`, `cv_uploads`,
-- `documents`, `internship_applications`, `internships` still fails with
-- "infinite recursion detected in policy" because those policies also use
-- inline subqueries that cycle back.
--
-- This migration:
--   1. Creates the remaining helper functions (all SECURITY DEFINER +
--      row_security=off).
--   2. Rewrites EVERY affected SELECT policy to use helper functions
--      instead of inline subqueries.
--
-- All functions follow the same pattern as 0063/0064:
--   - Owned by postgres (BYPASSRLS)
--   - SECURITY DEFINER
--   - SET search_path = 'public'
--   - SET row_security = 'off'
--   - STABLE (read-only)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: is_task_assigned_to_my_student(p_task)
--   True if any task_assignment for this task has a student supervised by me.
--   Replaces: EXISTS (SELECT 1 FROM task_assignments ta WHERE ta.task_id = tasks.id AND is_assigned_supervisor(ta.student_user_id))
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_task_assigned_to_my_student(p_task uuid)
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
      AND internhub.is_assigned_supervisor(ta.student_user_id)
  );
$$;
GRANT EXECUTE ON FUNCTION internhub.is_task_assigned_to_my_student(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- Helper: is_user_in_my_university(p_user)
--   True if the user's profile belongs to my university.
--   For doc_select (uploaded_by filter).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_user_in_my_university(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = p_user
      AND p.university_id = internhub.current_university_id()
  );
$$;
GRANT EXECUTE ON FUNCTION internhub.is_user_in_my_university(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- Helper: is_user_in_my_department(p_user)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_user_in_my_department(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = p_user
      AND p.department_id = internhub.current_department_id()
  );
$$;
GRANT EXECUTE ON FUNCTION internhub.is_user_in_my_department(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- Helper: is_user_in_my_company(p_user)
--   True if the user's profile belongs to my company.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_user_in_my_company(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = p_user
      AND p.company_id = internhub.current_company_id()
  );
$$;
GRANT EXECUTE ON FUNCTION internhub.is_user_in_my_company(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- Helper: is_internship_in_my_university(p_internship)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_internship_in_my_university(p_internship uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internships i
    WHERE i.id = p_internship
      AND i.university_id = internhub.current_university_id()
  );
$$;
GRANT EXECUTE ON FUNCTION internhub.is_internship_in_my_university(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- Helper: is_internship_in_my_department(p_internship)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_internship_in_my_department(p_internship uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internships i
    WHERE i.id = p_internship
      AND i.department_id = internhub.current_department_id()
  );
$$;
GRANT EXECUTE ON FUNCTION internhub.is_internship_in_my_department(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- Helper: is_internship_assigned_to_me_as_faculty(p_internship)
--   True if I'm the faculty_supervisor on any student_internships row for
--   this internship.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_internship_assigned_to_me_as_faculty(p_internship uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_internships si
    WHERE si.internship_id = p_internship
      AND si.faculty_supervisor_id = (SELECT auth.uid())
  );
$$;
GRANT EXECUTE ON FUNCTION internhub.is_internship_assigned_to_me_as_faculty(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- Helper: is_internship_assigned_to_me_as_site(p_internship)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_internship_assigned_to_me_as_site(p_internship uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_internships si
    WHERE si.internship_id = p_internship
      AND si.site_supervisor_id = (SELECT auth.uid())
  );
$$;
GRANT EXECUTE ON FUNCTION internhub.is_internship_assigned_to_me_as_site(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- Helper: is_task_in_my_faculty_programs(p_task)
--   True if the task's program matches any program where I'm the
--   default faculty supervisor (via student_internships).
--   Replaces: EXISTS (SELECT 1 FROM student_internships si WHERE si.faculty_supervisor_id = auth.uid() AND si.program_id = tasks.program_id)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.is_task_in_my_faculty_programs(p_task uuid)
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
    JOIN public.student_internships si ON si.program_id = t.program_id
    WHERE t.id = p_task
      AND si.faculty_supervisor_id = (SELECT auth.uid())
  );
$$;
GRANT EXECUTE ON FUNCTION internhub.is_task_in_my_faculty_programs(uuid) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- Rewrite task_select
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS task_select ON tasks;
CREATE POLICY task_select ON tasks
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
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND internhub.is_task_in_my_department(id))
    OR (internhub.current_role() = 'university_admin'::user_role
        AND internhub.is_task_in_my_university(id))
  );

-- ----------------------------------------------------------------------------
-- Rewrite ta_select (task_assignments)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS ta_select ON task_assignments;
CREATE POLICY ta_select ON task_assignments
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'::user_role
    OR student_user_id = (SELECT auth.uid())
    OR assigned_by = (SELECT auth.uid())
    OR (internhub.current_role() = 'faculty_supervisor'::user_role
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'site_supervisor'::user_role
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'university_admin'::user_role
        AND internhub.is_task_in_my_university(task_id))
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND internhub.is_task_in_my_department(task_id))
  );

-- ----------------------------------------------------------------------------
-- Rewrite att_select (attendance)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS att_select ON attendance;
CREATE POLICY att_select ON attendance
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'::user_role
    OR student_user_id = (SELECT auth.uid())
    OR (internhub.current_role() = 'company_hr'::user_role
        AND internhub.is_internship_in_my_company(internship_id))
    OR (internhub.current_role() = 'university_admin'::user_role
        AND internhub.is_student_in_my_university(student_user_id))
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND internhub.is_student_in_my_department(student_user_id))
    OR (internhub.current_role() = ANY (ARRAY['faculty_supervisor'::user_role, 'site_supervisor'::user_role])
        AND internhub.is_assigned_supervisor(student_user_id))
  );

-- ----------------------------------------------------------------------------
-- Rewrite cv_select (cv_uploads)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS cv_select ON cv_uploads;
CREATE POLICY cv_select ON cv_uploads
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'::user_role
    OR student_user_id = (SELECT auth.uid())
    OR (internhub.current_role() = 'company_hr'::user_role
        AND internhub.is_student_applicant_in_my_company(student_user_id))
    OR (internhub.current_role() = ANY (ARRAY['faculty_supervisor'::user_role, 'site_supervisor'::user_role])
        AND internhub.is_assigned_supervisor(student_user_id))
    OR (internhub.current_role() = 'university_admin'::user_role
        AND internhub.is_student_in_my_university(student_user_id))
  );

-- ----------------------------------------------------------------------------
-- Rewrite doc_select (documents)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS doc_select ON documents;
CREATE POLICY doc_select ON documents
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'::user_role
    OR uploaded_by = (SELECT auth.uid())
    OR (entity_type = 'student' AND entity_id = (SELECT auth.uid()))
    OR (internhub.current_role() = 'university_admin'::user_role
        AND internhub.is_user_in_my_university(uploaded_by))
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND internhub.is_user_in_my_department(uploaded_by))
    OR (internhub.current_role() = 'company_hr'::user_role
        AND internhub.is_user_in_my_company(uploaded_by))
    OR (internhub.current_role() = ANY (ARRAY['faculty_supervisor'::user_role, 'site_supervisor'::user_role])
        AND entity_type = 'student'
        AND internhub.is_assigned_supervisor(entity_id))
  );

-- ----------------------------------------------------------------------------
-- Rewrite app_select (internship_applications)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS app_select ON internship_applications;
CREATE POLICY app_select ON internship_applications
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'::user_role
    OR (internhub.current_role() = 'student'::user_role
        AND student_user_id = (SELECT auth.uid()))
    OR (internhub.current_role() = 'company_hr'::user_role
        AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin'::user_role
        AND internhub.is_internship_in_my_university(internship_id))
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND internhub.is_internship_in_my_department(internship_id))
    OR (internhub.current_role() = ANY (ARRAY['faculty_supervisor'::user_role, 'site_supervisor'::user_role])
        AND internhub.is_assigned_supervisor(student_user_id))
  );

-- ----------------------------------------------------------------------------
-- Rewrite int_select (internships) — keep anon policy untouched
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS int_select ON internships;
CREATE POLICY int_select ON internships
  FOR SELECT TO authenticated
  USING (
    status = ANY (ARRAY['open'::internship_status, 'active'::internship_status, 'completed'::internship_status])
    OR internhub.current_role() = 'super_admin'::user_role
    OR (internhub.current_role() = 'company_hr'::user_role
        AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'university_admin'::user_role
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND department_id = internhub.current_department_id())
    OR (internhub.current_role() = 'faculty_supervisor'::user_role AND (
        department_id = internhub.current_department_id()
        OR internhub.is_internship_assigned_to_me_as_faculty(id)
    ))
    OR (internhub.current_role() = 'site_supervisor'::user_role
        AND internhub.is_internship_assigned_to_me_as_site(id))
    OR (internhub.current_role() = 'student'::user_role AND (
        university_id = internhub.current_university_id()
        OR department_id = internhub.current_department_id()
        OR (program_id IS NULL AND university_id IS NULL)
    ))
  );

-- ----------------------------------------------------------------------------
-- Diagnostic
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
  RAISE NOTICE 'Migration 0065: % SECURITY DEFINER functions now have row_security=off', v_count;
END $$;
