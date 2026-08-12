-- ============================================================================
-- InternHub.pk — 0006 Fix signup 500 (auth.users trigger)
-- ----------------------------------------------------------------------------
-- PROBLEM
--   POST /auth/v1/signup returns HTTP 500 with body:
--     {"code":500,"error_code":"unexpected_failure",
--      "msg":"Database error saving new user"}
--   Root cause: the AFTER INSERT trigger `on_auth_user_created` on `auth.users`
--   fires `public.internhub_handle_new_user()`, which performs an INSERT into
--   `public.profiles`. On the live database this trigger function is either
--   missing, outdated, or references columns/types that don't exist on the
--   current `profiles` table — so the INSERT raises, which propagates up
--   through GoTrue as a generic 500.
--
--   The most common concrete causes (any one of these is enough):
--     1. `user_role` enum is missing the `pending_assignment` value
--        (older schema versions had only 8 roles). The trigger assigns
--        `'pending_assignment'` to a `user_role` variable -> enum error.
--     2. `profiles` table is missing the `is_active` column (older schema).
--     3. `profile_status` enum is missing `pending` or `active`.
--     4. The trigger function itself doesn't exist or is a stale version.
--     5. The `on_auth_user_created` trigger was dropped and never recreated.
--
-- FIX (this migration)
--   This script is fully idempotent. It guarantees — in this order — that:
--     (a) the `user_role` enum contains `pending_assignment`
--     (b) the `profile_status` enum contains `pending` and `active`
--     (c) the `profiles` table has every column the trigger writes
--     (d) the trigger function `internhub_handle_new_user()` is recreated
--         from scratch (DROP FUNCTION ... CASCADE then CREATE OR REPLACE)
--     (e) the `on_auth_user_created` trigger is recreated on `auth.users`
--     (f) the `anon` and `authenticated` roles have USAGE on `public`
--         (otherwise the data API returns 401 on every request even when
--          RLS policies are correct)
--     (g) a backfill runs so any `auth.users` rows that were created while
--         the trigger was broken now have a matching `profiles` row
--
--   Safe to run on: production, preview, or a fresh project. All statements
--   use IF NOT EXISTS / ON CONFLICT DO NOTHING / DROP IF EXISTS guards.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Ensure `user_role` enum has `pending_assignment`
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typname = 'user_role'
       AND e.enumlabel = 'pending_assignment'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'pending_assignment';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Ensure `profile_status` enum has `pending` and `active`
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typname = 'profile_status'
       AND e.enumlabel = 'pending'
  ) THEN
    ALTER TYPE public.profile_status ADD VALUE 'pending';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typname = 'profile_status'
       AND e.enumlabel = 'active'
  ) THEN
    ALTER TYPE public.profile_status ADD VALUE 'active';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Ensure `profiles` table has every column the trigger writes.
--    The table itself is created by 0001_initial_schema.sql; if an older
--    deployment has a partial version, this brings it up to spec.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id           uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email             text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username          text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name         text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name         text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role              user_role;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone             text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio               text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS university_id     uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id     uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS program_id        uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id        uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status            profile_status;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active         boolean;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_id_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title         text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS github_url        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin_url      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at        timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at        timestamptz;

-- Make sure role has a sane default; existing NULLs get pending_assignment.
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'pending_assignment';
UPDATE public.profiles SET role = 'pending_assignment' WHERE role IS NULL;

-- Same for status / is_active.
ALTER TABLE public.profiles
  ALTER COLUMN status SET DEFAULT 'pending';
UPDATE public.profiles SET status = 'pending' WHERE status IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN is_active SET DEFAULT true;
UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.profiles
  ALTER COLUMN updated_at SET DEFAULT now();

-- ----------------------------------------------------------------------------
-- 4. Recreate the trigger function from scratch.
--    DROP ... CASCADE ensures the trigger is dropped first, so we don't end
--    up with two triggers firing the same INSERT.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.internhub_handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_legacy() CASCADE;

CREATE OR REPLACE FUNCTION public.internhub_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta_role       text;
  assigned_role   user_role;
BEGIN
  meta_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_app_meta_data->>'role',
    'pending_assignment'
  );

  assigned_role := CASE
    WHEN meta_role = 'super_admin'            THEN 'super_admin'::user_role
    WHEN meta_role = 'university_admin'       THEN 'university_admin'::user_role
    WHEN meta_role = 'department_coordinator' THEN 'department_coordinator'::user_role
    WHEN meta_role = 'faculty_supervisor'     THEN 'faculty_supervisor'::user_role
    WHEN meta_role = 'student'                THEN 'student'::user_role
    WHEN meta_role = 'company_hr'             THEN 'company_hr'::user_role
    WHEN meta_role = 'site_supervisor'        THEN 'site_supervisor'::user_role
    WHEN meta_role = 'external_evaluator'     THEN 'external_evaluator'::user_role
    ELSE 'pending_assignment'::user_role
  END;

  INSERT INTO public.profiles (
    user_id, email, full_name, first_name, last_name, role,
    avatar_url, phone, status, is_active
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    assigned_role,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    CASE
      WHEN assigned_role = 'pending_assignment' THEN 'pending'::profile_status
      ELSE 'active'::profile_status
    END,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 5. Recreate the trigger on auth.users.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.internhub_handle_new_user();

-- ----------------------------------------------------------------------------
-- 6. Grant schema USAGE so anon/authenticated can reach the tables at all.
--    (Without this, the Data API returns 401 "permission denied for schema
--    public" even when RLS policies are correct.)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Backfill: any auth.users rows that exist WITHOUT a profiles row get one
--    now. (These are users who signed up while the trigger was broken.)
-- ----------------------------------------------------------------------------
INSERT INTO public.profiles (
  user_id, email, full_name, first_name, last_name, role,
  avatar_url, phone, status, is_active
)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data->>'full_name',
           u.raw_user_meta_data->>'name'),
  u.raw_user_meta_data->>'first_name',
  u.raw_user_meta_data->>'last_name',
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'role', '')::user_role,
    NULLIF(u.raw_app_meta_data->>'role', '')::user_role,
    'pending_assignment'::user_role
  ),
  u.raw_user_meta_data->>'avatar_url',
  u.raw_user_meta_data->>'phone',
  'pending',
  true
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8. Sanity check (visible in the SQL Editor output).
--    If anything is wrong, these counts tell us immediately.
-- ----------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM auth.users)                                    AS auth_users,
  (SELECT count(*) FROM public.profiles)                               AS profiles,
  (SELECT count(*) FROM pg_type t
     JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role')            AS user_role_type_exists,
  (SELECT count(*) FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role'
      AND e.enumlabel = 'pending_assignment')                          AS pending_assignment_value_exists,
  (SELECT count(*) FROM information_schema.triggers
    WHERE event_object_table = 'users'
      AND event_object_schema = 'auth'
      AND trigger_name = 'on_auth_user_created')                       AS trigger_exists;
