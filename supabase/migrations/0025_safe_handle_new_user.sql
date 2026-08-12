-- ============================================================================
-- InternHub.pk — 0025_safe_handle_new_user.sql
-- ----------------------------------------------------------------------------
-- PROBLEM
--   The user is hitting `Database error creating new user` (HTTP 500 from
--   GoTrue) when the company-hr/supervisors API calls
--   `auth.admin.createUser()`. This exact error is documented in migration
--   0006 — it is what Supabase Auth returns when the `on_auth_user_created`
--   trigger on `auth.users` raises an exception. The auth user is then
--   rolled back and never exists, so the API cannot proceed to create the
--   profiles / supervisors rows.
--
--   Even after 0021 reworked the trigger to write tenant IDs, the trigger
--   can STILL raise on edge cases:
--     • composite FK violations on `supervisors` (program_id, department_id)
--       are not the issue here (the trigger doesn't touch supervisors), but
--       any uncaught exception inside the trigger function bubbles up to
--       GoTrue as "Database error creating new user".
--     • the `profiles_sync_auth_metadata` AFTER INSERT trigger on profiles
--       calls `internhub.sync_role_to_auth_users()` which UPDATEs
--       `auth.users`. That UPDATE fires `on_auth_user_metadata_updated`
--       which calls `internhub_sync_auth_meta_to_profile()` which UPDATEs
--       `profiles`. Any failure in this chain rolls back the whole
--       transaction including the original auth.users INSERT.
--
-- FIX
--   Wrap the body of `internhub_handle_new_user()` in a BEGIN ... EXCEPTION
--   block. If the profiles INSERT fails for ANY reason, we:
--     1. Log the error to Postgres logs (RAISE NOTICE)
--     2. Return NEW anyway — so the auth.users INSERT succeeds.
--   The profiles row will be created by the API route's explicit upsert
--   step (which uses the service role client and has its own error
--   handling + rollback of the auth user on failure).
--
--   This is the same pattern Supabase recommends for self-signup flows
--   where the trigger is best-effort: never let a profiles-row issue
--   block account creation.
--
-- IDEMPOTENT
--   CREATE OR REPLACE FUNCTION. Safe to re-run.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.internhub_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  meta_role       text;
  assigned_role   user_role;
  v_university_id text;
  v_department_id text;
  v_company_id    text;
  v_full_name     text;
  v_status        profile_status;
BEGIN
  -- Role from metadata (priority: app_meta first, then user_meta)
  meta_role := COALESCE(
    NEW.raw_app_meta_data->>'role',
    NEW.raw_user_meta_data->>'role',
    'pending_assignment'
  );
  assigned_role := CASE
    WHEN meta_role = 'super_admin' THEN 'super_admin'
    WHEN meta_role = 'university_admin' THEN 'university_admin'
    WHEN meta_role = 'department_coordinator' THEN 'department_coordinator'
    WHEN meta_role = 'faculty_supervisor' THEN 'faculty_supervisor'
    WHEN meta_role = 'student' THEN 'student'
    WHEN meta_role = 'company_hr' THEN 'company_hr'
    WHEN meta_role = 'site_supervisor' THEN 'site_supervisor'
    WHEN meta_role = 'external_evaluator' THEN 'external_evaluator'
    ELSE 'pending_assignment'
  END;

  -- Tenant IDs from metadata — validate UUID format before casting
  v_university_id := COALESCE(
    CASE
      WHEN NEW.raw_app_meta_data->>'university_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_app_meta_data->>'university_id'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'university_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_user_meta_data->>'university_id'
      ELSE NULL
    END
  );

  v_department_id := COALESCE(
    CASE
      WHEN NEW.raw_app_meta_data->>'department_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_app_meta_data->>'department_id'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'department_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_user_meta_data->>'department_id'
      ELSE NULL
    END
  );

  v_company_id := COALESCE(
    CASE
      WHEN NEW.raw_app_meta_data->>'company_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_app_meta_data->>'company_id'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'company_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_user_meta_data->>'company_id'
      ELSE NULL
    END
  );

  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'first_name' || ' ' || NEW.raw_user_meta_data->>'last_name'
  );

  v_status := CASE WHEN assigned_role = 'pending_assignment' THEN 'pending' ELSE 'active' END;

  -- ----------------------------------------------------------------------
  -- Best-effort profiles INSERT. If ANYTHING goes wrong (RLS, FK, enum,
  -- unique constraint, downstream trigger recursion, etc.) we log it and
  -- RETURN NEW anyway so auth.users INSERT succeeds. The API route is
  -- responsible for upserting the full profiles row afterwards.
  -- ----------------------------------------------------------------------
  BEGIN
    INSERT INTO public.profiles (
      user_id, email, full_name, first_name, last_name, role,
      avatar_url, phone, status, is_active,
      university_id, department_id, company_id
    ) VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      v_full_name,
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name',
      assigned_role,
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'phone',
      v_status,
      true,
      v_university_id::uuid,
      v_department_id::uuid,
      v_company_id::uuid
    )
    ON CONFLICT (user_id) DO UPDATE SET
      university_id = EXCLUDED.university_id,
      department_id = EXCLUDED.department_id,
      company_id    = EXCLUDED.company_id,
      updated_at    = now()
    WHERE
      public.profiles.university_id IS DISTINCT FROM EXCLUDED.university_id
      OR public.profiles.department_id IS DISTINCT FROM EXCLUDED.department_id
      OR public.profiles.company_id    IS DISTINCT FROM EXCLUDED.company_id;
  EXCEPTION WHEN OTHERS THEN
    -- Log and swallow. The API route's upsert step will create / fix
    -- the profiles row using the service role client.
    RAISE NOTICE 'internhub_handle_new_user: profiles INSERT failed for user %: % (%)',
      NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.internhub_handle_new_user() OWNER TO postgres;

