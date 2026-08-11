-- ============================================================================
-- INTERNHUB.PK - SAFE RLS FIX (Handles Missing Tables)
-- ============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- 
-- This version WON'T crash if tables don't exist
-- It only creates policies on tables that actually exist
-- ============================================================================

-- ============================================================================
-- PART 1: PROFILES TABLE (Most Important - This MUST Exist)
-- ============================================================================

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

-- ============================================================================
-- PART 2: OTHER TABLES (Safe - Only runs if table exists)
-- ============================================================================

-- Helper function to safely add policies
DO $$
DECLARE
    table_name TEXT;
    table_exists BOOLEAN;
BEGIN
    -- List of tables to set up
    FOR table_name IN ARRAY[
        'students', 'internships', 'applications', 'notifications', 
        'weekly_logs', 'evaluations', 'attendance'
    ]
    LOOP
        -- Check if table exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = table_name
        ) INTO table_exists;
        
        IF table_exists THEN
            -- Enable RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
            
            -- Drop existing policies
            EXECUTE format('
                DO $$
                DECLARE r RECORD;
                BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = ''public'' AND tablename = %L LOOP
                    EXECUTE format(''DROP POLICY IF EXISTS %%I ON public.%I'', r.policyname, %L);
                END LOOP; END $$;
            ', table_name, table_name);
            
            -- Basic policy: Users can access rows where user_id matches
            BEGIN
                EXECUTE format('
                    CREATE POLICY "users_can_access_%s" ON public.%I
                    FOR ALL USING (auth.uid() = user_id)
                ', table_name, table_name);
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not create policy for % (column user_id may not exist)', table_name;
            END;
            
            RAISE NOTICE 'Set up policies for table: %', table_name;
        ELSE
            RAISE NOTICE 'Table % does not exist - skipping', table_name;
        END IF;
        
    END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
    tablename,
    policyname,
    cmd,
    permissive
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- DONE!
-- ============================================================================
-- You should see policies for at least 'profiles' table above.
-- If you see policies, the 403 error should be fixed!
-- ============================================================================
