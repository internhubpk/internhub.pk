-- ============================================================================
-- InternHub.pk — Migration 0082: Fix PC Student Visibility via Program
-- ----------------------------------------------------------------------------
-- PROBLEM:
--   Program Coordinators (PC) cannot see students on their dashboard.
--   Supervisors show correctly because supervisors RLS uses university_id,
--   but students RLS uses department_id which may be NULL for PC users.
--
-- ROOT CAUSE:
--   The students_select RLS policy checks:
--     department_id = internhub.current_department_id()
--   For PC users, the primary identifier is program_id (not department_id).
--   If department_id is missing or current_department_id() returns NULL,
--   PC sees 0 students even though students exist in their program.
--
-- FIX:
--   Update students_select policy for PC to check BOTH:
--   1. department_id = current_department()  (existing logic)
--   2. program_id = current_program_id()  (NEW - primary for PC)
--   This ensures PCs can see students linked to their program even if
--   department_id is not set on their profile.
-- ============================================================================

BEGIN;

-- ============================================================
-- Fix students RLS policy for PC visibility by program_id
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
    -- Program coordinator: sees students in their program OR department
    -- Primary check: program_id (PC's main scope)
    -- Fallback: department_id (for backwards compatibility)
    OR (internhub.current_role() = 'program_coordinator'::user_role
        AND (
          program_id = internhub.current_program_id()
          OR department_id = internhub.current_department_id()
        ))
    -- Faculty supervisor: sees assigned students
    OR (internhub.current_role() = 'faculty_supervisor'::user_role
        AND internhub.is_assigned_supervisor(user_id))
    -- Company HR: sees applicants
    OR (internhub.current_role() = 'company_hr'::user_role
        AND EXISTS (
          SELECT 1 FROM internship_applications a
          WHERE a.student_user_id = students.user_id
            AND a.company_id = internhub.current_company_id()
        ))
    -- Site supervisor / external evaluator: sees assigned students
    OR (internhub.current_role() IN ('site_supervisor'::user_role, 'external_evaluator'::user_role)
        AND internhub.is_assigned_supervisor(user_id))
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
