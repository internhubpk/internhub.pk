-- ============================================
-- InternHub Production RLS Policies
-- Run this in Supabase SQL Editor or via CLI
-- ============================================

-- ============================================
-- 1. PROFILES TABLE - RLS Policies
-- ============================================

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can select profiles" ON profiles;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can read their OWN profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert their OWN profile (on signup/registration)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their OWN profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Super admins can read ALL profiles
CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Policy 5: Super admins can update ANY profile
CREATE POLICY "Super admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );


-- ============================================
-- 2. NOTIFICATIONS TABLE - RLS Policies
-- ============================================

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'announcement' CHECK (type IN ('announcement', 'reminder', 'alert', 'system', 'task', 'evaluation')),
  category TEXT DEFAULT 'notification',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sender_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Senders can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Super admins can manage notifications" ON notifications;

-- Policy 1: Users can read their OWN notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can mark their OWN notifications as read (update)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Faculty supervisors, coordinators, and admins can INSERT notifications (send to students)
CREATE POLICY "Staff can send notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    -- The sender is inserting on behalf of recipients (user_id is recipient)
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('faculty_supervisor', 'department_coordinator', 'university_admin', 'super_admin')
    )
  );

-- Policy 4: Super admins can do anything with notifications
CREATE POLICY "Super admins can manage all notifications"
  ON notifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );


-- ============================================
-- 3. UNIVERSITIES TABLE - RLS (if exists)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'universities') THEN
    ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Anyone can view universities" ON universities;
    DROP POLICY IF EXISTS "Admins can manage universities" ON universities;
    
    -- Public read access for university info
    CREATE POLICY "Anyone can view universities"
      ON universities FOR SELECT
      USING (true);
      
    -- Only super admins can modify
    CREATE POLICY "Super admins can manage universities"
      ON universities FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE user_id = auth.uid() 
          AND role = 'super_admin'
        )
      );
  END IF;
END $$;


-- ============================================
-- 4. STUDENTS TABLE - RLS (if exists)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'students') THEN
    ALTER TABLE students ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Students can view own record" ON students;
    DROP POLICY IF EXISTS "Faculty can view supervised students" ON students;
    DROP POLICY IF EXISTS "Admins can view all students" ON students;
    
    -- Students can see their own record
    CREATE POLICY "Students can view own record"
      ON students FOR SELECT
      USING (auth.uid() = user_id);
    
    -- Faculty supervisors can see students in their programs
    CREATE POLICY "Faculty can view supervised students"
      ON students FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM supervisors 
          WHERE supervisors.user_id = auth.uid()
          AND supervisors.type = 'faculty'
          AND students.program_id = ANY(supervisors.program_ids)
        )
      );
    
    -- Admins can see all students
    CREATE POLICY "Admins can view all students"
      ON students FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE user_id = auth.uid() 
          AND role IN ('university_admin', 'department_coordinator', 'super_admin')
        )
      );
  END IF;
END $$;


-- ============================================
-- 5. HELPER FUNCTION: Get current user role
-- ============================================

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE;


-- ============================================
-- VERIFICATION QUERIES
-- Run these to verify policies are working
-- ============================================

-- Check RLS status on tables
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'notifications');

-- Check policies on profiles
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'profiles';

-- Check policies on notifications  
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'notifications';
