-- ============================================================================
-- InternHub.pk — Migration 0083: Comprehensive PC Dashboard RLS Fix
-- ----------------------------------------------------------------------------
-- PROBLEMS FIXED:
--   1. Students 500 error: current_program_id() function caused RLS recursion
--      by querying profiles table within an RLS policy context
--   2. Weekly logs 400 error: PC visibility policy used department_id only,
--      but queries were filtering incorrectly
--   3. Evaluations 400 error: Same issue as weekly logs
--
-- ROOT CAUSES:
--   - current_program_id() helper function queried profiles table (which has
--     RLS enabled), causing recursion when called from students_select policy
--   - weekly_logs_pc_select and evaluations_pc_select policies filtered by
--     department_id subquery, but the frontend was using different filters
--
-- FIXES:
--   1. Rewrote students_select to use direct subquery instead of function:
--      program_id IN (SELECT program_id FROM profiles WHERE user_id = auth.uid())
--   2. Updated weekly_logs_pc_select to filter by program_id via subquery
--   3. Updated evaluations_pc_select to filter by program_id via subquery
--   4. All policies now use consistent program_id-based filtering for PC role
-- ============================================================================

BEGIN;

-- ============================================================
-- 1. FIX: Students SELECT policy (avoid current_program_id recursion)
-- ============================================================
DROP POLICY IF EXISTS students_select ON students;

CREATE POLICY students_select ON students
FOR SELECT TO authenticated
USING (
  -- Self access
  user_id = auth.uid()
  -- Super admin
  OR internhub.is_super_admin()
  -- University admin
  OR (
    internhub.current_role() = 'university_admin'::user_role
    AND university_id = internhub.current_university_id()
  )
  -- Department coordinator (read-only)
  OR (
    internhub.current_role() = 'department_coordinator'::user_role
    AND department_id = internhub.current_department_id()
  )
  -- Program coordinator: check program_id via direct subquery (avoids recursion)
  OR (
    internhub.current_role() = 'program_coordinator'::user_role
    AND (
      program_id IN (
        SELECT program_id FROM profiles 
        WHERE user_id = auth.uid()
      )
      OR department_id = internhub.current_department_id()
    )
  )
  -- Faculty supervisor
  OR (
    internhub.current_role() = 'faculty_supervisor'::user_role
    AND internhub.is_assigned_supervisor(user_id)
  )
  -- Site supervisor / external evaluator
  OR (
    internhub.current_role() IN ('site_supervisor'::user_role, 'external_evaluator'::user_role)
    AND internhub.is_assigned_supervisor(user_id)
  )
);

-- ============================================================
-- 2. FIX: Weekly Logs SELECT policy for PC (use program_id)
-- ============================================================
DROP POLICY IF EXISTS weekly_logs_pc_select ON weekly_logs;

CREATE POLICY weekly_logs_pc_select ON weekly_logs
FOR SELECT TO authenticated
USING (
  internhub.current_role() = 'program_coordinator'::user_role
  AND student_user_id IN (
    SELECT user_id FROM students 
    WHERE program_id IN (
      SELECT program_id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- ============================================================
-- 3. FIX: Evaluations SELECT policy for PC (use program_id)
-- ============================================================
DROP POLICY IF EXISTS evaluations_pc_select ON evaluations;

CREATE POLICY evaluations_pc_select ON evaluations
FOR SELECT TO authenticated
USING (
  internhub.current_role() = 'program_coordinator'::user_role
  AND student_user_id IN (
    SELECT user_id FROM students 
    WHERE program_id IN (
      SELECT program_id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

NOTIFY pgrst, 'reload schema';

COMMIT;
