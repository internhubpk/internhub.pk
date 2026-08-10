-- ============================================================
-- INTERNHUB: Fix Profile & RLS Issues
-- Run this AFTER the main schema to fix 500 errors
-- ============================================================

-- ============================================================
-- PART 1: Ensure Super Admin has a Profile
-- The RLS policies check for super_admin in profiles table.
-- If no profile exists, queries fail with 500 errors.
-- ============================================================

DO $$
DECLARE
    v_user_id uuid;
    v_exists integer;
BEGIN
    -- Get the first super_admin user from auth.users
    -- (Adjust email if your super admin uses different email)
    SELECT id INTO v_user_id FROM auth.users 
    WHERE email LIKE '%admin%' OR email = 'admin@internhub.pk'
    LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        -- Check if profile already exists
        SELECT COUNT(*) INTO v_exists FROM public.profiles WHERE user_id = v_user_id;
        
        IF v_exists = 0 THEN
            -- Insert super_admin profile
            INSERT INTO public.profiles (
                user_id, 
                role, 
                full_name, 
                email,
                first_name,
                last_name,
                status,
                created_at,
                updated_at
            ) VALUES (
                v_user_id,
                'super_admin',
                'Super Admin',
                (SELECT email FROM auth.users WHERE id = v_user_id),
                'Super',
                'Admin',
                'active',
                NOW(),
                NOW()
            );
            
            RAISE NOTICE 'Created super_admin profile for user: %', v_user_id;
        ELSE
            RAISE NOTICE 'super_admin profile already exists for user: %', v_user_id;
        END IF;
    ELSE
        RAISE NOTICE 'No super_admin user found in auth.users';
    END IF;
END $$;

-- ============================================================
-- PART 2: Fix Universities RLS Policy for NULL status
-- Existing records may have NULL status, blocking reads
-- ============================================================

-- Drop existing "Anyone can view" policy if it exists
DROP POLICY IF EXISTS "Anyone can view universities" ON public.universities;

-- Recreate with NULL handling (NULL is treated as active for backwards compat)
CREATE POLICY "Anyone can view universities" ON public.universities
    FOR SELECT USING (status = 'active' OR status IS NULL);

-- Also ensure super_admin can see ALL universities (not just by university_id)
DROP POLICY IF EXISTS "Super admin full access universities" ON public.universities;

CREATE POLICY "Super admin full access universities" ON public.universities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================================
-- PART 3: Fix Profiles RLS - Ensure users can always read own profile
-- ============================================================

-- Ensure the "own profile" policy exists and works
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- PART 4: Update any NULL statuses in universities to 'active'
-- ============================================================

UPDATE public.universities
SET status = 'active', updated_at = NOW()
WHERE status IS NULL;

-- ============================================================
-- Verification Queries (run these to verify fixes)
-- ============================================================

-- Check if super_admin profile exists:
-- SELECT * FROM public.profiles WHERE role = 'super_admin';

-- Check universities are accessible:
-- SELECT id, name, status FROM public.universities LIMIT 5;

-- Check profiles count:
-- SELECT COUNT(*), role FROM public.profiles GROUP BY role;
