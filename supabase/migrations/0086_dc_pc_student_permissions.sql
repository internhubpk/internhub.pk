-- ============================================================================
-- 0086: Coordinator student-management permissions (2026-08-24)
-- ----------------------------------------------------------------------------
-- Business rule: student creation belongs to the PROGRAM COORDINATOR.
-- Department Coordinators no longer create students (UI removed; the DC bulk
-- CSV route gate no longer includes DC; /api/students already denies DC;
-- students INSERT policies have no DC branch).
--
-- What WAS missing: Department Coordinators legitimately assign supervisors
-- to students in their department (the /bulk-assign API and Assign dialogs
-- were built for them), but `students` UPDATE policies had NO DC branch —
-- every DC-driven assignment was silently blocked by RLS (0 rows updated).
-- This migration restores that intended capability, scoped to the DC's own
-- department, and keeps the PC branch unchanged.
-- ============================================================================

DROP POLICY IF EXISTS students_update ON public.students;
CREATE POLICY students_update ON public.students
  FOR UPDATE TO authenticated
  USING (
    internhub."current_role"() = 'super_admin'::user_role
    OR (
      internhub."current_role"() = 'university_admin'::user_role
      AND university_id = internhub.current_university_id()
    )
    OR (
      internhub."current_role"() = 'department_coordinator'::user_role
      AND department_id = internhub.current_department_id()
    )
    OR (
      internhub."current_role"() = 'program_coordinator'::user_role
      AND department_id = internhub.current_department_id()
    )
  )
  WITH CHECK (
    internhub."current_role"() = 'super_admin'::user_role
    OR (
      internhub."current_role"() = 'university_admin'::user_role
      AND university_id = internhub.current_university_id()
    )
    OR (
      internhub."current_role"() = 'department_coordinator'::user_role
      AND department_id = internhub.current_department_id()
    )
    OR (
      internhub."current_role"() = 'program_coordinator'::user_role
      AND department_id = internhub.current_department_id()
    )
  );

-- Note: INSERT policies are intentionally unchanged — DC retains NO ability
-- to create students; PC keeps the existing department-scoped INSERT
-- (students_pc_insert / students_insert).
