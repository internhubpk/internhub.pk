-- ============================================================================
-- 0084: SECURITY — Remove user-writable metadata trust from RLS helpers
-- ----------------------------------------------------------------------------
-- PROBLEM (verified live 2026-08-23):
--   internhub.current_role() / current_university_id() / current_company_id()
--   / current_department_id() fall back to auth.users.raw_user_meta_data,
--   which ANY authenticated user can rewrite via the public
--   PUT /auth/v1/user endpoint (auth.updateUser).
--
--   Proven exploits against production:
--   1. Any user whose raw_app_meta_data->>'role' is NULL/invalid could set
--      user_metadata.role='super_admin' and obtain FULL super_admin RLS
--      (read every profile/audit log/student/weekly log, modify any profile).
--      One production account (superadmin@internhub.pk) had app role NULL.
--   2. Any self-signup user (app university_id NULL) could set
--      user_metadata.university_id=<foreign university>; the
--      internhub_sync_auth_meta_to_profile trigger then wrote the forged id
--      into profiles.university_id AND laundered it into app_metadata.
--
-- FIX:
--   A. current_role(): app_metadata only; anything else -> pending_assignment.
--   B. current_university_id()/current_company_id()/current_department_id():
--      app_metadata first, then the user's PROFILES row (admin-controlled,
--      protected by guard_profile_update trigger) — never raw_user_meta_data.
--   C. internhub_sync_auth_meta_to_profile: only propagate tenant ids from
--      raw_APP_meta_data (admin-only writable). raw_user_meta_data is ignored.
--   D. internhub.ensure_profile_exists: role comes from raw_APP_meta_data ONLY.
--      Self-signups (user_metadata only) always start as pending_assignment.
--      super_admin is additionally rejected from metadata entirely — the
--      bootstrap admin already exists and promotion is a manual, audited DB
--      operation (documented in supabase/README.md).
--   E. Backfill app_metadata.role from profiles.role for the one legacy
--      account missing it, so nobody depends on the removed fallback.
-- ============================================================================

-- ============================================================================
-- A. current_role() — app_metadata only
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub."current_role"()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN raw_app_meta_data->>'role' IN (
          'super_admin','university_admin','department_coordinator',
          'program_coordinator','faculty_supervisor','student','company_hr',
          'site_supervisor','external_evaluator','pending_assignment'
        ) THEN (raw_app_meta_data->>'role')::user_role
        ELSE 'pending_assignment'::user_role
      END
      FROM auth.users
      WHERE id = (SELECT auth.uid())
    ),
    'pending_assignment'::user_role
  );
$function$;

-- ============================================================================
-- B. Tenant helpers — app_metadata, then profiles (never user_metadata)
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.current_university_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (raw_app_meta_data->>'university_id')::uuid,
    (
      SELECT p.university_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  )
  FROM auth.users
  WHERE id = (SELECT auth.uid());
$function$;

CREATE OR REPLACE FUNCTION internhub.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (raw_app_meta_data->>'company_id')::uuid,
    (
      SELECT p.company_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  )
  FROM auth.users
  WHERE id = (SELECT auth.uid());
$function$;

CREATE OR REPLACE FUNCTION internhub.current_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (raw_app_meta_data->>'department_id')::uuid,
    (
      SELECT p.department_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  )
  FROM auth.users
  WHERE id = (SELECT auth.uid());
$function$;

-- ============================================================================
-- C. auth.users metadata -> profiles sync: app_metadata only
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.sync_auth_meta_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_university_id text;
  v_department_id text;
  v_company_id    text;
