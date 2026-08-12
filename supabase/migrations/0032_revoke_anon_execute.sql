-- ============================================================================
-- InternHub.pk — 0032_revoke_anon_execute.sql
-- ----------------------------------------------------------------------------
-- Final cleanup: revoke EXECUTE on get_user_* helper functions from anon.
-- These functions return the caller's own tenant IDs (read from
-- auth.users metadata). They're safe but should only be callable by
-- authenticated users, not anon.
-- ============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_user_university_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_department_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM anon;

-- Also defensively revoke anon execute on every SECURITY DEFINER function
-- in the internhub schema (in case any was missed).
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT n.nspname AS schema_name, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname IN ('public','internhub')
       AND p.prosecdef = true
       AND p.proname NOT LIKE 'pg_%'
       AND p.proname NOT LIKE 'supabase_%'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon',
      f.schema_name, f.proname, f.args);
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