-- Re-attach the trigger (DROP IF EXISTS makes this idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.internhub_handle_new_user();

-- Also make the cascaded sync trigger (profiles -> auth.users metadata)
-- best-effort. If THIS one raises, it would still roll back the profiles
-- INSERT (which would then roll back the auth.users INSERT via the outer
-- trigger). Wrap it the same way.
CREATE OR REPLACE FUNCTION internhub.sync_role_to_auth_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_patch jsonb := '{}'::jsonb;
BEGIN
  BEGIN
    -- Role
    IF (TG_OP = 'INSERT' AND NEW.role IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role) THEN
      meta_patch := meta_patch || jsonb_build_object('role', NEW.role::text);
    END IF;

    -- university_id (only patch if changed — avoids clobbering other metadata)
    IF (TG_OP = 'INSERT' AND NEW.university_id IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.university_id IS DISTINCT FROM OLD.university_id) THEN
      meta_patch := meta_patch || jsonb_build_object(
        'university_id', COALESCE(NEW.university_id::text, null)
      );
    END IF;

    -- department_id
    IF (TG_OP = 'INSERT' AND NEW.department_id IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.department_id IS DISTINCT FROM OLD.department_id) THEN
      meta_patch := meta_patch || jsonb_build_object(
        'department_id', COALESCE(NEW.department_id::text, null)
      );
    END IF;

    -- company_id
    IF (TG_OP = 'INSERT' AND NEW.company_id IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id) THEN
      meta_patch := meta_patch || jsonb_build_object(
        'company_id', COALESCE(NEW.company_id::text, null)
      );
    END IF;

    -- Only write if there's something to sync
    IF meta_patch <> '{}'::jsonb THEN
      UPDATE auth.users
        SET raw_app_meta_data  = COALESCE(raw_app_meta_data,  '{}'::jsonb) || meta_patch,
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || meta_patch
        WHERE id = NEW.user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'sync_role_to_auth_users: failed for user %: % (%)',
      NEW.user_id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

ALTER FUNCTION internhub.sync_role_to_auth_users() OWNER TO postgres;

-- And the reverse direction (auth.users metadata update -> profiles) —
-- also best-effort so it can't break the chain.
CREATE OR REPLACE FUNCTION internhub_sync_auth_meta_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_university_id text;
  v_department_id text;
  v_company_id    text;
BEGIN
  -- Only act if tenant-bearing metadata columns changed
  IF TG_OP = 'UPDATE'
     AND OLD.raw_user_meta_data IS NOT DISTINCT FROM NEW.raw_user_meta_data
     AND OLD.raw_app_meta_data  IS NOT DISTINCT FROM NEW.raw_app_meta_data THEN
    RETURN NEW;
  END IF;

  -- Resolve effective tenant IDs (app_meta priority, then user_meta)
  v_university_id := COALESCE(
    CASE
      WHEN NEW.raw_app_meta_data->>'university_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_app_meta_data->>'university_id'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'university_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_user_meta_data->>'university_id'
      ELSE NULL
    END
  );

  v_department_id := COALESCE(
    CASE
      WHEN NEW.raw_app_meta_data->>'department_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_app_meta_data->>'department_id'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'department_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_user_meta_data->>'department_id'
      ELSE NULL
    END
  );

  v_company_id := COALESCE(
    CASE
      WHEN NEW.raw_app_meta_data->>'company_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_app_meta_data->>'company_id'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'company_id'
           ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
      THEN NEW.raw_user_meta_data->>'company_id'
      ELSE NULL
    END
  );

  BEGIN
    -- Propagate to profiles row (only update if value actually changed)
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
$$;

ALTER FUNCTION internhub_sync_auth_meta_to_profile() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_auth_user_metadata_updated ON auth.users;
CREATE TRIGGER on_auth_user_metadata_updated
  AFTER UPDATE OF raw_user_meta_data, raw_app_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION internhub_sync_auth_meta_to_profile();

COMMIT;

-- Reload PostgREST schema cache (harmless if no schema changes)
NOTIFY pgrst, 'reload schema';
