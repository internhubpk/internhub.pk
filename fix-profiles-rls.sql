-- ============================================================================
-- INTERNHUB.PK - MINIMAL RLS FIX (Copy-Paste Ready)
-- ============================================================================
-- 
-- STEP 1: Go to Supabase Dashboard → SQL Editor
-- STEP 2: Click "New Query"
-- STEP 3: Paste ONLY the code below this line
-- STEP 4: Click "Run"
--
-- This ONLY fixes the profiles table which causes the 403 error.
-- It's safe to run multiple times.
-- ============================================================================

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove any existing policies on profiles
DROP POLICY IF EXISTS "users_can_read_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON public.profiles;

-- Create policy: Users can read their own profile
CREATE POLICY "users_can_read_own_profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Create policy: Users can update their own profile
CREATE POLICY "users_can_update_own_profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can insert their own profile
CREATE POLICY "users_can_insert_own_profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- DONE! 
-- ============================================================================
-- You should see "Success. No rows returned" message.
-- Now clear your browser cookies and try logging in again.
-- ============================================================================
