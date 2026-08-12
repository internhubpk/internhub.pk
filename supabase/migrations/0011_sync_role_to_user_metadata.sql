-- ============================================================================
-- InternHub.pk — 0011 Sync profiles.role to BOTH raw_app_meta_data AND
--                            raw_user_meta_data
-- ----------------------------------------------------------------------------
-- WHY
--   Migration 0009 wired up a trigger (profiles_sync_role_to_auth) that copies
--   profiles.role into auth.users.raw_app_meta_data whenever a profile row is
--   inserted or its role changes. That fixed the RLS recursion and made
--   internhub.current_role() return the right value.
--
--   BUT it only updated raw_app_meta_data. raw_user_meta_data was left alone.
--   This matters because:
--
--     * The Next.js proxy (src/proxy.ts) reads user.user_metadata.role FIRST,
--       then user.app_metadata.role. user.user_metadata maps to
--       raw_user_meta_data in auth.users.
--     * The /dashboard server redirect (src/app/(dashboard)/dashboard/page.tsx)
--       also checks user_metadata.role FIRST.
--     * The client AuthProvider's getEffectiveRole() falls back to
--       user.user_metadata.role when profile.role is missing.
--
--   So when an admin manually changes profiles.role (e.g. super_admin →
--   university_admin), only raw_app_meta_data gets the new value. The proxy
--   and /dashboard still see the OLD role in raw_user_meta_data and route the
--   user to the OLD dashboard (/super-admin). Then the client-side RouteGuard
--   reads profile.role (= new role) and blocks them — "You don't have
--   permission to view this page. Your current role (university_admin)
--   doesn't have access to this resource."
--
--   This migration closes that loop:
--     1. Rewrites internhub.sync_role_to_auth_users() so it updates BOTH
--        raw_app_meta_data AND raw_user_meta_data on every role change.
--     2. One-time backfill: copies profiles.role into raw_user_meta_data for
--        every existing user whose raw_user_meta_data.role is missing or
--        out of sync.
--     3. Diagnostic at the end.
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS + CREATE TRIGGER.
--   The backfill UPDATE only touches rows that are out of sync, so re-running
--   is a no-op.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rewrite the sync trigger function to update BOTH metadata fields
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.sync_role_to_auth_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.role IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role) THEN
    -- Update BOTH raw_app_meta_data AND raw_user_meta_data so that
    -- every consumer (proxy.ts, /dashboard, RouteGuard, current_role())
    -- sees the same role. raw_app_meta_data is system-managed and is the
    -- authoritative source; raw_user_meta_data is what the JWT exposes as
    -- user.user_metadata — it must also be in sync because several client
    -- + server code paths read it FIRST for legacy reasons.
    UPDATE auth.users
      SET raw_app_meta_data =
            COALESCE(raw_app_meta_data, '{}'::jsonb)
            || jsonb_build_object('role', NEW.role::text),
          raw_user_meta_data =
            COALESCE(raw_user_meta_data, '{}'::jsonb)
            || jsonb_build_object('role', NEW.role::text)
      WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION internhub.sync_role_to_auth_users() OWNER TO postgres;

-- Re-attach the trigger (DROP IF EXISTS makes this idempotent)
DROP TRIGGER IF EXISTS profiles_sync_role_to_auth ON public.profiles;
CREATE TRIGGER profiles_sync_role_to_auth
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION internhub.sync_role_to_auth_users();

-- ----------------------------------------------------------------------------
-- 2. One-time backfill — sync raw_user_meta_data.role for every existing user
--    (picks up everyone whose role was manually changed before this migration)
-- ----------------------------------------------------------------------------
UPDATE auth.users u
SET raw_user_meta_data =
      COALESCE(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', p.role::text)
FROM public.profiles p
WHERE p.user_id = u.id
  AND p.role IS NOT NULL
  AND COALESCE(u.raw_user_meta_data->>'role', '') <> p.role::text;

-- Also make sure raw_app_meta_data is in sync while we're at it
-- (covers the case where 0009 was run but a profile.role change happened
--  before the 0009 trigger was in place)
UPDATE auth.users u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', p.role::text)
FROM public.profiles p
WHERE p.user_id = u.id
  AND p.role IS NOT NULL
  AND COALESCE(u.raw_app_meta_data->>'role', '') <> p.role::text;

-- ----------------------------------------------------------------------------
-- 3. Diagnostic — should show 0 users_out_of_sync after this runs
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM auth.users u
     JOIN public.profiles p ON p.user_id = u.id
    WHERE COALESCE(u.raw_app_meta_data->>'role', '') <> p.role::text)
                                                              AS app_meta_out_of_sync,
  (SELECT count(*) FROM auth.users u
     JOIN public.profiles p ON p.user_id = u.id
    WHERE COALESCE(u.raw_user_meta_data->>'role', '') <> p.role::text)
                                                              AS user_meta_out_of_sync,
  (SELECT count(*) FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'profiles'
      AND trigger_name = 'profiles_sync_role_to_auth')        AS sync_trigger_exists;
