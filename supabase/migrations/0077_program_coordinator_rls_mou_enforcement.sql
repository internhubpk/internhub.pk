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
-- IMPORTANT FIX: All policies use internhub.current_role() (a
-- SECURITY DEFINER function reading from auth.users metadata)
-- instead of bare `role`, which would fail with
-- "column 'role' does not exist" on every table except profiles.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. PROGRAM COORDINATOR RLS on original tables
-- ============================================================
-- Pattern: PC accesses data through profiles.program_id.
-- A PC's profile has program_id set, university_id, and department_id.
-- ============================================================

-- programs: PC can view own program
CREATE POLICY programs_pc_select ON programs
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND id IN (
      SELECT pr.program_id FROM profiles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role = 'program_coordinator'
        AND pr.program_id IS NOT NULL
    )
  );

-- students: PC can see students in their program
CREATE POLICY students_pc_select ON students
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND program_id IN (
      SELECT pr.program_id FROM profiles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
    )
  );

CREATE POLICY students_pc_insert ON students
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() = 'program_coordinator'
    AND program_id IN (
      SELECT pr.program_id FROM profiles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
    )
  );

CREATE POLICY students_pc_update ON students
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND program_id IN (
      SELECT pr.program_id FROM profiles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
    )
  )
  WITH CHECK (
    internhub.current_role() = 'program_coordinator'
    AND program_id IN (
      SELECT pr.program_id FROM profiles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
    )
  );

-- supervisors: PC can view supervisors in their university (to assign)
CREATE POLICY supervisors_pc_select ON supervisors
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND university_id IN (
      SELECT pr.university_id FROM profiles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
    )
  );

CREATE POLICY supervisors_pc_insert ON supervisors
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub.current_role() = 'program_coordinator'
    AND university_id IN (
      SELECT pr.university_id FROM profiles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
    )
  );

CREATE POLICY supervisors_pc_update ON supervisors
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND university_id IN (
      SELECT pr.university_id FROM profiles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
    )
  )
  WITH CHECK (
    internhub.current_role() = 'program_coordinator'
    AND university_id IN (
      SELECT pr.university_id FROM profiles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
    )
  );

-- student_internships: PC can view internships of their program's students
CREATE POLICY student_internships_pc_select ON student_internships
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.program_id IN (
        SELECT pr.program_id FROM profiles pr
        WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
      )
    )
  );

CREATE POLICY student_internships_pc_update ON student_internships
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.program_id IN (
        SELECT pr.program_id FROM profiles pr
        WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
      )
    )
  )
  WITH CHECK (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.program_id IN (
        SELECT pr.program_id FROM profiles pr
        WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
      )
    )
  );

-- weekly_logs: PC can view/update logs of their program's students
CREATE POLICY weekly_logs_pc_select ON weekly_logs
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.program_id IN (
        SELECT pr.program_id FROM profiles pr
        WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
      )
    )
  );

CREATE POLICY weekly_logs_pc_update ON weekly_logs
  FOR UPDATE TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.program_id IN (
        SELECT pr.program_id FROM profiles pr
        WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
      )
    )
  );

-- evaluations: PC can view evaluations of their program's students
CREATE POLICY evaluations_pc_select ON evaluations
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.program_id IN (
        SELECT pr.program_id FROM profiles pr
        WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
      )
    )
  );

-- attendance: PC can view attendance of their program's students
CREATE POLICY attendance_pc_select ON attendance
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.program_id IN (
        SELECT pr.program_id FROM profiles pr
        WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
      )
    )
  );

-- tasks: PC can view tasks linked to their program
CREATE POLICY tasks_pc_select ON tasks
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND program_id IN (
      SELECT pr.program_id FROM profiles pr
      WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
    )
  );

-- task_assignments: PC can view task assignments for their program's students
CREATE POLICY task_assignments_pc_select ON task_assignments
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.program_id IN (
        SELECT pr.program_id FROM profiles pr
        WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
      )
    )
  );

-- certificates: PC can view certificates of their program's students
CREATE POLICY certificates_pc_select ON certificates
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.program_id IN (
        SELECT pr.program_id FROM profiles pr
        WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
      )
    )
  );

-- documents: PC can view documents of their program's students
CREATE POLICY documents_pc_select ON documents
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND uploaded_by IN (
      SELECT s.user_id FROM students s
      WHERE s.program_id IN (
        SELECT pr.program_id FROM profiles pr
        WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
      )
    )
  );

-- internship_applications: PC can view applications from their program's students
CREATE POLICY internship_applications_pc_select ON internship_applications
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'program_coordinator'
    AND student_user_id IN (
      SELECT s.user_id FROM students s
      WHERE s.program_id IN (
        SELECT pr.program_id FROM profiles pr
        WHERE pr.user_id = auth.uid() AND pr.role = 'program_coordinator'
      )
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
    (internhub.current_role() = 'company_hr' AND company_id = (
      SELECT pr.company_id FROM profiles pr WHERE pr.user_id = auth.uid()
    ))
    OR
    -- University-side roles: only see internships where either:
    --   (a) internship.university_id IS NULL (open marketplace), OR
    --   (b) internship.university_id matches their university AND
    --       there is an active MOU, OR
    --   (c) the internship has no specific university (null) and status is open
    (
      internhub.current_role() IN ('university_admin', 'department_coordinator', 'program_coordinator', 'faculty_supervisor', 'student')
      AND (
        -- Open marketplace internships (no university targeting)
        (university_id IS NULL AND status IN ('open', 'active', 'completed'))
        OR
        -- University-targeted internships: require active MOU
        (university_id IS NOT NULL
          AND university_id = (SELECT pr.university_id FROM profiles pr WHERE pr.user_id = auth.uid())
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
        OR internships.department_id = (SELECT pr.department_id FROM profiles pr WHERE pr.user_id = auth.uid())
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
      AND company_id = (SELECT pr.company_id FROM profiles pr WHERE pr.user_id = auth.uid())
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
-- 4. GRANT execute on RLS helper functions to program_coordinator
-- ============================================================
-- NOTE: program_coordinator is a user_role ENUM value, NOT a database ROLE.
-- All authenticated users (including PCs) already have EXECUTE on internhub.*
-- functions via the authenticated role grants. These GRANTs would fail with
-- 'role "program_coordinator" does not exist' (42704) because there is no
-- separate DB role for this user_type. Skipping intentionally.

COMMIT;
