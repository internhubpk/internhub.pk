-- ============================================================================
-- InternHub.pk — 0031_revoke_public_execute.sql
-- ----------------------------------------------------------------------------
-- PROBLEM
--   Migration 0030 revoked EXECUTE on trigger functions from anon /
--   authenticated, but PostgreSQL grants EXECUTE to PUBLIC by default
--   when a function is created. The `=X/postgres` entry in proacl means
--   ANY role (including anon and authenticated) can execute the function.
--   The Supabase Security Advisor still flags these as callable by anon
--   and authenticated because of the PUBLIC grant.
--
-- FIX
--   REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC for all trigger functions
--   and any SECURITY DEFINER function that should not be directly
--   callable by users.
--
--   After this, only explicit grants (postgres, service_role) allow
--   execution. Triggers still work because they execute as the function
--   owner (postgres) regardless of grants.
--
-- IDEMPOTENT
--   REVOKE is idempotent.
-- ============================================================================

BEGIN;

-- Trigger functions — only callable by postgres / service_role (via explicit grant)
REVOKE EXECUTE ON FUNCTION public.internhub_handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.internhub_sync_auth_meta_to_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.internhub_touch_attendance() FROM PUBLIC;

-- Internhub schema trigger / guard functions
REVOKE EXECUTE ON FUNCTION internhub.sync_role_to_auth_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.guard_notification_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.guard_profile_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.storage_is_owner() FROM PUBLIC;

-- internhub.assign_role / promote_to_super_admin — already had EXECUTE
-- revoked from anon/authenticated in 0028, but PUBLIC still has it.
REVOKE EXECUTE ON FUNCTION internhub.assign_role(uuid, user_role, uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.promote_to_super_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.promote_to_super_admin_by_email(text) FROM PUBLIC;

-- internhub.current_* / is_* / can_access_* — these are read-only helpers
-- used by RLS policies. RLS policy evaluation can call them regardless
-- of EXECUTE grants (postgres / service_role bypass). But they're also
-- callable by anon/authenticated via the PUBLIC grant. Revoke to be
-- defense-in-depth — they should only be called by RLS policies, not
-- directly by users.
-- Note: These live in the internhub schema which is NOT exposed via the
-- Data API, so they can't be called via PostgREST anyway. But revoking
-- PUBLIC execute is still good hygiene.
REVOKE EXECUTE ON FUNCTION internhub.current_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.current_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.current_university_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.current_department_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.current_company_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.is_assigned_supervisor(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.is_company_hr(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.is_company_hr_of(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.is_super_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.can_access_internship(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.can_access_program(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.can_access_department(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.can_access_university(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.can_access_task(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internhub.can_access_student(uuid) FROM PUBLIC;

-- public.get_user_* — these ARE exposed via PostgREST (public schema).
-- They return only the caller's own tenant IDs (read from auth.users
-- metadata), so they're safe. But to silence the advisor warning and
-- follow least-privilege, revoke from anon (keep for authenticated).
REVOKE EXECUTE ON FUNCTION public.get_user_university_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_department_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_university_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_department_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;

-- internhub_set_updated_at — plain trigger function (not SECURITY
-- DEFINER), but revoke from PUBLIC for hygiene. Triggers still work.
REVOKE EXECUTE ON FUNCTION public.internhub_set_updated_at() FROM PUBLIC;

COMMIT;

NOTIFY pgrst, 'reload schema';
