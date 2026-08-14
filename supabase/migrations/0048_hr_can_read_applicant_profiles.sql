-- ============================================================================
-- InternHub.pk — 0048_hr_can_read_applicant_profiles.sql
-- ----------------------------------------------------------------------------
-- BUG: HR's "Applications" dashboard showed "Unknown" for every applicant's
-- name, email, university, department, GPA, etc. — even though the data
-- existed in the database.
--
-- Root cause: `profiles_select` RLS only let company_hr read profiles where
-- `company_id = current_company_id()` (i.e. other HR/supervisors at the
-- same company). Student profiles have `company_id = NULL` because
-- students belong to a university, not a company. So the nested join
-- `profiles:student_user_id` in /api/company-hr/applications returned
-- nothing for every applicant, and the React component fell back to
-- "Unknown".
--
-- FIX: Extend profiles_select to allow company_hr to read any profile
-- belonging to a student who has applied to one of their company's
-- internships. This is a narrow EXISTS subquery scoped to
-- internship_applications — it does NOT create RLS recursion because
-- internship_applications.app_select already has a clean company_hr
-- branch (company_id = current_company_id()) with no nested calls
-- back to profiles.
--
-- IDEMPOTENT — DROP POLICY IF EXISTS before CREATE.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    -- Owner reads own profile
    user_id = (select auth.uid())
    -- Super admin sees all
    OR internhub.current_role() = 'super_admin'
    -- University admin sees members of their university
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    -- Department coordinator sees members of their department
    OR (internhub.current_role() = 'department_coordinator'
        AND department_id = internhub.current_department_id())
    -- Company HR sees profiles of:
    --   1. Other members of their company (HR/supervisors) — existing behavior
    --   2. Students who have applied to their company's internships — NEW
    OR (internhub.current_role() = 'company_hr'
        AND (
          company_id = internhub.current_company_id()
          OR EXISTS (
            SELECT 1 FROM public.internship_applications a
              WHERE a.student_user_id = profiles.user_id
                AND a.company_id = internhub.current_company_id()
          )
        ))
    -- Assigned faculty/site supervisors see their assigned students
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND internhub.is_assigned_supervisor(user_id))
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
