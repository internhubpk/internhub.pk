-- ============================================================================
-- InternHub.pk — Migration 0078: CRITICAL FIX for Program Coordinator 500 Error
-- ----------------------------------------------------------------------------
-- ROOT CAUSE: The internhub.current_role() function (migration 0009) was
-- missing 'program_coordinator' from its list of valid role enum values.
--
-- IMPACT:
--   When a Program Coordinator (PC) authenticates:
--   1. current_role() returns 'pending_assignment' instead of 'program_coordinator'
--   2. ALL RLS policy checks fail for PC-specific branches (profiles, programs,
--      students, supervisors, evaluations, etc.)
--   3. PostgREST returns 500 when RLS evaluation fails during embedded resource
--      fetching (e.g., profiles?select=...,programs:program_id(...))
--
-- FIX:
--   1. Update current_role() to include 'program_coordinator' in both
--      raw_app_meta_data AND raw_user_meta_data checks
--   2. Backfill existing PC users' auth.users metadata
--   3. Notify pgrst to reload schema cache
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Fix current_role(): add 'program_coordinator' to valid roles list
-- ----------------------------------------------------------------------------
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
        WHEN raw_app_meta_data->>'role' IN
          ('super_admin','university_admin','department_coordinator',
           'faculty_supervisor','student','company_hr','site_supervisor',
           'external_evaluator','program_coordinator',    -- ← ADDED
           'pending_assignment')
          THEN (raw_app_meta_data->>'role')::user_role
        WHEN raw_user_meta_data->>'role' IN
          ('super_admin','university_admin','department_coordinator',
           'faculty_supervisor','student','company_hr','site_supervisor',
           'external_evaluator','program_coordinator',    -- ← ADDED
           'pending_assignment')
          THEN (raw_user_meta_data->>'role')::user_role
        ELSE 'pending_assignment'::user_role
      END
      FROM auth.users
      WHERE id = (select auth.uid())
    ),
    'pending_assignment'::user_role
  );
$$;

ALTER FUNCTION internhub.current_role() OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 2. Backfill existing PC users: ensure auth.users metadata has correct role
-- ----------------------------------------------------------------------------
UPDATE auth.users u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'program_coordinator')
FROM public.profiles p
WHERE p.user_id = u.id
  AND p.role = 'program_coordinator'
  AND COALESCE(u.raw_app_meta_data->>'role', '') <> 'program_coordinator';

-- ----------------------------------------------------------------------------
-- 3. Also update current_university_id() and current_department_id() if they
--    have the same issue (reading from raw_user_meta_data vs raw_app_meta_data)
-- ----------------------------------------------------------------------------
-- Note: These functions were created in later migrations and may already be
-- correct, but we ensure consistency here.

-- Check if current_department_id() exists and uses the right metadata field
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_department_id' AND pronamespace = 'public'::regnamespace) THEN
    -- Function exists, recreate it to handle PC role properly
    EXECUTE '
      CREATE OR REPLACE FUNCTION internhub.current_department_id()
      RETURNS uuid
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      STABLE
      AS $function$
        SELECT COALESCE(
          (raw_app_meta_data->>''department_id'')::uuid,
          (raw_user_meta_data->>''department_id'')::uuid
        )
        FROM auth.users
        WHERE id = (select auth.uid());
      $function$;
    ';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Notify PostgREST to reload schema (picks up function changes)
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 5. Diagnostic: verify the fix
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.profiles WHERE role = 'program_coordinator')
    AS total_program_coordinators,
  (SELECT count(*) FROM auth.users u
     JOIN public.profiles p ON p.user_id = u.id
    WHERE p.role = 'program_coordinator'
      AND u.raw_app_meta_data->>'role' = 'program_coordinator')
    AS pcs_with_correct_metadata,
  (SELECT count(*) FROM auth.users u
     JOIN public.profiles p ON p.user_id = u.id
    WHERE p.role = 'program_coordinator'
      AND COALESCE(u.raw_app_meta_data->>'role', '') <> 'program_coordinator')
    AS pcs_still_broken;

COMMIT;

-- ============================================================================
-- VERIFICATION STEPS (run after applying this migration):
--
-- 1. Test as a Program Coordinator user:
--    GET /rest/v1/profiles?select=user_id,first_name,last_name,email,
--         department_id,program_id,programs:program_id(id,name,code)
--       &role=eq.program_coordinator
--    Expected: 200 OK with PC data (not 500)
--
-- 2. Test RLS policies:
--    GET /rest/v1/programs (as PC user)
--    Expected: Programs in PC's department (not empty/error)
--
-- 3. Test student access:
--    GET /rest/v1/students?department_id=eq.<pc_dept_id> (as PC user)
--    Expected: Students in PC's department
-- ============================================================================
