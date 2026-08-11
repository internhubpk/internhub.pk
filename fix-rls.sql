-- ============================================================================
-- FIX RLS PERMISSIONS - Run this in Supabase SQL Editor
-- ============================================================================
-- This fixes "permission denied for schema public" errors
-- Ensures authenticated users can read their own data

-- 1. DROP existing restrictive policies and recreate them properly

-- Drop old policies if they exist (ignore errors if they don't)
DROP POLICY IF EXISTS "profiles_readable" ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;

-- 2. Create CORRECT policies that allow authenticated users to read their OWN profile

-- Policy: All authenticated users can read their own profile
CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can update their own profile
CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Super admins can do everything on profiles
CREATE POLICY "super_admin_profiles" ON public.profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- 3. Fix other tables with similar issues

-- Students table - read own data
DROP POLICY IF EXISTS "students_own_data" ON public.students;
CREATE POLICY "students_own_data" ON public.students
  FOR ALL USING (user_id IN (SELECT user_id FROM public.profiles WHERE user_id = auth.uid()));

-- OR more permissive: allow if user is student role or super_admin
CREATE POLICY "students_accessible" ON public.students
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role IN ('student', 'super_admin', 'university_admin', 'department_coordinator', 'faculty_supervisor'))
    OR user_id = auth.uid()
  );

-- Notifications - users can read their own
DROP POLICY IF EXISTS "student_notifications" ON public.notifications;
CREATE POLICY "users_read_own_notifications" ON public.notifications
  FOR ALL USING (user_id = auth.uid());

-- 4. Verify the policies are correct
-- Run this to check:
-- SELECT tablename, policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public' AND tablename = 'profiles';

-- ============================================================================
-- DONE! Test by logging in again.
-- The "permission denied for schema public" error should be fixed.
-- ============================================================================
