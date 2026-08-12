-- ============================================================================
-- InternHub.pk — 0007 Fix RLS helper functions + table grants
-- ----------------------------------------------------------------------------
-- PROBLEM (live production)
--   1. GET /rest/v1/profiles?select=*&user_id=eq.<uid> returns 500 when
--      authenticated. Cause: the RLS policies on `profiles` (and most other
--      tables) call `internhub.current_role()`, `internhub.current_university_id()`,
--      `internhub.is_assigned_supervisor(...)` etc. — but the `internhub`
--      schema and its helper functions DON'T EXIST on the live DB. Policy
--      evaluation therefore crashes with "function internhub.current_role()
--      does not exist" and PostgREST surfaces that as 500.
--
--   2. GET /rest/v1/<any-table> with anon returns 401 "permission denied
--      for table X". Cause: anon/authenticated lack table-level SELECT/
--      INSERT/UPDATE/DELETE privileges on the public tables. RLS never
--      runs because privilege check happens first.
--
--   Both symptoms have the same root cause: migration 0002_rls_policies.sql
--   was never successfully applied to the live DB (the live DB predates the
--   current migration system). This migration brings the live DB up to spec
--   without dropping any existing data.
--
-- FIX (this migration, fully idempotent)
--   1. CREATE SCHEMA IF NOT EXISTS internhub
--   2. (Re)create all 7 internhub.* helper functions used by RLS policies
--   3. GRANT USAGE on internhub schema to anon, authenticated
--   4. GRANT SELECT/INSERT/UPDATE/DELETE on all public tables to anon,
--      authenticated (so the data API can actually reach the tables)
--   5. GRANT USAGE, SELECT on all sequences in public (for INSERT ... DEFAULT)
--   6. ALTER DEFAULT PRIVILEGES so future tables also get the GRANTs
--   7. Recreate the profiles_select / profiles_insert / profiles_update /
--      profiles_delete policies (the most-queried). Other tables already
--      have their policies from 0002_rls_policies.sql on fresh projects;
--      on the live DB, you may additionally need to re-run 0002 in the SQL
--      Editor after this one. This migration only guarantees profiles
--      works end-to-end (which is what unblocks login).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. internhub schema + helper functions
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS internhub;

-- Return the full profile row for the current user in a single round trip.
CREATE OR REPLACE FUNCTION internhub.current_profile()
RETURNS TABLE (
  user_id uuid,
  role user_role,
  university_id uuid,
  department_id uuid,
  program_id uuid,
  company_id uuid,
  status profile_status
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.user_id,
    p.role,
    p.university_id,
    p.department_id,
    p.program_id,
    p.company_id,
    p.status
  FROM public.profiles p
  WHERE p.user_id = (select auth.uid());
$$;

-- Convenience: current role as text
CREATE OR REPLACE FUNCTION internhub.current_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE user_id = (select auth.uid());
$$;

-- Convenience: current user's university_id
CREATE OR REPLACE FUNCTION internhub.current_university_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT university_id FROM public.profiles WHERE user_id = (select auth.uid());
$$;

-- Convenience: current user's department_id
CREATE OR REPLACE FUNCTION internhub.current_department_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT department_id FROM public.profiles WHERE user_id = (select auth.uid());
$$;

-- Convenience: current user's company_id
CREATE OR REPLACE FUNCTION internhub.current_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = (select auth.uid());
$$;

-- Return true if current user is the assigned faculty OR site supervisor
CREATE OR REPLACE FUNCTION internhub.is_assigned_supervisor(p_student uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_internships si
      WHERE si.student_user_id = p_student
        AND (si.faculty_supervisor_id = (select auth.uid())
             OR si.site_supervisor_id = (select auth.uid()))
        AND si.status IN ('assigned','active')
  );
$$;

-- Return true if current user is an HR of the given company.
CREATE OR REPLACE FUNCTION internhub.is_company_hr(p_company uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
      WHERE user_id = (select auth.uid())
        AND role = 'company_hr'
        AND company_id = p_company
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. GRANTs — so anon/authenticated can actually reach the tables.
--    (Supabase projects normally auto-grant via ALTER DEFAULT PRIVILEGES,
--    but if the live DB pre-dates that or had GRANTs revoked, this fixes it.)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA internhub TO anon, authenticated;

-- Grant table privileges (all current tables in public)
DO $$
DECLARE
  tbl regclass;
BEGIN
  FOR tbl IN
    SELECT c.oid
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'  -- ordinary tables
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO anon', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO authenticated', tbl);
  END LOOP;
END $$;

-- Grant sequence privileges
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Make sure future tables created in public get the same privileges
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Enable RLS on profiles + recreate its policies (unblocks login).
--    On the live DB the policies may already exist (we DROP IF EXISTS first
--    so this is safe to re-run). For all OTHER tables, run 0002 in the SQL
--    Editor after this if needed.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'department_coordinator'
        AND department_id = internhub.current_department_id())
    OR (internhub.current_role() = 'faculty_supervisor'
        AND (department_id = internhub.current_department_id()
             OR internhub.is_assigned_supervisor(user_id)))
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
    OR (internhub.current_role() = 'site_supervisor'
        AND internhub.is_assigned_supervisor(user_id))
    OR (internhub.current_role() = 'external_evaluator'
        AND EXISTS (
          SELECT 1 FROM public.evaluations e
            WHERE e.evaluator_id = (select auth.uid())
              AND e.student_user_id = profiles.user_id
        ))
  );

DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
    OR (internhub.current_role() = 'company_hr'
        AND company_id = internhub.current_company_id())
  );

DROP POLICY IF EXISTS profiles_delete ON public.profiles;
CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    OR (internhub.current_role() = 'university_admin'
        AND university_id = internhub.current_university_id())
  );

-- ----------------------------------------------------------------------------
-- 4. Permissive SELECT policies on the catalog tables (universities,
--    companies) so the marketplace/university picker works. These are
--    publicly readable by design.
-- ----------------------------------------------------------------------------
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universities FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uni_select ON public.universities;
CREATE POLICY uni_select ON public.universities
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS co_select ON public.companies;
CREATE POLICY co_select ON public.companies
  FOR SELECT TO authenticated
  USING (true);

-- ----------------------------------------------------------------------------
-- 5. Sanity-check SELECT (visible in SQL Editor output).
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM information_schema.routines
    WHERE routine_schema = 'internhub' AND routine_name = 'current_role')   AS current_role_fn_exists,
  (SELECT count(*) FROM information_schema.routines
    WHERE routine_schema = 'internhub' AND routine_name = 'is_assigned_supervisor') AS is_assigned_supervisor_fn_exists,
  (SELECT count(*) FROM information_schema.table_privileges
    WHERE table_schema = 'public' AND grantee = 'anon' AND privilege_type = 'SELECT') AS anon_select_grants,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles')                AS profiles_policies;
