-- =============================================================================
-- 0099_internship_marketplace_mou_visibility.sql
-- =============================================================================
-- Internships marketplace visibility rules (user request 2026-08-27):
--
--   1. "It should not be shown to the universities that doesn't have mou
--      with them."
--         → University members (university_admin, department_coordinator,
--           program_coordinator, faculty_supervisor) can only see
--           internships of companies that have an ACTIVE MoU with THEIR
--           university — regardless of whether the internship is
--           marketplace-wide (university_id IS NULL) or targeted at their
--           university. The previous policy leaked ALL open marketplace
--           internships to every university with no MoU check.
--
--   2. "For students … they can only see internships that has their
--      department added in the target departments and their university has
--      mou with the company, two conditions."
--         → Students see an internship ONLY when BOTH hold:
--             (a) their university has an ACTIVE MoU with the company, AND
--             (b) the internship targets THEIR department (row in
--                 internship_target_departments matching the student's
--                 department AND university).
--           …plus internships they are already enrolled in (via
--           student_internships) so ongoing internships keep working for
--           weekly logs / reports.
--
--   company_hr keeps full visibility of their own company's internships;
--   super_admin sees everything; anon keeps the public open/active policy.
--   Draft internships stay invisible to every university member.
--
-- RECURSION SAFETY (critical implementation detail):
--   A policy on `internships` may NOT inline-subquery `internship_target_
--   departments` or `student_internships` — their own SELECT policies
--   subquery `internships`, producing "infinite recursion detected in
--   policy" at query time. All cross-table checks therefore go through
--   SECURITY DEFINER helper functions (the same pattern migration 0097
--   used for dept_select / current_company_has_active_mou).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Helper: does an ACTIVE MoU exist between a company and a university?
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.active_mou_exists(
  p_company_id uuid,
  p_university_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM company_university_mous m
     WHERE m.company_id = p_company_id
       AND m.university_id = p_university_id
       AND m.status = 'active'
       AND (m.ends_at IS NULL OR m.ends_at > now())
  );
$$;

-- ----------------------------------------------------------------------------
-- Helper: does the internship target the CURRENT user's department?
-- (student scoping — reads the caller's profiles row internally)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.internship_targets_current_student_dept(
  p_internship_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM internship_target_departments itd
      JOIN profiles pr ON pr.user_id = auth.uid()
     WHERE itd.internship_id = p_internship_id
       AND pr.university_id IS NOT NULL
       AND pr.department_id IS NOT NULL
       AND itd.university_id = pr.university_id
       AND itd.department_id = pr.department_id
  );
$$;

-- ----------------------------------------------------------------------------
-- Helper: is the CURRENT user enrolled in the internship
-- (via student_internships)? Keeps ongoing internships readable for weekly
-- logs / report generation after the status moves past 'open'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.student_enrolled_in_internship(
  p_internship_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM student_internships si
     WHERE si.internship_id = p_internship_id
       AND si.student_user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION internhub.active_mou_exists(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION internhub.internship_targets_current_student_dept(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION internhub.student_enrolled_in_internship(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internhub.active_mou_exists(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internhub.internship_targets_current_student_dept(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION internhub.student_enrolled_in_internship(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- The MoU-aware marketplace SELECT policy (recursion-free)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS internships_select_mou_aware ON internships;

CREATE POLICY internships_select_mou_aware ON internships
  FOR SELECT TO authenticated
  USING (
    -- Super admin sees everything.
    internhub."current_role"() = 'super_admin'

    -- Company HR sees their own company's internships (all statuses).
    OR (
      internhub."current_role"() = 'company_hr'
      AND company_id = internhub.current_company_id()
    )

    -- University staff (admin / coordinators / supervisors): the company
    -- must have an ACTIVE MoU with THEIR university. Drafts are excluded.
    OR (
      internhub."current_role"() IN (
        'university_admin', 'department_coordinator', 'program_coordinator',
        'faculty_supervisor'
      )
      AND internships.status <> 'draft'
      AND internhub.active_mou_exists(
            internships.company_id,
            internhub.current_university_id()
          )
    )

    -- Students: TWO conditions (MoU + department targeted), open status
    -- only — OR internships they are already enrolled in (any status, so
    -- weekly logs / report generation keep working after the internship
    -- becomes 'active').
    OR (
      internhub."current_role"() = 'student'
      AND (
        (
          internships.status = 'open'
          AND internhub.active_mou_exists(
                internships.company_id,
                internhub.current_university_id()
              )
          AND internhub.internship_targets_current_student_dept(internships.id)
        )
        OR internhub.student_enrolled_in_internship(internships.id)
      )
    )
  );

COMMENT ON POLICY internships_select_mou_aware ON internships IS
  'Marketplace visibility: super_admin all; company_hr own company; university members only internships of companies with an ACTIVE MoU with their university (no drafts); students only OPEN internships that (a) target their department via internship_target_departments AND (b) whose company has an ACTIVE MoU with their university — plus internships they are already enrolled in. Recursion-free via SECURITY DEFINER helpers (0099).';
