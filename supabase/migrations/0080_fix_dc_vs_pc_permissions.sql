-- ============================================================================
-- InternHub.pk — Migration 0080: Fix Role Permissions (DC vs PC)
-- ----------------------------------------------------------------------------
-- BUSINESS RULE CORRECTION:
--   Department Coordinator (DC) should have READ-ONLY access to students
--   and supervisors - they should NOT be able to CREATE or EDIT them.
--
--   Program Coordinator (PC) is the role that manages students and
--   supervisors within their department, including:
--     - Adding new students
--     - Adding new supervisors (faculty/site)
--     - Assigning students to supervisors
--
-- PROBLEM:
--   Migration 0002 gave DC INSERT/UPDATE permissions on students and
--   supervisors tables. Migration 0077 added PC permissions but did NOT
--   remove the incorrect DC write permissions.
--
-- FIX:
--   1. Remove department_coordinator from students INSERT/UPDATE policies
--   2. Remove department_coordinator from supervisors INSERT/UPDATE policies  
--   3. Ensure program_coordinator has INSERT/UPDATE on both tables
--   4. Add PC INSERT/UPDATE on student_internships (for assignment)
--   5. Keep DC with SELECT-only (read-only) access for visibility
-- ============================================================================

BEGIN;

-- ============================================================
-- 1. STUDENTS TABLE - Remove DC insert/update, keep PC only
-- ============================================================
DROP POLICY IF EXISTS students_insert ON students;

CREATE POLICY students_insert ON students
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() = 'super_admin'::user_role
    OR 
    (internhub.current_role() = 'university_admin'::user_role
     AND university_id = internhub.current_university_id())
    OR
    -- Program coordinator can insert in their department
    (internhub.current_role() = 'program_coordinator'::user_role
     AND department_id = internhub.current_department_id())
  );

DROP POLICY IF EXISTS students_update ON students;

CREATE POLICY students_update ON students
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'::user_role
    OR 
    (internhub.current_role() = 'university_admin'::user_role
     AND university_id = internhub.current_university_id())
    OR
    -- Program coordinator can update students in their department
    (internhub.current_role() = 'program_coordinator'::user_role
     AND department_id = internhub.current_department_id())
  )
  WITH CHECK (
    internhub.current_role() = 'super_admin'::user_role
    OR 
    (internhub.current_role() = 'university_admin'::user_role
     AND university_id = internhub.current_university_id())
    OR
    (internhub.current_role() = 'program_coordinator'::user_role
     AND department_id = internhub.current_department_id())
  );

-- ============================================================
-- 2. SUPERVISORS TABLE - Remove DC insert/update, keep PC only
-- ============================================================
DROP POLICY IF EXISTS sup_insert ON supervisors;

CREATE POLICY sup_insert ON supervisors
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() = 'super_admin'::user_role
    OR 
    (internhub.current_role() = 'university_admin'::user_role
     AND university_id = internhub.current_university_id())
    OR
    -- Program coordinator can insert in their university
    (internhub.current_role() = 'program_coordinator'::user_role
     AND university_id = internhub.current_university_id())
    OR
    -- Company HR can insert for their company
    (internhub.current_role() = 'company_hr'::user_role
     AND company_id = internhub.current_company_id())
  );

DROP POLICY IF EXISTS sup_update ON supervisors;

CREATE POLICY sup_update ON supervisors
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'::user_role
    OR 
    (internhub.current_role() = 'university_admin'::user_role
     AND university_id = internhub.current_university_id())
    OR
    -- Program coordinator can update supervisors in their university
    (internhub.current_role() = 'program_coordinator'::user_role
     AND university_id = internhub.current_university_id())
    OR
    -- Company HR can update their company's supervisors
    (internhub.current_role() = 'company_hr'::user_role
     AND company_id = internhub.current_company_id())
  )
  WITH CHECK (
    internhub.current_role() = 'super_admin'::user_role
    OR 
    (internhub.current_role() = 'university_admin'::user_role
     AND university_id = internhub.current_university_id())
    OR
    (internhub.current_role() = 'program_coordinator'::user_role
     AND university_id = internhub.current_university_id())
    OR
    (internhub.current_role() = 'company_hr'::user_role
     AND company_id = internhub.current_company_id())
  );

-- ============================================================
-- 3. STUDENT_INTERNSHIPS - PC controls student-supervisor assignment
-- ============================================================
DROP POLICY IF EXISTS student_internships_pc_update ON student_internships;

CREATE POLICY student_internships_pc_update ON student_internships
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'::user_role
    AND department_id = internhub.current_department_id()
  )
  WITH CHECK (
    internhub.current_role() = 'program_coordinator'::user_role
    AND department_id = internhub.current_department_id()
  );

DROP POLICY IF EXISTS student_internships_pc_insert ON student_internships;

CREATE POLICY student_internships_pc_insert ON student_internships
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() = 'program_coordinator'::user_role
    AND department_id = internhub.current_department_id()
  );

-- ============================================================
-- 4. Updated SELECT policies - DC read-only, PC read+write
-- ============================================================

-- Students SELECT: DC can VIEW (read-only), PC can view+write
DROP POLICY IF EXISTS students_select ON students;

CREATE POLICY students_select ON students
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR internhub.is_super_admin()
    OR (internhub.current_role() = 'university_admin'::user_role
        AND university_id = internhub.current_university_id())
    -- DC can VIEW students in their department (read-only)
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND department_id = internhub.current_department_id())
    -- PC can VIEW students in their department (read+write)
    OR (internhub.current_role() = 'program_coordinator'::user_role
        AND department_id = internhub.current_department_id())
    OR (internhub.current_role() = 'faculty_supervisor'::user_role
        AND internhub.is_assigned_supervisor(user_id))
    OR (internhub.current_role() = 'company_hr'::user_role
        AND EXISTS (
          SELECT 1 FROM internship_applications a
          WHERE a.student_user_id = students.user_id
            AND a.company_id = internhub.current_company_id()
        ))
    OR (internhub.current_role() IN ('site_supervisor'::user_role, 'external_evaluator'::user_role)
        AND internhub.is_assigned_supervisor(user_id))
  );

-- Supervisors SELECT: DC can VIEW, PC can manage
DROP POLICY IF EXISTS sup_select ON supervisors;

CREATE POLICY sup_select ON supervisors
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR internhub.is_super_admin()
    OR (internhub.current_role() = 'university_admin'::user_role
        AND university_id = internhub.current_university_id())
    -- DC can VIEW supervisors in their university (read-only)
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND university_id = internhub.current_university_id())
    -- PC can VIEW supervisors in their university (read+write)
    OR (internhub.current_role() = 'program_coordinator'::user_role
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'faculty_supervisor'::user_role
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() IN ('company_hr'::user_role, 'site_supervisor'::user_role)
        AND company_id = internhub.current_company_id())
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
