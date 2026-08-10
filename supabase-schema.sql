-- ============================================================
-- INTERNHUB DATABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql
-- ============================================================

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. UNIVERSITIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  website TEXT,
  domain TEXT,
  primary_color VARCHAR(7) DEFAULT '#3B82F6',
  secondary_color VARCHAR(7) DEFAULT '#1E40AF',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_universities_slug ON public.universities(slug);
CREATE INDEX IF NOT EXISTS idx_universities_status ON public.universities(status);

-- Enable Row Level Security
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active universities
CREATE POLICY "universities_select_public" ON public.universities
  FOR SELECT USING (status = 'active');

-- Policy: Authenticated users can read all universities
CREATE POLICY "universities_select_authenticated" ON public.universities
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);

-- Policy: Super admins can insert/update/delete
CREATE POLICY "universities_manage" ON public.universities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- ============================================================
-- 2. PROFILES TABLE (User Profiles with Roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Info
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  bio TEXT,
  
  -- Role Assignment (CRITICAL - No self-selection!)
  role TEXT DEFAULT 'student' CHECK (role IN (
    'super_admin',
    'university_admin', 
    'department_coordinator',
    'faculty_supervisor',
    'student',
    'company_hr',
    'site_supervisor',
    'external_evaluator'
  )),
  
  -- University/Department Association
  university_id UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  department_id TEXT,
  company_id TEXT,
  
  -- Student Specific
  student_id TEXT,
  enrollment_number TEXT,
  major TEXT,
  gpa DECIMAL(3,2),
  graduation_year INTEGER,
  skills TEXT[] DEFAULT '{}',
  
  -- Professional Links
  linkedin TEXT,
  github TEXT,
  website TEXT,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending_setup')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_university_id ON public.profiles(university_id);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: University admins can view their university's profiles
CREATE POLICY "profiles_select_university_admin" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin 
      WHERE admin.user_id = auth.uid() 
      AND admin.role = 'university_admin'
      AND admin.university_id = profiles.university_id
    )
  );

-- Policy: Super admins can view all profiles
CREATE POLICY "profiles_select_super_admin" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Policy: Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: University admins can update roles within their university
CREATE POLICY "profiles_update_university_admin" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin 
      WHERE admin.user_id = auth.uid() 
      AND admin.role = 'university_admin'
      AND admin.university_id = profiles.university_id
    )
  );

-- Policy: Insert - only super admins and university admins can create profiles
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.role IN ('super_admin', 'university_admin')
    )
  );

-- ============================================================
-- 3. COMPANIES / HOST ORGANIZATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.host_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  website TEXT,
  industry TEXT,
  size TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_host_organizations_slug ON public.host_organizations(slug);

ALTER TABLE public.host_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "host_orgs_public_read" ON public.host_organizations
  FOR SELECT USING (status = 'active');

CREATE POLICY "host_orgs_authenticated" ON public.host_organizations
  FOR ALL USING (auth.role() = 'authenticated');

-- Alias table for convenience
CREATE VIEW public.companies AS SELECT * FROM public.host_organizations;

-- ============================================================
-- 4. INTERNSHIPS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.internships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Company/Organization
  company_id UUID REFERENCES public.host_organizations(id),
  
  -- University (if university-posted)
  university_id UUID REFERENCES public.universities(id),
  
  -- Details
  type TEXT DEFAULT 'full_time' CHECK (type IN ('full_time', 'part_time', 'remote', 'hybrid')),
  duration_weeks INTEGER DEFAULT 8,
  is_paid BOOLEAN DEFAULT FALSE,
  stipend_amount DECIMAL(10,2),
  location TEXT,
  remote_allowed BOOLEAN DEFAULT false,
  
  -- Requirements
  required_skills TEXT[] DEFAULT '{}',
  required_major TEXT[],
  min_gpa DECIMAL(3,2),
  positions_available INTEGER DEFAULT 1,
  
  -- Status & Dates
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'closed', 'completed')),
  start_date DATE,
  end_date DATE,
  application_deadline DATE,
  
  -- Assignments
  student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  faculty_supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  site_supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Progress
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internships_company_id ON public.internships(company_id);
CREATE INDEX IF NOT EXISTS idx_internships_student_id ON public.internships(student_id);
CREATE INDEX IF NOT EXISTS idx_internships_status ON public.internships(status);

ALTER TABLE public.internships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internships_public_active" ON public.internships
  FOR SELECT USING (status = 'active');

