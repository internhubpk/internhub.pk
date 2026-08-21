-- ============================================================
-- Migration 0077: Program Coordinator RLS + MOU Internship Enforcement
-- ============================================================
-- 1. Add program_coordinator to RLS policies on all original tables
--    (the PC role was added to the enum in 0074 but only got RLS for
--     the 6 new tables, not the ~20 original tables from 0002).
-- 2. Server-side MOU enforcement: internships posted to a university
--    require an active MOU between the company and that university.
-- 3. Department/program targeting for internship visibility.
-- ============================================================
-- IMPORTANT: All policies use internhub.current_role() / current_university_id()
-- / current_department_id() (SECURITY DEFINER functions reading from
-- auth.users metadata) instead of querying the profiles table directly.
-- This avoids RLS recursion cycles between profiles and other tables.
-- ============================================================

BEGIN;

-- ============================================================
-- 1a. Add PC branch to profiles_select (must exist BEFORE other PC
--     policies that might trigger profiles reads via FK joins).
--     Uses internhub.current_department_id() to avoid recursion.
-- ============================================================
DROP POLICY IF EXISTS profiles_select ON profiles;

CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (
    -- Self: always see own profile
    user_id = auth.uid()
    OR internhub.is_super_admin()
    -- University admin: see all profiles in their university
    OR (internhub.current_role() = 'university_admin'
      AND university_id = internhub.current_university_id())
    -- Department coordinator: see all profiles in their department
    OR (internhub.current_role() = 'department_coordinator'
      AND department_id = internhub.current_department_id())
    -- Company HR: see their company's profiles + applicant profiles
    OR (internhub.current_role() = 'company_hr' AND (
      company_id = internhub.current_company_id()
      OR EXISTS (
        SELECT 1 FROM internship_applications a
        WHERE a.student_user_id = profiles.user_id
          AND a.company_id = internhub.current_company_id()
      )
    ))
    -- Faculty/site evaluators: see assigned students' profiles
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
      AND internhub.is_assigned_supervisor(user_id))
    -- External evaluator: see assigned students + evaluated students
    OR (internhub.current_role() = 'external_evaluator' AND (
      internhub.is_assigned_supervisor(user_id)
      OR EXISTS (
        SELECT 1 FROM evaluations e
        WHERE e.evaluator_id = auth.uid() AND e.student_user_id = profiles.user_id
      )
    ))
    -- Student: see own supervisors' profiles
    OR (internhub.current_role() = 'student' AND user_id IN (
      SELECT si.faculty_supervisor_id FROM student_internships si
      WHERE si.student_user_id = auth.uid() AND si.faculty_supervisor_id IS NOT NULL
      UNION
      SELECT si.site_supervisor_id FROM student_internships si
      WHERE si.student_user_id = auth.uid() AND si.site_supervisor_id IS NOT NULL
      UNION
      SELECT si.external_evaluator_id FROM student_internships si
      WHERE si.student_user_id = auth.uid() AND si.external_evaluator_id IS NOT NULL
    ))
    -- Program coordinator: see profiles in their department
    -- (uses metadata helper to avoid recursion — no profiles subquery)
    OR (internhub.current_role() = 'program_coordinator'
      AND department_id = internhub.current_department_id()
    )
  );

-- ============================================================
-- 1b. PROGRAM COORDINATOR RLS on all other tables
--     All use internhub.current_*() metadata helpers to avoid
--     querying profiles (which would trigger profiles_select and
--     potentially recurse back to these tables via FK joins).
-- ============================================================

-- programs: PC can view programs in their department
CREATE POLICY programs_pc_select ON programs
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND university_id = internhub.current_university_id()
    AND department_id = internhub.current_department_id()
  );

-- students: PC can see students in their program (via metadata)
CREATE POLICY students_pc_select ON students
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND department_id = internhub.current_department_id()
  );

CREATE POLICY students_pc_insert ON students
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() = 'program_coordinator'
    AND department_id = internhub.current_department_id()
  );

CREATE POLICY students_pc_update ON students
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND department_id = internhub.current_department_id()
  )
  WITH CHECK (
    internhub.current_role() = 'program_coordinator'
    AND department_id = internhub.current_department_id()
  );

-- supervisors: PC can view supervisors in their university (to assign)
CREATE POLICY supervisors_pc_select ON supervisors
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND university_id = internhub.current_university_id()
  );

CREATE POLICY supervisors_pc_insert ON supervisors
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() = 'program_coordinator'
    AND university_id = internhub.current_university_id()
  );

CREATE POLICY supervisors_pc_update ON supervisors
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND university_id = internhub.current_university_id()
  )
  WITH CHECK (
    internhub.current_role() = 'program_coordinator'
    AND university_id = internhub.current_university_id()
  );

-- student_internships: PC can view internships of their department's students
CREATE POLICY student_internships_pc_select ON student_internships
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND department_id = internhub.current_department_id()
  );

CREATE POLICY student_internships_pc_update ON student_internships
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND department_id = internhub.current_department_id()
  )
  WITH CHECK (
    internhub.current_role() = 'program_coordinator'
    AND department_id = internhub.current_department_id()
  );

-- weekly_logs: PC can view/update logs of their department's students
CREATE POLICY weekly_logs_pc_select ON weekly_logs
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.department_id = internhub.current_department_id()
    )
  );

