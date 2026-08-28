-- 0103_profiles_select_hr_placed_students.sql
--
-- BUG
-- ---
-- The `profiles_select` RLS policy for `company_hr` only allows reading:
--   * profiles with the same company_id (co-workers), OR
--   * students who APPLIED to the company (is_student_applicant_in_my_company).
--
-- Students with an ACCEPTED placement (student_internships row at the
-- company) but no pending application row visible were NOT covered — so
-- every Company HR page that joins `profiles` for placed interns
-- (e.g. /company-hr/interns "Active Interns") rendered the student name as
-- "Unknown" and an empty email/phone.
--
-- FIX
-- ---
-- Extend the company_hr branch of profiles_select with an EXISTS clause on
-- student_internships: an HR may read the profile of any student placed at
-- their company (any status — assigned/active/paused/completed), because
-- they manage those interns' attendance, documents, evaluations and
-- certificates day-to-day.
--
-- Everything else in the policy is byte-identical.

DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
FOR SELECT
TO authenticated
USING (
  (
    user_id = ( SELECT auth.uid() AS uid)
    OR internhub.is_super_admin()
    OR (
      internhub."current_role"() = 'university_admin'::user_role
      AND (
        university_id = internhub.current_university_id()
        OR internhub.is_company_hr_in_my_university(user_id)
      )
    )
    OR (
      internhub."current_role"() = 'department_coordinator'::user_role
      AND department_id = internhub.current_department_id()
    )
    OR (
      internhub."current_role"() = 'program_coordinator'::user_role
      AND department_id = internhub.current_department_id()
    )
    OR (
      internhub."current_role"() = 'company_hr'::user_role
      AND (
        company_id = internhub.current_company_id()
        OR internhub.is_student_applicant_in_my_company(user_id)
        -- NEW: students PLACED at the HR's company (accepted interns)
        OR EXISTS (
          SELECT 1
            FROM public.student_internships si
           WHERE si.student_user_id = profiles.user_id
             AND si.company_id = internhub.current_company_id()
        )
      )
    )
    OR (
      internhub."current_role"() = ANY (
        ARRAY ['faculty_supervisor'::user_role, 'site_supervisor'::user_role]
      )
      AND internhub.is_assigned_supervisor(user_id)
    )
    OR (
      internhub."current_role"() = 'external_evaluator'::user_role
      AND internhub.is_external_evaluator_of_student(user_id)
    )
    OR (
      internhub."current_role"() = 'student'::user_role
      AND (
        EXISTS (
          SELECT 1
            FROM public.student_internships si
           WHERE (
             si.student_user_id = ( SELECT auth.uid() AS uid)
             AND (
               si.faculty_supervisor_id = profiles.user_id
               OR si.site_supervisor_id = profiles.user_id
               OR si.external_evaluator_id = profiles.user_id
             )
           )
        )
      )
    )
  )
);
