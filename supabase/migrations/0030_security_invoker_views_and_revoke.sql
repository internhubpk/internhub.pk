-- ============================================================================
-- InternHub.pk — 0030_security_invoker_views_and_revoke.sql
-- ----------------------------------------------------------------------------
-- PROBLEM (Supabase Security Advisor — 11 ERROR + 14 WARN findings)
--
--   1. Alias views in public schema are SECURITY DEFINER by default. They
--      run as the view owner (postgres, which has BYPASSRLS), bypassing
--      RLS on the underlying tables. Any authenticated user can SELECT
--      from e.g. `applications` view and see ALL rows of
--      `internship_applications` regardless of RLS policies.
--      CRITICAL cross-tenant data leak.
--
--      Affected views (created in 0001):
--        applications (alias for internship_applications)
--        submissions (alias for task_submissions)
--        weekly_reports (alias for weekly_logs)
--        site_supervisor_evaluations (filtered view of evaluations)
--        faculty_evaluations (filtered view of evaluations)
--        notifications_sent (filtered view of notifications)
--        notification_recipients (alias for notifications)
--        settings (alias for platform_settings)
--        host_organizations (alias for companies)
--        site_supervisors (filtered view of supervisors)
--        external_evaluators (filtered view of supervisors)
--
--      FIX: ALTER VIEW ... SET (security_invoker = true) so the view
--      runs with the caller's identity and RLS policies on the
--      underlying tables are applied correctly.
--
--   2. Trigger functions in public schema are callable by anon /
--      authenticated via PostgREST. These functions are only meant to
--      be called by their respective triggers, not directly by users.
--      Affected: internhub_handle_new_user, internhub_sync_auth_meta_to_profile,
--      internhub_touch_attendance.
--      FIX: REVOKE EXECUTE FROM anon, authenticated.
--
--   3. internhub_set_updated_at has no search_path set. Fix: add
--      SET search_path = public.
--
--   4. internhub.storage_is_owner() function references storage.objects
--      but is not used by any policy (all storage policies inline the
--      check). It's a candidate for removal but kept for backward
--      compatibility. Revoke EXECUTE from anon/authenticated to
--      prevent abuse.
--
-- IDEMPOTENT
--   ALTER VIEW SET is idempotent. REVOKE is idempotent. CREATE OR
--   REPLACE FUNCTION is idempotent.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Switch all alias / filtered views to security_invoker = true
--    so RLS on the underlying tables is applied based on the caller.
-- ============================================================================
ALTER VIEW public.applications                SET (security_invoker = true);
ALTER VIEW public.submissions                  SET (security_invoker = true);
ALTER VIEW public.weekly_reports               SET (security_invoker = true);
ALTER VIEW public.site_supervisor_evaluations  SET (security_invoker = true);
ALTER VIEW public.faculty_evaluations          SET (security_invoker = true);
ALTER VIEW public.notifications_sent           SET (security_invoker = true);
ALTER VIEW public.notification_recipients      SET (security_invoker = true);
ALTER VIEW public.settings                     SET (security_invoker = true);
ALTER VIEW public.host_organizations           SET (security_invoker = true);
ALTER VIEW public.site_supervisors             SET (security_invoker = true);
ALTER VIEW public.external_evaluators          SET (security_invoker = true);

-- ============================================================================
-- 2. REVOKE EXECUTE on trigger functions from anon / authenticated.
--    These should only be invoked by their triggers, never directly.
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.internhub_handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.internhub_sync_auth_meta_to_profile() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.internhub_touch_attendance() FROM anon, authenticated;

-- Also revoke on the internhub.* trigger / mutation functions that
-- shouldn't be callable directly by users (they live in internhub
-- schema which is not exposed via PostgREST, but defense in depth).
REVOKE EXECUTE ON FUNCTION internhub.sync_role_to_auth_users() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION internhub.guard_notification_update() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION internhub.guard_profile_update() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION internhub.storage_is_owner() FROM anon, authenticated;

-- ============================================================================
-- 3. Add search_path to internhub_set_updated_at (was missing)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.internhub_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.internhub_set_updated_at() OWNER TO postgres;

-- ============================================================================
-- 4. Verify the views are now security_invoker
-- ============================================================================
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
      AND NOT COALESCE(
        (SELECT option_value FROM pg_options_to_table(c.reloptions)
          WHERE option_name = 'security_invoker'),
        'false')::boolean;
  IF v_count > 0 THEN
    RAISE NOTICE 'WARNING: % views still have security_invoker=false', v_count;
  ELSE
    RAISE NOTICE 'All public views are now security_invoker=true';
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
