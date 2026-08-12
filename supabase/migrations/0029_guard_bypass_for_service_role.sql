-- ============================================================================
-- InternHub.pk — 0029_guard_bypass_for_service_role.sql
-- ----------------------------------------------------------------------------
-- PROBLEM
--   The guard_profile_update (0028) and guard_notification_update (0027)
--   trigger functions block UPDATEs to protected columns when the caller
--   is not super_admin. However, both functions evaluate
--   internhub.current_role() — which returns 'pending_assignment' when
--   auth.uid() is NULL. This means service_role API routes (which use
--   the adminClient and have no auth.uid()) get blocked by the guard
--   when they legitimately need to update is_active / status / etc. on
--   profiles (e.g. /api/company-hr/supervisors/[id] toggling is_active
--   on a supervisor's profile).
--
-- FIX
--   Both guard functions check `auth.uid() IS NULL` first. If NULL, the
--   call is from service_role or postgres (no user context) — allow it.
--   This is the standard PostgreSQL pattern for triggers that should
--   only enforce their policy for authenticated user calls.
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION. Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. guard_profile_update — skip when auth.uid() is NULL
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.guard_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_is_super_admin boolean;
BEGIN
  -- When auth.uid() is NULL, the call is from the service_role client
  -- (admin API routes) or the postgres superuser (SQL Editor). Both are
  -- privileged contexts that should bypass this guard.
  v_uid := (select auth.uid());
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow super_admin to do anything (assign_role / promote flows).
  SELECT internhub.is_super_admin() INTO v_is_super_admin;
  IF v_is_super_admin THEN
    RETURN NEW;
  END IF;

  -- Block role escalation / tenant reassignment by non-super_admin.
  IF OLD.role IS DISTINCT FROM NEW.role
     OR OLD.university_id IS DISTINCT FROM NEW.university_id
     OR OLD.department_id IS DISTINCT FROM NEW.department_id
     OR OLD.program_id IS DISTINCT FROM NEW.program_id
     OR OLD.company_id IS DISTINCT FROM NEW.company_id
     OR OLD.status IS DISTINCT FROM NEW.status
     OR OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    RAISE EXCEPTION
      'Permission denied: cannot modify authorization columns (role, university_id, department_id, program_id, company_id, status, is_active) without super_admin privileges.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
ALTER FUNCTION internhub.guard_profile_update() OWNER TO postgres;

-- ----------------------------------------------------------------------------
-- 2. guard_notification_update — skip when auth.uid() is NULL
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub.guard_notification_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_is_super_admin boolean;
  v_is_sender boolean;
BEGIN
  -- Service-role / postgres calls (no auth.uid()) bypass the guard.
  v_uid := (select auth.uid());
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip guard for super_admin (full access)
  SELECT internhub.current_role() = 'super_admin' INTO v_is_super_admin;
  IF v_is_super_admin THEN
    RETURN NEW;
  END IF;

  -- Skip guard for sender (sender can update their own outgoing notifications)
  IF NEW.sender_id = v_uid AND OLD.sender_id = v_uid THEN
    RETURN NEW;
  END IF;

  -- For recipient updates: only allow is_read to change
  IF OLD.title IS DISTINCT FROM NEW.title
     OR OLD.message IS DISTINCT FROM NEW.message
     OR OLD.category IS DISTINCT FROM NEW.category
     OR OLD.priority IS DISTINCT FROM NEW.priority
     OR OLD.action_url IS DISTINCT FROM NEW.action_url
     OR OLD.metadata IS DISTINCT FROM NEW.metadata
     OR OLD.user_id IS DISTINCT FROM NEW.user_id
     OR OLD.sender_id IS DISTINCT FROM NEW.sender_id THEN
    RAISE EXCEPTION 'Recipients can only update is_read on notifications'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
ALTER FUNCTION internhub.guard_notification_update() OWNER TO postgres;

COMMIT;

NOTIFY pgrst, 'reload schema';