CREATE POLICY weekly_logs_pc_update ON weekly_logs
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.department_id = internhub.current_department_id()
    )
  );

-- evaluations: PC can view evaluations of their department's students
CREATE POLICY evaluations_pc_select ON evaluations
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.department_id = internhub.current_department_id()
    )
  );

-- attendance: PC can view attendance of their department's students
CREATE POLICY attendance_pc_select ON attendance
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.department_id = internhub.current_department_id()
    )
  );

-- tasks: PC can view tasks in their department
CREATE POLICY tasks_pc_select ON tasks
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND department_id = internhub.current_department_id()
  );

-- task_assignments: PC can view task assignments for their department's students
CREATE POLICY task_assignments_pc_select ON task_assignments
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.department_id = internhub.current_department_id()
    )
  );

-- certificates: PC can view certificates of their department's students
CREATE POLICY certificates_pc_select ON certificates
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.department_id = internhub.current_department_id()
    )
  );

-- documents: PC can view documents of their department's students
CREATE POLICY documents_pc_select ON documents
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND uploaded_by IN (
      SELECT s.user_id FROM students s
      WHERE s.department_id = internhub.current_department_id()
    )
  );

-- internship_applications: PC can view applications from their department's students
CREATE POLICY internship_applications_pc_select ON internship_applications
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.department_id = internhub.current_department_id()
    )
  );

-- ============================================================
-- 2. SERVER-SIDE MOU ENFORCEMENT for internship visibility
-- ============================================================
-- When a company posts an internship targeting a specific university,
-- the internship must ONLY be visible to users of that university
-- if there is an active MOU between the company and the university.
-- ============================================================

-- Drop the existing internships SELECT policies and replace
-- with a stronger version that also checks department/program targeting.
DO $$ BEGIN
  DROP POLICY IF EXISTS internships_select_mou_aware ON internships;
  DROP POLICY IF EXISTS internships_select_policy ON internships;
  DROP POLICY IF EXISTS internships_select ON internships;
  DROP POLICY IF EXISTS internships_university_select ON internships;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY internships_select_mou_aware ON internships
  FOR SELECT TO authenticated
  USING (
    -- Super admin sees everything
    internhub.current_role() = 'super_admin'
    OR
    -- Company HR sees own company's internships
    (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
    OR
    -- University-side roles: only see internships where either:
    --   (a) internship.university_id IS NULL (open marketplace), OR
    --   (b) internship.university_id matches their university AND
    --       there is an active MOU
    (
      internhub.current_role() IN ('university_admin', 'department_coordinator', 'program_coordinator', 'faculty_supervisor', 'student')
      AND (
        -- Open marketplace internships (no university targeting)
        (university_id IS NULL AND status IN ('open', 'active', 'completed'))
        OR
        -- University-targeted internships: require active MOU
        (university_id IS NOT NULL
          AND university_id = internhub.current_university_id()
          AND EXISTS (
            SELECT 1 FROM company_university_mous mou
            WHERE mou.company_id = internships.company_id
              AND mou.university_id = internships.university_id
              AND mou.status = 'active'
              AND (mou.ends_at IS NULL OR mou.ends_at > now())
          )
        )
      )
      -- Department scoping: if internship targets a specific department,
      -- the student/coordinator must be in that department
      AND (
        internships.department_id IS NULL
        OR internships.department_id = internhub.current_department_id()
        OR internhub.current_role() IN ('university_admin', 'super_admin')
      )
    )
  );

-- Also enforce MOU check on INSERT: company_hr can only create
-- internships targeting a university if an active MOU exists.
CREATE POLICY internships_insert_mou_check ON internships
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Super admin can insert anything
    internhub.current_role() = 'super_admin'
    OR
    -- Company HR: if targeting a university, must have active MOU
    (internhub.current_role() = 'company_hr'
      AND company_id = internhub.current_company_id()
      AND (
        -- No university targeting: always allowed (marketplace)
        university_id IS NULL
        OR
        -- University targeted: require active MOU
        EXISTS (
          SELECT 1 FROM company_university_mous mou
          WHERE mou.company_id = internships.company_id
            AND mou.university_id = internships.university_id
            AND mou.status = 'active'
            AND (mou.ends_at IS NULL OR mou.ends_at > now())
        )
      )
    )
  );

-- ============================================================
-- 3. ADD program_coordinator_id TO programs TABLE
-- ============================================================
-- This provides a direct FK from programs to the PC profile,
-- making queries simpler and more efficient.
-- ============================================================

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS program_coordinator_id uuid
    REFERENCES profiles(user_id) ON DELETE SET NULL;

-- Backfill: set program_coordinator_id from existing PC profiles
UPDATE programs p
  SET program_coordinator_id = pr.user_id
  FROM profiles pr
  WHERE pr.program_id = p.id
    AND pr.role = 'program_coordinator'
    AND p.program_coordinator_id IS NULL;

-- ============================================================
-- 4. GRANT execute on RLS helper functions
-- ============================================================
-- NOTE: program_coordinator is a user_role ENUM value, NOT a database
-- ROLE. All authenticated users already have EXECUTE on internhub.*
-- functions via the authenticated role grants. Skipping intentionally.

COMMIT;
