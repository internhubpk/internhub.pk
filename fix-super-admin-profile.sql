-- ============================================================
-- FIX: Create Super Admin Profile (Run this in Supabase SQL Editor)
-- This fixes the 500 error on /profiles endpoint
-- ============================================================

-- Step 1: Insert super_admin profile for YOUR user ID
-- Replace the UUID below if needed, or run as-is to auto-detect

INSERT INTO public.profiles (user_id, role, full_name, email, first_name, last_name, status, created_at, updated_at)
SELECT 
    id,
    'super_admin',
    'Super Admin',
    email,
    'Super',
    'Admin',
    'active',
    NOW(),
    NOW()
FROM auth.users
WHERE id = 'a460a881-c974-4cb0-9950-3658845fe39f'
ON CONFLICT (user_id) DO UPDATE SET
    role = 'super_admin',
    full_name = 'Super Admin',
    email = EXCLUDED.email,
    status = 'active',
    updated_at = NOW();

-- Step 2: Verify it was created
SELECT user_id, role, full_name, email, status FROM public.profiles WHERE user_id = 'a460a881-c974-4cb0-9950-3658845fe39f';

-- ============================================================
-- If above doesn't work, try this alternative for ANY admin user:
-- ============================================================
/*
INSERT INTO public.profiles (user_id, role, full_name, email, first_name, last_name, status, created_at, updated_at)
SELECT 
    id,
    'super_admin',
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', 'Super Admin'),
    email,
    COALESCE(raw_user_meta_data->>'first_name', 'Super'),
    COALESCE(raw_user_meta_data->>'last_name', 'Admin'),
    'active',
    NOW(),
    NOW()
FROM auth.users
WHERE email LIKE '%admin%' OR email LIKE '%super%'
ON CONFLICT (user_id) DO NOTHING;
*/
