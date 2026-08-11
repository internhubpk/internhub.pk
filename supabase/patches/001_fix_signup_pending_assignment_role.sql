-- ============================================================================
-- PATCH: fix "Database error saving new user" / 500 on POST /auth/v1/signup
-- ============================================================================
-- Root cause: src/app/(auth)/register/page.tsx sends
--   options: { data: { role: "pending_assignment", full_name: ... } }
-- on every signup. "pending_assignment" is not a value in the
-- public.user_role enum, so the handle_new_auth_user trigger tried to
-- cast it directly, Postgres raised "invalid input value for enum
-- user_role", and the whole auth.users INSERT was rolled back -- which
-- GoTrue reports to the client as a generic 500.
--
-- This patch replaces just the trigger function with a version that
-- treats any unrecognized/placeholder role as "no role yet" (defaults
-- to student + status pending_setup, exactly matching the product's
-- "admin assigns role later" flow) and never lets a profile-provisioning
-- error block account creation.
--
-- SAFE TO RUN ON A LIVE PROJECT: it only replaces one function, no
-- tables are touched and no data is lost. Paste into the Supabase SQL
-- Editor and run once.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  resolved_role public.user_role;
BEGIN
  BEGIN
    resolved_role := NULLIF(NEW.raw_user_meta_data->>'role', '')::public.user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    resolved_role := NULL; -- unrecognized/placeholder role (e.g. "pending_assignment")
  END;

  INSERT INTO public.profiles (user_id, role, email, full_name, status, is_active)
  VALUES (
    NEW.id,
    COALESCE(resolved_role, 'student'),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    'pending_setup',
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_auth_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- After running this, retry signup. Then promote your account to super_admin:
--   UPDATE public.profiles SET role = 'super_admin', status = 'active'
--   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