CREATE POLICY "internships_all_authenticated" ON public.internhips
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 5. APPLICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  internship_id UUID NOT NULL REFERENCES public.internships(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Application Content
  cover_letter TEXT,
  resume_url TEXT,
  portfolio_url TEXT,
  additional_notes TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'under_review', 'shortlisted', 'accepted', 'rejected', 'withdrawn'
  )),
  
  -- Review
  reviewed_by UUID REFERENCES public.profiles(id),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one application per student per internship
  UNIQUE(internship_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_internship_id ON public.applications(internship_id);
CREATE INDEX IF NOT EXISTS idx_applications_student_id ON public.applications(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications_own" ON public.applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.id = applications.student_id
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = auth.uid() AND p.role IN ('super_admin', 'university_admin', 'company_hr')
    )
  );

-- ============================================================
-- 6. EVALUATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  internship_id UUID REFERENCES public.internships(id) ON DELETE SET NULL,
  evaluator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Evaluation Type
  type TEXT CHECK (type IN ('weekly', 'midterm', 'final', 'company', 'university')),
  week_number INTEGER,
  
  -- Scores (out of 5 or 10)
  technical_skills_score INTEGER CHECK (technical_skills_score BETWEEN 0 AND 10),
  communication_score INTEGER CHECK (communication_score BETWEEN 0 AND 10),
  punctuality_score INTEGER CHECK (punctuality_score BETWEEN 0 AND 10),
  teamwork_score INTEGER CHECK (teamwork_score BETWEEN 0 AND 10),
  problem_solving_score INTEGER CHECK (problem_solving_score BETWEEN 0 AND 10),
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 10),
  
  -- Feedback
  strengths TEXT,
  areas_for_improvement TEXT,
  comments TEXT,
  recommendation TEXT CHECK (recommendation IN ('excellent', 'good', 'satisfactory', 'needs_improvement')),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  
  -- Signature
  evaluator_signature TEXT,
  evaluated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluations_student_id ON public.evaluations(student_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator_id ON public.evaluations(evaluator_id);

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evaluations_relevant_users" ON public.evaluations
  FOR ALL USING (
    student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    evaluator_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================
-- 7. WEEKLY LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weekly_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  internship_id UUID NOT NULL REFERENCES public.internships(id) ON DELETE CASCADE,
  
  week_number INTEGER NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  
  -- Log Content
  tasks_completed TEXT,
  challenges_faced TEXT,
  learnings TEXT,
  goals_for_next_week TEXT,
  hours_worked INTEGER,
  
  -- Supervisor Review
  supervisor_feedback TEXT,
  supervisor_id UUID REFERENCES public.profiles(id),
  approved BOOLEAN,
  reviewed_at TIMESTAMPTZ,
  
  status TEXT DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one log per week per internship
  UNIQUE(internship_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_weekly_logs_student_id ON public.weekly_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_weekly_logs_internship_id ON public.weekly_logs(internship_id);

ALTER TABLE public.weekly_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. DOCUMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  
  -- Document Type
  category TEXT CHECK (category IN (
    'resume', 'cover_letter', 'transcript', 'cnic',
    'offer_letter', 'completion_certificate', 'evaluation_form',
    'weekly_log', 'other'
  )),
  
  -- Associations
  internship_id UUID REFERENCES public.internships(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  
  status TEXT DEFAULT 'verified' CHECK (status IN ('pending', 'verified', 'rejected')),
  
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_own" ON public.documents
  FOR ALL USING (user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('super_admin', 'university_admin'))
  );

-- ============================================================
-- 9. DEPARTMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  head_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_university_id ON public.departments(university_id);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. PLATFORM SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.platform_settings (key, value) VALUES 
  ('global', '{"platform_name": "InternHub", "support_email": "support@internhub.pk", "default_language": "en", "email_notifications": true, "registration_alerts": true, "require_2fa": false, "session_timeout": true, "max_file_size": 10}')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_super_admin" ON public.platform_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================
-- 11. CREATE A SUPER ADMIN USER (Run this manually!)
-- ============================================================
-- Uncomment and modify to create initial super admin:
/*
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Create the auth user first via Supabase Auth, then:
  
  INSERT INTO public.profiles (user_id, full_name, email, role, status)
  VALUES (
    v_user_id,  -- Replace with actual auth UUID
    'Super Admin',
    'admin@internhub.pk',
    'super_admin',
    'active'
  );
END $$;
*/

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
DROP TRIGGER IF EXISTS update_universities_updated_at ON public.universities;
CREATE TRIGGER update_universities_updated_at BEFORE UPDATE ON public.universities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_internships_updated_at ON public.internships;
CREATE TRIGGER update_internships_updated_at BEFORE UPDATE ON public.internships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_host_organizations_updated_at ON public.host_organizations;
CREATE TRIGGER update_host_organizations_updated_at BEFORE UPDATE ON public.host_organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- DONE!
-- ============================================================

-- Verify tables were created
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
