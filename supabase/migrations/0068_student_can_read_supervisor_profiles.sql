-- ============================================================================
-- InternHub.pk — 0068 student can read supervisor profiles (RLS fix)
-- ----------------------------------------------------------------------------
-- PROBLEM
--   The student dashboard's "Active Internship" card tries to display the
--   faculty supervisor and site supervisor names/emails by joining
--   `profiles` via `faculty_supervisor:faculty_supervisor_id(full_name, email)`.
--   This join returns NULL because the `profiles_select` RLS policy has no
--   branch allowing a STUDENT to read their supervisor's profile row.
--
--   Confirmed via direct query as student.cs_myu (2026-08-16):
--     GET /rest/v1/profiles?user_id=eq.<supervisor_id>  →  []
--   even though the row exists in the database.
--
--   Existing profiles_select branches:
--     - self
--     - super_admin
--     - university_admin (same university)
--     - department_coordinator (same department)
--     - company_hr (same company or applicant)
--     - faculty_supervisor/site_supervisor (assigned to the user)
--     - external_evaluator (assigned to the student)
--
--   MISSING: student reading their own assigned supervisor's profile.
--
-- FIX
--   1. Add a helper `internhub.is_my_assigned_supervisor(p_supervisor uuid)`
--      that returns true if the current user is a student and the given
--      user_id is one of their assigned supervisors (faculty or site),
--      checking the same three paths as `is_assigned_supervisor`:
--        (a) student_internships.faculty_supervisor_id / site_supervisor_id
--        (b) students.faculty_supervisor_id (pre-internship direct)
--        (c) programs.default_faculty_supervisor_id (program-level indirect)
--
--   2. Add a branch to `profiles_select`:
--        OR (current_role() = 'student' AND is_my_assigned_supervisor(user_id))
--
--   This is the inverse of the existing `is_assigned_supervisor` check.
--   The student can now read their supervisors' name/email/avatar for
--   dashboard display, but NOT other students' profiles and NOT
--   supervisors they aren't assigned to.
--
-- SECURITY
--   - SECURITY DEFINER + row_security=off: bypasses profiles_select RLS
--     to avoid recursion (same pattern as is_assigned_supervisor).
--   - Only exposes the supervisor's `user_id` for the lookup; the caller
--     still gets back only the columns PostgREST allows via the SELECT
--     clause (full_name, email, avatar_url) — they cannot read arbitrary
--     profile fields without going through the same RLS check.
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION + DROP POLICY + CREATE POLICY.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper: is_my_assigned_supervisor(p_supervisor uuid)
-- ----------------------------------------------------------------------------
-- Returns true if the current auth user is a student and p_supervisor is
-- one of their assigned faculty/site supervisors (via any of the three
-- assignment paths).
CREATE OR REPLACE FUNCTION internhub.is_my_assigned_supervisor(p_supervisor uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  -- Only students need this check — supervisors can already read their
  -- own profile via the `user_id = auth.uid()` branch of profiles_select.
  SELECT
    internhub.current_role() = 'student'::user_role
    AND (
      -- Path 1: student_internships (active or assigned)
      EXISTS (
        SELECT 1 FROM public.student_internships si
          WHERE si.student_user_id = (select auth.uid())
            AND (si.faculty_supervisor_id = p_supervisor
                 OR si.site_supervisor_id = p_supervisor)
            AND si.status IN ('assigned','active')
      )
      -- Path 2: students.faculty_supervisor_id (pre-internship direct)
      OR EXISTS (
        SELECT 1 FROM public.students s
          WHERE s.user_id = (select auth.uid())
            AND s.faculty_supervisor_id = p_supervisor
      )
      -- Path 3: programs.default_faculty_supervisor_id (program-level indirect)
      OR EXISTS (
        SELECT 1
          FROM public.students s
          JOIN public.programs p ON p.id = s.program_id
          WHERE s.user_id = (select auth.uid())
            AND p.default_faculty_supervisor_id = p_supervisor
      )
    );
$$;

ALTER FUNCTION internhub.is_my_assigned_supervisor(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION internhub.is_my_assigned_supervisor(uuid) TO authenticated, anon;

COMMENT ON FUNCTION internhub.is_my_assigned_supervisor(uuid) IS
  'Returns true if the current auth user is a student and p_supervisor is '
  'one of their assigned supervisors (faculty or site). Inverse of '
  'is_assigned_supervisor. Used by profiles_select RLS policy to allow '
  'students to read their supervisors'' profile rows for dashboard display. '
  'SECURITY DEFINER — bypasses RLS to avoid recursion.';

-- ----------------------------------------------------------------------------
-- 2. Update profiles_select to add the student-reads-supervisor branch
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
    -- NEW: students can read their own assigned supervisors' profiles
    OR (internhub.current_role() = 'student'::user_role
        AND internhub.is_my_assigned_supervisor(user_id))
  );

-- ----------------------------------------------------------------------------
-- 3. Diagnostic — verify the helper works for the test student
-- ----------------------------------------------------------------------------
-- Expected: 1 supervisor (faculty_supervisor_id=5f889466 for Danyal's internship)
-- plus possibly site_supervisor_id=e24b6abf for the Techify internship.
SELECT
  (SELECT count(*) FROM public.profiles WHERE user_id = '5f889466-fdf9-45e3-bd64-9d55ebd9aa84') AS supervisor_profile_exists,
  (SELECT count(*) FROM public.student_internships WHERE student_user_id = '32fa181d-33fd-4015-b96f-9ef8bc5885cf' AND faculty_supervisor_id = '5f889466-fdf9-45e3-bd64-9d55ebd9aa84') AS danyal_faculty_assignment,
  (SELECT count(*) FROM public.student_internships WHERE student_user_id = '32fa181d-33fd-4015-b96f-9ef8bc5885cf' AND site_supervisor_id = 'e24b6abf-aa19-4c95-95b8-2b84430721ba') AS danyal_site_assignment;
