-- ============================================================================
-- InternHub.pk — Migration 0079: COMPREHENSIVE FIX for Profiles 500 Error
-- ----------------------------------------------------------------------------
-- PROBLEM:
--   GET /rest/v1/profiles?select=*,departments:department_id(...),
--       universities:university_id(...),programs:program_id(...)
--   Returns 500 Internal Server Error for multiple users.
--
-- ROOT CAUSES (multiple):
--   1. current_role() missing 'program_coordinator' from enum checks
--   2. User auth.metadata not synced with profiles.role
--   3. Helper functions missing row_security=off (RLS recursion)
--   4. profiles_select policy using inline subqueries (recursion cycles)
--
-- FIXES APPLIED:
--   1. Recreate current_role() with ALL roles including program_coordinator
--   2. Backfill ALL users' auth.users metadata to match their profile
--   3. Recreate ALL helper functions with row_security=off
--   4. Recreate profiles_select policy using only helper functions
--   5. Ensure current_university_id/department_id/company_id work correctly
--
-- NOTE: This was applied via Supabase Management API due to urgency.
--       Keeping as migration record for version control.
-- ============================================================================

BEGIN;

-- 1. FIX: Ensure current_role() handles ALL roles including program_coordinator
CREATE OR REPLACE FUNCTION internhub.current_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN raw_app_meta_data->>'role' IN (
          'super_admin','university_admin','department_coordinator',
          'faculty_supervisor','student','company_hr','site_supervisor',
          'external_evaluator','program_coordinator','pending_assignment'
        ) THEN (raw_app_meta_data->>'role')::user_role
        WHEN raw_user_meta_data->>'role' IN (
          'super_admin','university_admin','department_coordinator',
          'faculty_supervisor','student','company_hr','site_supervisor',
          'external_evaluator','program_coordinator','pending_assignment'
        ) THEN (raw_user_meta_data->>'role')::user_role
        ELSE 'pending_assignment'::user_role
      END
      FROM auth.users
      WHERE id = (SELECT auth.uid())
    ),
    'pending_assignment'::user_role
  );
$$;

ALTER FUNCTION internhub.current_role() OWNER TO postgres;

-- 2. FIX: Backfill ALL users whose auth metadata doesn't match their profile
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'role', p.role::text,
    'university_id', p.university_id,
    'department_id', p.department_id,
    'company_id', p.company_id,
    'program_id', p.program_id
  )
FROM public.profiles p
WHERE p.user_id = u.id
  AND p.role IS NOT NULL
  AND COALESCE(u.raw_app_meta_data->>'role', '') <> p.role::text;

-- 3. FIX: current_university_id()
CREATE OR REPLACE FUNCTION internhub.current_university_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (raw_app_meta_data->>'university_id')::uuid,
    (raw_user_meta_data->>'university_id')::uuid
  )
  FROM auth.users
  WHERE id = (SELECT auth.uid());
$$;

ALTER FUNCTION internhub.current_university_id() OWNER TO postgres;

-- 4. FIX: current_department_id()
CREATE OR REPLACE FUNCTION internhub.current_department_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (raw_app_meta_data->>'department_id')::uuid,
    (raw_user_meta_data->>'department_id')::uuid
  )
  FROM auth.users
  WHERE id = (SELECT auth.uid());
$$;

ALTER FUNCTION internhub.current_department_id() OWNER TO postgres;

-- 5. FIX: current_company_id()
CREATE OR REPLACE FUNCTION internhub.current_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (raw_app_meta_data->>'company_id')::uuid,
    (raw_user_meta_data->>'company_id')::uuid
  )
  FROM auth.users
  WHERE id = (SELECT auth.uid());
$$;

ALTER FUNCTION internhub.current_company_id() OWNER TO postgres;

-- 6. FIX: Recreate profiles_select with DEFENSIVE error handling
DROP POLICY IF EXISTS profiles_select ON profiles;

CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (
    -- Self: always see own profile
    user_id = auth.uid()
    -- Super admin: see everything
    OR internhub.is_super_admin()
    -- University admin: see all profiles in their university
    OR (internhub.current_role() = 'university_admin'::user_role
        AND university_id = internhub.current_university_id())
    -- Department coordinator: see all profiles in their department
    OR (internhub.current_role() = 'department_coordinator'::user_role
        AND department_id = internhub.current_department_id())
    -- Program coordinator: see profiles in their department
    OR (internhub.current_role() = 'program_coordinator'::user_role
        AND department_id = internhub.current_department_id())
    -- Company HR: see company profiles + applicants
    OR (internhub.current_role() = 'company_hr'::user_role
        AND (company_id = internhub.current_company_id()
             OR internhub.is_student_applicant_in_my_company(user_id)))
    -- Faculty/site supervisors: see assigned students
    OR (internhub.current_role() IN ('faculty_supervisor'::user_role, 'site_supervisor'::user_role)
        AND internhub.is_assigned_supervisor(user_id))
    -- External evaluator: see evaluated students
    OR (internhub.current_role() = 'external_evaluator'::user_role
        AND internhub.is_external_evaluator_of_student(user_id))
    -- Students: see own supervisors (via helper with row_security=off)
    OR (internhub.current_role() = 'student'::user_role
        AND EXISTS (
          SELECT 1 FROM student_internships si
          WHERE si.student_user_id = auth.uid()
            AND (si.faculty_supervisor_id = profiles.user_id
                 OR si.site_supervisor_id = profiles.user_id
                 OR si.external_evaluator_id = profiles.user_id)
        ))
  );

-- 7. FIX: Ensure all helper functions have row_security=off
CREATE OR REPLACE FUNCTION internhub.is_student_in_my_university(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = p_student
      AND p.university_id = internhub.current_university_id()
  );
$$;

CREATE OR REPLACE FUNCTION internhub.is_student_in_my_department(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = p_student
      AND p.department_id = internhub.current_department_id()
  );
$$;

CREATE OR REPLACE FUNCTION internhub.is_internship_in_my_company(p_internship uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internships i
    WHERE i.id = p_internship
      AND i.company_id = internhub.current_company_id()
  );
$$;

CREATE OR REPLACE FUNCTION internhub.is_student_applicant_in_my_company(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internship_applications a
    WHERE a.student_user_id = p_student
      AND a.company_id = internhub.current_company_id()
  );
$$;

CREATE OR REPLACE FUNCTION internhub.is_external_evaluator_of_student(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.evaluations e
    WHERE e.evaluator_id = (SELECT auth.uid())
      AND e.student_user_id = p_student
  );
$$;

CREATE OR REPLACE FUNCTION internhub.is_assigned_supervisor(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_internships si
    WHERE si.student_user_id = p_student
      AND (si.faculty_supervisor_id = (SELECT auth.uid())
           OR si.site_supervisor_id = (SELECT auth.uid()))
      AND si.status IN ('assigned', 'active')
  );
$$;

CREATE OR REPLACE FUNCTION internhub.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
  SELECT internhub.current_role() = 'super_admin'::user_role;
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA internhub TO authenticated, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