BEGIN
  -- Only act if metadata columns changed
  IF TG_OP = 'UPDATE'
     AND OLD.raw_user_meta_data IS NOT DISTINCT FROM NEW.raw_user_meta_data
     AND OLD.raw_app_meta_data  IS NOT DISTINCT FROM NEW.raw_app_meta_data THEN
    RETURN NEW;
  END IF;

  -- SECURITY: tenant ids are resolved from raw_APP_meta_data ONLY.
  -- raw_user_meta_data is user-writable via PUT /auth/v1/user and must
  -- never influence tenant membership (previous version allowed any user
  -- to join any university/company by rewriting their own metadata).
  v_university_id := CASE
    WHEN NEW.raw_app_meta_data->>'university_id'
         ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
    THEN NEW.raw_app_meta_data->>'university_id'
    ELSE NULL
  END;

  v_department_id := CASE
    WHEN NEW.raw_app_meta_data->>'department_id'
         ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
    THEN NEW.raw_app_meta_data->>'department_id'
    ELSE NULL
  END;

  v_company_id := CASE
    WHEN NEW.raw_app_meta_data->>'company_id'
         ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
    THEN NEW.raw_app_meta_data->>'company_id'
    ELSE NULL
  END;

  BEGIN
    UPDATE public.profiles
    SET
      university_id = CASE
        WHEN v_university_id IS NOT NULL THEN v_university_id::uuid
        ELSE university_id
      END,
      department_id = CASE
        WHEN v_department_id IS NOT NULL THEN v_department_id::uuid
        ELSE department_id
      END,
      company_id = CASE
        WHEN v_company_id IS NOT NULL THEN v_company_id::uuid
        ELSE company_id
      END,
      updated_at = now()
    WHERE user_id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'internhub_sync_auth_meta_to_profile: failed for user %: % (%)',
      NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- D. ensure_profile_exists — role from app_metadata only; never super_admin
