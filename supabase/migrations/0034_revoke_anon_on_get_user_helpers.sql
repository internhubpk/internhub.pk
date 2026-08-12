-- ============================================================================
-- InternHub.pk — 0034_revoke_anon_on_get_user_helpers.sql
-- ----------------------------------------------------------------------------
-- PROBLEM
--   Migration 0033 (the RLS-helper-execute fix) over-broadly granted EXECUTE
--   on public.get_user_university_id / get_user_department_id /
--   get_user_company_id to `anon`. These functions:
--     - Live in the public schema → ARE exposed via PostgREST
--     - Are NOT called by any RLS policy or storage policy (the internhub.*
--       helpers are used instead)
--     - Are NOT called by the app via PostgREST RPC (verified via grep)
--     - Return the caller's own tenant IDs (NULL for anon)
--
--   Anon EXECUTE is unnecessary and triggers 3 Supabase Security Advisor
--   WARNs ("Public Can Execute SECURITY DEFINER Function").
--
-- FIX
--   Revoke EXECUTE FROM anon on the three public.get_user_* helpers.
--   `authenticated` retains EXECUTE (granted in 0031) for backward-compat.
--
-- IDEMPOTENT
--   REVOKE is idempotent.
-- ============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_user_university_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_department_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM anon;

COMMIT;

NOTIFY pgrst, 'reload schema';
