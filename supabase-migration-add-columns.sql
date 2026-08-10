-- ============================================================
-- INTERNHUB: MIGRATION - ADD MISSING COLUMNS
-- Run this AFTER your main schema to add columns the app needs
-- ============================================================

-- ============================================================
-- 1. UNIVERSITIES TABLE - Add missing columns
-- ============================================================

-- Add slug column (for URL-friendly identifiers)
ALTER TABLE public.universities 
ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Add description column
ALTER TABLE public.universities 
ADD COLUMN IF NOT EXISTS description text;

-- Add website column
ALTER TABLE public.universities 
ADD COLUMN IF NOT EXISTS website text;

-- Add status column (active/inactive/suspended)
ALTER TABLE public.universities 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add created_by column (references profiles.user_id)
ALTER TABLE public.universities 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- Add updated_at timestamp
ALTER TABLE public.universities 
ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Add primary_color for theming
ALTER TABLE public.universities 
ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#3B82F6';

-- Add secondary_color for theming
ALTER TABLE public.universities 
ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#10B981';

-- Create index on slug for lookups
CREATE INDEX IF NOT EXISTS idx_universities_slug ON public.universities(slug);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_universities_status ON public.universities(status);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for universities updated_at
DROP TRIGGER IF EXISTS update_universities_updated_at ON public.universities;
CREATE TRIGGER update_universities_updated_at
    BEFORE UPDATE ON public.universities
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. PROFILES TABLE - Add missing columns
-- ============================================================

-- Add id as separate surrogate key (user_id stays as natural key to auth.users)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS id uuid PRIMARY KEY DEFAULT uuid_generate_v4();

-- NOTE: If the above fails because user_id is already the PRIMARY KEY, 
-- we need a different approach. In that case, use this instead:

-- If you get error "multiple primary keys", run these commands:
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
-- ALTER TABLE public.profiles ADD PRIMARY KEY (id);
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Add email column (cached from auth.users for easier queries)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email text;

-- Add first_name column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name text;

-- Add last_name column  
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_name text;

-- Add phone column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text;

-- Add bio column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bio text;

-- Add status column (active/inactive/suspended/pending_setup)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add avatar_url column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add updated_at timestamp
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles(full_name);

-- Trigger for profiles updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. PLATFORM SETTINGS TABLE (if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL DEFAULT '{}',
    updated_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 4. Create function to sync email from auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
    -- When a profile is inserted/updated, sync email from auth.users if not provided
    IF NEW.email IS NULL AND NEW.user_id IS NOT NULL THEN
        SELECT raw_user_meta_data->>'email' INTO NEW.email
        FROM auth.users
        WHERE id = NEW.user_id;
    END IF;
    
    -- Auto-generate full_name from first + last if full_name is null
    IF NEW.full_name IS NULL AND (NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL) THEN
        NEW.full_name = COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '');
        NEW.full_name = TRIM(NEW.full_name);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINer;

-- Trigger to auto-sync email and generate full_name
DROP TRIGGER IF EXISTS sync_profile_fields ON public.profiles;
CREATE TRIGGER sync_profile_fields
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_email();

-- ============================================================
-- 5. Update RLS policies to use new id column
-- ============================================================

-- Note: The existing policies use user_id which is fine for auth checks.
-- The new `id` column is for application-level references.

-- ============================================================
-- VERIFICATION QUERIES (run these to verify)
-- ============================================================

-- Check universities table structure
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'universities' 
-- ORDER BY ordinal_position;

-- Check profiles table structure
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' 
-- ORDER BY ordinal_position;
