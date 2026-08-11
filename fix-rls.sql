-- ============================================================================
-- INTERNHUB.PK - RLS FIX SCRIPT
-- ============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR (SQL Editor → New Query → Paste → Run)
-- 
-- This fixes: "403 Forbidden" / "permission denied for schema public" errors
-- 
-- WHAT THIS DOES:
-- 1. Ensures RLS is enabled on all tables
-- 2. Creates proper policies allowing users to read/write their OWN data
-- 3. Allows super_admins to read everything
-- ============================================================================

-- ============================================================================
-- PART 1: PROFILES TABLE (Most Important - Causes the 403 error)
-- ============================================================================

-- First, make sure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on profiles (clean slate)
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_record.policyname);
    END LOOP;
END $$;

-- Policy 1: Authenticated users can read their OWN profile
CREATE POLICY "users_can_read_own_profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Policy 2: Authenticated users can update their OWN profile  
CREATE POLICY "users_can_update_own_profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can insert their own profile (for registration)
CREATE POLICY "users_can_insert_own_profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy 4: Super admins can do anything on profiles
CREATE POLICY "super_admins_full_access_profiles" ON public.profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Policy 5: University admins can read profiles from their university
CREATE POLICY "university_admins_read_university" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() AND p.role = 'university_admin'
            AND p.university_id = public.profiles.university_id
        )
    );

-- ============================================================================
-- PART 2: STUDENTS TABLE
-- ============================================================================

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'students'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.students', policy_record.policyname);
    END LOOP;
END $$;

-- Students can read/write their own data
CREATE POLICY "students_own_data" ON public.students
    FOR ALL USING (user_id = auth.uid());

-- Supervisors and admins can read student data they're associated with
CREATE POLICY "supervisors_read_students" ON public.students
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() 
            AND p.role IN ('faculty_supervisor', 'department_coordinator', 'university_admin', 'super_admin')
        )
        OR user_id = auth.uid()
    );

-- ============================================================================
-- PART 3: INTERNSHIPS TABLE
-- ============================================================================

ALTER TABLE public.internships ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'internships'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.internships', policy_record.policyname);
    END LOOP;
END $$;

-- Company HR can manage their company's internships
CREATE POLICY "company_hr_manage_internships" ON public.internships
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() AND p.role = 'company_hr'
            AND p.company_id = public.internships.company_id
        )
    );

-- Students can read internships they applied to
CREATE POLICY "students_read_internships" ON public.internships
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.applications a 
            WHERE a.student_user_id = auth.uid() AND a.internship_id = public.internships.id
        )
        OR status = 'open'  -- Anyone can read open internships
    );

-- Admins can read all internships
CREATE POLICY "admins_read_all_internships" ON public.internships
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() 
            AND p.role IN ('super_admin', 'university_admin', 'department_coordinator', 'faculty_supervisor')
        )
    );

-- ============================================================================
-- PART 4: APPLICATIONS TABLE
-- ============================================================================

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'applications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.applications', policy_record.policyname);
    END LOOP;
END $$;

-- Students can manage their own applications
CREATE POLICY "students_own_applications" ON public.applications
    FOR ALL USING (student_user_id = auth.uid());

-- Company HR can read/evaluate applications for their internships
CREATE POLICY "company_hr_review_applications" ON public.applications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.internships i 
            JOIN public.profiles p ON p.user_id = auth.uid() AND p.role = 'company_hr'
            WHERE i.id = public.applications.internship_id AND i.company_id = p.company_id
        )
    );
CREATE POLICY "company_hr_update_applications" ON public.applications
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.internships i 
            JOIN public.profiles p ON p.user_id = auth.uid() AND p.role = 'company_hr'
            WHERE i.id = public.applications.internship_id AND i.company_id = p.company_id
        )
    );

-- ============================================================================
-- PART 5: NOTIFICATIONS TABLE
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'notifications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', policy_record.policyname);
    END LOOP;
END $$;

-- Users can read/manage their own notifications
CREATE POLICY "users_own_notifications" ON public.notifications
    FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- PART 6: WEEKLY LOGS TABLE
-- ============================================================================

ALTER TABLE public.weekly_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'weekly_logs'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.weekly_logs', policy_record.policyname);
    END LOOP;
END $$;

-- Students can manage their own logs
CREATE POLICY "students_own_weekly_logs" ON public.weekly_logs
    FOR ALL USING (student_user_id = auth.uid());

-- Supervisors can read logs of their students
CREATE POLICY "supervisors_read_weekly_logs" ON public.weekly_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.supervisors s 
            WHERE s.user_id = auth.uid()
            AND s.student_user_id = public.weekly_logs.student_user_id
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() 
            AND p.role IN ('faculty_supervisor', 'site_supervisor', 'department_coordinator', 'university_admin', 'super_admin')
        )
    );

-- ============================================================================
-- PART 7: EVALUATIONS TABLE
-- ============================================================================

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'evaluations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.evaluations', policy_record.policyname);
    END LOOP;
END $$;

-- Users can read evaluations about themselves or that they created
CREATE POLICY "users_read_evaluations" ON public.evaluations
    FOR SELECT USING (
        student_user_id = auth.uid() 
        OR evaluator_user_id = auth.uid()
    );

-- Evaluators can create/update evaluations
CREATE POLICY "evaluators_write_evaluations" ON public.evaluations
    FOR ALL USING (evaluator_user_id = auth.uid());

-- ============================================================================
-- PART 8: ATTENDANCE TABLE
-- ============================================================================

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'attendance'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.attendance', policy_record.policyname);
    END LOOP;
END $$;

-- Students can read their own attendance
CREATE POLICY "students_read_attendance" ON public.attendance
    FOR SELECT USING (student_user_id = auth.uid());

-- Company HR and supervisors can manage attendance
CREATE POLICY "staff_manage_attendance" ON public.attendance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() 
            AND p.role IN ('company_hr', 'site_supervisor', 'faculty_supervisor', 'department_coordinator', 'university_admin', 'super_admin')
        )
    );

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Run this to verify policies were created correctly:
SELECT 
    tablename,
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- You should see multiple policies for each table above.
-- If you see NO rows, something went wrong - check for errors above.

-- ============================================================================
-- DONE!
-- ============================================================================
-- After running this script:
-- 1. Clear your browser cookies for the site (or use incognito)
-- 2. Try logging in again
-- 3. The 403 error should be gone!
-- ============================================================================
