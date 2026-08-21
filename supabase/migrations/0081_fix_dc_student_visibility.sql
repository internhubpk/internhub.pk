-- ============================================================================
-- InternHub.pk — Migration 0081: Fix DC Student Visibility
-- ----------------------------------------------------------------------------
-- PROBLEM:
--   Department Coordinators (DC) could not see students on their dashboard,
--   even though:
--   - DC users have department_id assigned
--   - Students exist in those departments
--   - The API correctly filters by department_id
--
-- ROOT CAUSE:
--   RLS policies on students, departments, and programs tables were causing
--   issues when queried with JOINs (e.g., students query joins profiles,
--   departments, and programs tables). The policies either:
--   1. Had overly complex conditions that caused RLS evaluation failures
--   2. Didn't properly handle the department_coordinator role in all cases
--   3. Caused recursion when joined from other tables
--
-- FIX:
--   1. Simplified students_select policy with clear role-based branches
--   2. Ensured departments_select allows university-wide visibility
--   3. Ensured programs_select allows department-level visibility for DC/PC
--   4. All policies use helper functions (row_security=off) to prevent recursion
-- ============================================================================

BEGIN;

-- ============================================================
-- 1. Fix students RLS policy for DC visibility
-- ============================================================
DROP POLICY IF EXISTS students_select ON students;

CREATE POLICY students_select ON students
  FOR SELECT TO authenticated
  USING (
    -- Self: student can see own record
    user_id = auth.uid()
    -- Super admin: sees everything
    OR internhub.is_super_admin()
    -- University admin: sees university's students
    OR (internhub.current_role() = 'university_admin'::user_role
        AND university_id = internhub.current_university_id())
    -- Department coordinator: sees department's students (read-only)
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND department_id = internhub.current_department_id())
    -- Program coordinator: sees department's students
    OR (internhub.current_role() = 'program_coordinator'::user_role
        AND department_id = internhub.current_department_id())
    -- Faculty supervisor: sees assigned students
    OR (internhub.current_role() = 'faculty_supervisor'::user_role
        AND internhub.is_assigned_supervisor(user_id))
    -- Company HR: sees applicants
    OR (internhub.current_role() = 'company_hr'::user_role
        AND internhub.is_student_applicant_in_my_company(user_id))
    -- Site supervisor: sees assigned students
    OR (internhub.current_role() = 'site_supervisor'::user_role
        AND internhub.is_assigned_supervisor(user_id))
  );

-- ============================================================
-- 2. Fix departments RLS policy (joined from students query)
-- ============================================================
DROP POLICY IF EXISTS departments_select ON departments;

CREATE POLICY departments_select ON departments
  FOR SELECT TO authenticated
  USING (
    internhub.is_super_admin()
    OR university_id = internhub.current_university_id()
    OR id = internhub.current_department_id()
  );

-- ============================================================
-- 3. Fix programs RLS policy (joined from students query)
-- ============================================================
DROP POLICY IF EXISTS programs_select ON programs;

CREATE POLICY programs_select ON programs
  FOR SELECT TO authenticated
  USING (
    internhub.is_super_admin()
    OR (internhub.current_role() IN ('university_admin'::user_role, 'department_coordinator'::user_role, 'program_coordinator'::user_role)
        AND department_id = internhub.current_department_id())
    OR (internhub.current_role() = 'faculty_supervisor'::user_role
        AND university_id = internhub.current_university_id())
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