-- ============================================================================
CREATE OR REPLACE FUNCTION internhub.ensure_profile_exists(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_user record;
  v_role text;
  v_assigned_role user_role;
  v_university_id text;
  v_department_id text;
  v_company_id text;
  v_full_name text;
  v_status profile_status;
  v_existing uuid;
  v_uni uuid;
  v_dept uuid;
  v_comp uuid;
BEGIN
  SELECT user_id INTO v_existing FROM public.profiles WHERE user_id = p_user_id;
  IF FOUND THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_auth_user FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'auth.users row not found for user_id %', p_user_id;
  END IF;

  -- SECURITY: role is resolved from raw_APP_meta_data ONLY (admin/service
  -- writable). raw_user_meta_data is attacker-controllable at signup and is
  -- ignored. super_admin can never be granted via metadata — it must be set
  -- directly in the database by a platform operator.
  v_role := v_auth_user.raw_app_meta_data->>'role';
  v_assigned_role := CASE
    WHEN v_role = 'university_admin' THEN 'university_admin'::user_role
    WHEN v_role = 'department_coordinator' THEN 'department_coordinator'::user_role
    WHEN v_role = 'program_coordinator' THEN 'program_coordinator'::user_role
    WHEN v_role = 'faculty_supervisor' THEN 'faculty_supervisor'::user_role
    WHEN v_role = 'student' THEN 'student'::user_role
    WHEN v_role = 'company_hr' THEN 'company_hr'::user_role
    WHEN v_role = 'site_supervisor' THEN 'site_supervisor'::user_role
    WHEN v_role = 'external_evaluator' THEN 'external_evaluator'::user_role
    ELSE 'pending_assignment'::user_role
  END;

  -- Tenant ids: app_metadata only (same policy as the sync trigger).
  v_university_id := CASE
    WHEN v_auth_user.raw_app_meta_data->>'university_id' ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
    THEN v_auth_user.raw_app_meta_data->>'university_id' ELSE NULL END;
  v_department_id := CASE
    WHEN v_auth_user.raw_app_meta_data->>'department_id' ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
    THEN v_auth_user.raw_app_meta_data->>'department_id' ELSE NULL END;
  v_company_id := CASE
    WHEN v_auth_user.raw_app_meta_data->>'company_id' ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
    THEN v_auth_user.raw_app_meta_data->>'company_id' ELSE NULL END;

  IF v_university_id IS NOT NULL THEN
    SELECT id INTO v_uni FROM public.universities WHERE id = v_university_id::uuid;
    IF NOT FOUND THEN v_uni := NULL; END IF;
  END IF;
  IF v_department_id IS NOT NULL THEN
    SELECT id INTO v_dept FROM public.departments WHERE id = v_department_id::uuid;
    IF NOT FOUND THEN v_dept := NULL; END IF;
  END IF;
  IF v_company_id IS NOT NULL THEN
    SELECT id INTO v_comp FROM public.companies WHERE id = v_company_id::uuid;
    IF NOT FOUND THEN v_comp := NULL; END IF;
  END IF;

  v_full_name := COALESCE(
    v_auth_user.raw_user_meta_data->>'full_name',
    v_auth_user.raw_user_meta_data->>'name',
    NULLIF(TRIM(COALESCE(v_auth_user.raw_user_meta_data->>'first_name', '') || ' ' ||
                 COALESCE(v_auth_user.raw_user_meta_data->>'last_name', '')), '')
  );

  v_status := CASE WHEN v_assigned_role = 'pending_assignment' THEN 'pending' ELSE 'active' END;

  INSERT INTO public.profiles (
    user_id, email, full_name, first_name, last_name, role,
    avatar_url, phone, status, is_active,
    university_id, department_id, company_id
  ) VALUES (
    p_user_id,
    COALESCE(v_auth_user.email, ''),
    v_full_name,
    v_auth_user.raw_user_meta_data->>'first_name',
    v_auth_user.raw_user_meta_data->>'last_name',
    v_assigned_role,
    v_auth_user.raw_user_meta_data->>'avatar_url',
    v_auth_user.raw_user_meta_data->>'phone',
    v_status,
    true,
    v_uni, v_dept, v_comp
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN TRUE;
END;
$function$;

-- ============================================================================
-- E. Backfill: nobody may depend on the removed user_metadata fallback.
--    Sync app_metadata.role from profiles.role where missing/invalid.
--    Also normalize user_metadata: strip any 'role' key that disagrees with
--    the authoritative profile role (leftover forged values).
-- ============================================================================
UPDATE auth.users u
SET raw_app_meta_data = jsonb_set(
      COALESCE(u.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(p.role::text)
    )
FROM public.profiles p
WHERE p.user_id = u.id
  AND COALESCE(u.raw_app_meta_data->>'role', '') <> p.role::text;

-- Strip forged role/university/company ids from user-writable metadata so
-- stale values cannot resurface through any code path that still reads
-- user_metadata (defense-in-depth for the app layer during rollout).
UPDATE auth.users u
SET raw_user_meta_data = (u.raw_user_meta_data
      - 'role'
      - 'university_id' || CASE WHEN u.raw_app_meta_data ? 'university_id'
                                THEN jsonb_build_object('university_id', u.raw_app_meta_data->'university_id')
                                ELSE '{}'::jsonb END
      - 'department_id' || CASE WHEN u.raw_app_meta_data ? 'department_id'
                                THEN jsonb_build_object('department_id', u.raw_app_meta_data->'department_id')
                                ELSE '{}'::jsonb END
      - 'company_id'    || CASE WHEN u.raw_app_meta_data ? 'company_id'
                                THEN jsonb_build_object('company_id', u.raw_app_meta_data->'company_id')
                                ELSE '{}'::jsonb END
    )
WHERE u.raw_user_meta_data IS NOT NULL
  AND (
    u.raw_user_meta_data ? 'role'
    OR u.raw_user_meta_data ? 'university_id'
    OR u.raw_user_meta_data ? 'department_id'
    OR u.raw_user_meta_data ? 'company_id'
  );

-- ============================================================================
-- F. Revoke direct execution of privileged role-management functions from
--    anon/authenticated. Broad "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA
--    internhub" (migrations 0063-0065, needed so RLS policies can call the
--    read-only helpers) also swept up admin-only functions, undoing the
--    targeted revokes from 0069/0070. Revoke again so only postgres and
--    service_role (server-side API routes) can manage roles. RLS policy
--    evaluation never calls these functions.
-- ============================================================================
REVOKE EXECUTE ON FUNCTION internhub.assign_role(uuid, user_role, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_role(uuid, user_role, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION internhub.promote_to_super_admin(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- G. Documented invariant: profile tenant membership may only change through
--    admin flows (assign_role / admin API routes / the app_metadata sync
--    trigger in section C). user_metadata can no longer influence it.
-- ============================================================================

-- ============================================================================
-- H. Tenant-scoped company registration for university admins.
--    /api/companies POST explicitly allows university_admin to register a
--    company FOR THEIR OWN university, but the only INSERT policy on
--    companies is super_admin-only — the insert always fails under RLS.
--    Add the missing tenant-scoped policy so the documented feature works.
--    (company_hr remains unable to self-register companies into arbitrary
--    universities: without a university_id on their profile the WITH CHECK
--    fails, which is the intended restriction.)
-- ============================================================================
CREATE POLICY co_insert_university_admin ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    internhub."current_role"() = 'university_admin'::user_role
    AND university_id = internhub.current_university_id()
  );
