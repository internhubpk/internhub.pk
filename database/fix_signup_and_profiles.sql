-- ============================================================================
-- FIX: Add missing role + Auto-create profile trigger
-- Run this AFTER the main schema
-- ============================================================================

BEGIN;

-- 1. Add missing role to enum
ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'pending_assignment';

-- 2. Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Get role from user metadata or default to pending_assignment
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_user_meta_data->>'user_role',
    'pending_assignment'
  );
  
  -- Insert profile for new user
  INSERT INTO profiles (
    user_id, 
    email, 
    full_name, 
    first_name,
    last_name,
    role,
    is_active
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'first_name'),
    COALESCE(NEW.raw_user_meta_data->>'last_name'),
    v_role::user_role_type,
    true
  ) ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Fix existing users who don't have profiles
INSERT INTO profiles (user_id, email, full_name, role, is_active)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email),
  COALESCE(raw_user_meta_data->>'role', 'student')::user_role_type,
  true
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.user_id = au.id
);

COMMIT;

-- Verification queries:
-- SELECT * FROM profiles WHERE user_id = auth.uid();
-- SELECT count(*) FROM profiles;
