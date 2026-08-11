-- ============================================================================
-- INTERNHUB.PK - COMPLETE DATABASE SCHEMA
-- ============================================================================
-- This script sets up the complete database schema for InternHub.pk
-- Run this in your Supabase SQL Editor before using the application
-- ============================================================================

-- ============================================================================
-- PHASE 0: Enable necessary extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PHASE 1: ENUM TYPES
-- ============================================================================
CREATE TYPE public.user_role AS ENUM (
  'super_admin',
  'university_admin', 
  'department_coordinator',
  'faculty_supervisor',
  'student',
  'company_hr',
  'site_supervisor',
  'external_evaluator'
);

CREATE TYPE public.internship_status AS ENUM (
  'draft', 'open', 'active', 'completed', 'cancelled', 'expired'
);

CREATE TYPE public.application_status AS ENUM (
  'pending', 'reviewing', 'accepted', 'rejected', 'withdrawn'
);

CREATE TYPE public.evaluation_type AS ENUM (
  'weekly_log', 'midterm', 'final', 
  'company_evaluation', 'supervisor_evaluation'
);

CREATE TYPE public.evaluation_status AS ENUM (
  'pending', 'in_progress', 'submitted', 'approved', 'rejected'
);

CREATE TYPE public.weekly_log_status AS ENUM (
  'draft', 'submitted', 'approved', 'rejected', 'revision_required'
);

CREATE TYPE public.document_type AS ENUM (
  'resume', 'cover_letter', 'transcript', 'offer_letter',
  'weekly_report', 'evaluation_form', 'certificate', 'other'
);

CREATE TYPE public.document_status AS ENUM (
  'pending', 'verified', 'rejected', 'expired'
);

CREATE TYPE public.attendance_status AS ENUM (
  'present', 'absent', 'late', 'half_day', 'leave', 'holiday'
);

CREATE TYPE public.message_type AS ENUM (
  'direct', 'announcement', 'notification', 'system'
);

CREATE TYPE public.notification_category AS ENUM (
  'auth', 'application', 'evaluation', 'deadline', 'system', 'announcement'
);

CREATE TYPE public.notification_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE public.license_tier AS ENUM ('free', 'professional', 'enterprise');

-- ============================================================================
-- PHASE 2: CORE TABLES
-- ============================================================================

-- Universities table
CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  domain TEXT,
  address TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  license_tier public.license_tier DEFAULT 'free',
  license_expires_at TIMESTAMPTZ,
  max_students INTEGER,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_universities_slug ON public.universities(slug);
CREATE INDEX idx_universities_active ON public.universities(is_active);

-- Departments table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  head_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_departments_university ON public.departments(university_id);
CREATE INDEX idx_departments_head ON public.departments(head_id);

-- Programs table
CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  description TEXT,
  duration_weeks INTEGER DEFAULT 8,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_programs_department ON public.programs(department_id);
CREATE INDEX idx_programs_code ON public.programs(code);

-- Companies / Host Organizations
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  industry TEXT,
  website TEXT,
  size TEXT, -- small, medium, large, enterprise
  description TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  contact_person TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  university_id UUID REFERENCES public.universities(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_companies_slug ON public.companies(slug);
CREATE INDEX idx_companies_active ON public.companies(is_active);

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  role public.user_role DEFAULT 'student',
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  username TEXT UNIQUE,
  university_id UUID REFERENCES public.universities(id),
  department_id UUID REFERENCES public.departments(id),
  company_id UUID REFERENCES public.companies(id),
  status TEXT DEFAULT 'pending_setup',
  is_active BOOLEAN DEFAULT true,
  student_id UUID,
  company_name TEXT,
  job_title TEXT,
  organization TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_university ON public.profiles(university_id);
CREATE INDEX idx_profiles_department ON public.profiles(department_id);
CREATE INDEX idx_profiles_company ON public.profiles(company_id);
CREATE INDEX idx_profiles_student ON public.profiles(student_id);

-- Students table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES public.universities(id),
  department_id UUID NOT NULL REFERENCES public.departments(id),
  program_id UUID REFERENCES public.programs(id),
  enrollment_number TEXT UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  gpa NUMERIC(3, 2),
  graduation_year INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'suspended', 'withdrawn')),
  supervisor_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_students_user ON public.students(user_id);
CREATE INDEX idx_students_university ON public.students(university_id);
CREATE INDEX idx_students_department ON public.students(department_id);
CREATE INDEX idx_students_program ON public.students(program_id);
CREATE INDEX idx_students_enrollment ON public.students(enrollment_number);

-- Supervisors table (both faculty and site)
CREATE TABLE IF NOT EXISTS public.supervisors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('faculty', 'site')),
  university_id UUID REFERENCES public.universities(id),
  department_id UUID REFERENCES public.departments(id),
  company_id UUID REFERENCES public.companies(id),
  program_ids UUID[] DEFAULT '{}',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  title TEXT,
  specialization TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_supervisors_user ON public.supervisors(user_id);
CREATE INDEX idx_supervisors_type ON public.supervisors(type);
CREATE INDEX idx_supervisors_department ON public.supervisors(department_id);
CREATE INDEX idx_supervisors_company ON public.supervisors(company_id);
CREATE INDEX idx_supervisors_programs ON public.supervisors USING gin(program_ids);

-- ============================================================================
-- PHASE 3: INTERNSHIP-RELATED TABLES
-- ============================================================================

-- Internships (posted by companies)
CREATE TABLE IF NOT EXISTS public.internships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_name TEXT,
  university_id UUID REFERENCES public.universities(id),
  department_ids UUID[] DEFAULT '{}',
  location TEXT,
  remote BOOLEAN DEFAULT false,
  is_paid BOOLEAN DEFAULT false,
  stipend NUMERIC(10, 2),
  stipend_currency TEXT DEFAULT 'PKR',
  duration_weeks INTEGER NOT NULL,
  status public.internship_status DEFAULT 'draft',
  required_skills TEXT[] DEFAULT '{}',
  requirements TEXT[] DEFAULT '{}',
  benefits TEXT[] DEFAULT '{}',
  max_applicants INTEGER,
  current_applicants INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  application_deadline DATE,
  created_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_internships_company ON public.internships(company_id);
CREATE INDEX idx_internships_status ON public.internships(status);
CREATE INDEX idx_internships_departments ON public.internships USING gin(department_ids);

-- Internship Applications
CREATE TABLE IF NOT EXISTS public.internship_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  internship_id UUID NOT NULL REFERENCES public.internships(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_name TEXT,
  student_email TEXT,
  cover_letter TEXT,
  resume_url TEXT,
  status public.application_status DEFAULT 'pending',
  applied_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  UNIQUE(internship_id, student_id)
);

CREATE INDEX idx_applications_internship ON public.internship_applications(internship_id);
CREATE INDEX idx_applications_student ON public.internship_applications(student_id);
CREATE INDEX idx_applications_status ON public.internship_applications(status);

-- Student Internships (accepted applications become active internships)
CREATE TABLE IF NOT EXISTS public.student_internships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  internship_id UUID NOT NULL REFERENCES public.internships(id) ON DELETE CASCADE,
  site_supervisor_id UUID REFERENCES public.supervisors(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated', 'on_hold', 'cancelled')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  offer_letter_url TEXT,
  certificate_url TEXT,
  final_grade TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_student_internships_student ON public.student_internships(student_id);
CREATE INDEX idx_student_internships_internship ON public.student_internships(internship_id);
CREATE INDEX idx_student_internships_supervisor ON public.student_internships(site_supervisor_id);

-- Tasks (created by faculty supervisors)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT, -- Markdown supported
  creator_id UUID NOT NULL REFERENCES public.profiles(user_id),
  program_id UUID REFERENCES public.programs(id),
  due_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'assigned' CHECK (status IN ('draft', 'assigned', 'in_progress', 'completed', 'overdue', 'cancelled')),
  attachment_url TEXT,
  max_score INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tasks_creator ON public.tasks(creator_id);
CREATE INDEX idx_tasks_program ON public.tasks(program_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due ON public.tasks(due_date);

-- Task Assignments (link tasks to students)
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'graded', 'exempted')),
  submitted_at TIMESTAMPTZ,
  grade NUMERIC(5, 2),
  feedback TEXT,
  UNIQUE(task_id, student_id)
);

CREATE INDEX idx_assignments_task ON public.task_assignments(task_id);
CREATE INDEX idx_assignments_student ON public.task_assignments(student_id);

-- Task Submissions
CREATE TABLE IF NOT EXISTS public.task_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_assignment_id UUID NOT NULL REFERENCES public.task_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id),
  notes TEXT, -- Markdown supported
  submission_url TEXT, -- GitHub repo, demo link
  attachment_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_submissions_assignment ON public.task_submissions(task_assignment_id);
CREATE INDEX idx_submissions_student ON public.task_submissions(student_id);

-- ============================================================================
-- PHASE 4: EVALUATION & REPORTING TABLES
-- ============================================================================

-- Evaluations
CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type public.evaluation_type NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_internship_id UUID REFERENCES public.student_internships(id) ON DELETE SET NULL,
  evaluator_id UUID NOT NULL REFERENCES auth.users(id),
  evaluator_role public.user_role NOT NULL,
  status public.evaluation_status DEFAULT 'pending',
  
  -- Scoring fields (for structured evaluations)
  scores JSONB DEFAULT '{}', -- { "criteria": score }
  overall_rating INTEGER CHECK (overall_rating >= 0 AND overall_rating <= 100),
  
  -- Comments (Markdown supported)
  comments TEXT,
  feedback_for_student TEXT,
  strengths TEXT,
  areas_for_improvement TEXT,
  recommendations TEXT,
  decision TEXT CHECK (decision IN ('satisfactory', 'needs_improvement', 'unsatisfactory')),
  
  -- Signature
  signature_image TEXT, -- Base64 encoded
  
  -- Period info
  evaluation_period_start DATE,
  evaluation_period_end DATE,
  
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  version INTEGER DEFAULT 1
);

CREATE INDEX idx_evaluations_student ON public.evaluations(student_id);
CREATE INDEX idx_evaluations_internship ON public.evaluations(student_internship_id);
CREATE INDEX idx_evaluations_evaluator ON public.evaluations(evaluator_id);
CREATE INDEX idx_evaluations_type ON public.evaluations(type);
CREATE INDEX idx_evaluations_status ON public.evaluations(status);

-- Weekly Logs
CREATE TABLE IF NOT EXISTS public.weekly_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_internship_id UUID NOT NULL REFERENCES public.student_internships(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  tasks_completed TEXT[] DEFAULT '{}',
  challenges TEXT,
  learnings TEXT,
  next_week_goals TEXT,
  hours_worked NUMERIC(5, 2),
  status public.weekly_log_status DEFAULT 'draft',
  supervisor_feedback TEXT,
  supervisor_id UUID REFERENCES public.supervisors(id),
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_internship_id, week_number)
);

CREATE INDEX idx_weekly_logs_student ON public.weekly_logs(student_id);
CREATE INDEX idx_weekly_logs_internship ON public.weekly_logs(student_internship_id);
CREATE INDEX idx_weekly_logs_status ON public.weekly_logs(status);

-- Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('summary', 'detailed', 'analytics', 'custom')),
  format TEXT DEFAULT 'pdf' CHECK (format IN ('pdf', 'csv', 'excel')),
  parameters JSONB DEFAULT '{}',
  generated_by UUID REFERENCES public.profiles(user_id),
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Attendance Records
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_internship_id UUID NOT NULL REFERENCES public.student_internships(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status public.attendance_status DEFAULT 'present',
  notes TEXT,
  location_lat NUMERIC(10, 6),
  location_lng NUMERIC(10, 6),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_internship_id, date)
);

CREATE INDEX idx_attendance_student ON public.attendance(student_id);
CREATE INDEX idx_attendance_internship ON public.attendance(student_internship_id);
CREATE INDEX idx_attendance_date ON public.attendance(date);

-- Certificates
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_internship_id UUID NOT NULL REFERENCES public.student_internships(id) ON DELETE CASCADE,
  certificate_number TEXT UNIQUE,
  issue_date DATE NOT NULL,
  file_url TEXT NOT NULL,
  template_type TEXT DEFAULT 'standard',
  issued_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_certificates_student ON public.certificates(student_id);
CREATE INDEX idx_certificates_number ON public.certificates(certificate_number);

-- ============================================================================
-- PHASE 5: COMMUNICATION & NOTIFICATION TABLES
-- ============================================================================

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category public.notification_category DEFAULT 'system',
  priority public.notification_priority DEFAULT 'medium',
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  sender_id UUID REFERENCES auth.users(id), -- Null for system notifications
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

-- Messages/Communications
CREATE TABLE IF NOT EXISTS public.communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Null for announcements
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  type public.message_type DEFAULT 'direct',
  is_read BOOLEAN DEFAULT false,
  thread_id UUID,
  attachments TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_communications_sender ON public.communications(sender_id);
CREATE INDEX idx_communications_receiver ON public.communications(receiver_id);
CREATE INDEX idx_communications_thread ON public.communications(thread_id);

-- ============================================================================
-- PHASE 6: DOCUMENT STORAGE & AUDIT
-- ============================================================================

-- Documents (general purpose)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type public.document_type NOT NULL,
  url TEXT NOT NULL,
  size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('student', 'internship', 'application', 'evaluation', 'user')),
  entity_id UUID NOT NULL,
  status public.document_status DEFAULT 'pending',
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_documents_entity ON public.documents(entity_type, entity_id);
CREATE INDEX idx_documents_uploader ON public.documents(uploaded_by);
CREATE INDEX idx_documents_type ON public.documents(type);

-- Audit Log
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Platform Settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PHASE 7: AUTH TRIGGER - Handle new user signup
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  resolved_role public.user_role;
BEGIN
  BEGIN
    resolved_role := NULLIF(NEW.raw_user_meta_data->>'role', '')::public.user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    resolved_role := NULL; -- unrecognized/placeholder role
  END;

  INSERT INTO public.profiles (user_id, role, email, full_name, status, is_active)
  VALUES (
    NEW.id,
    COALESCE(resolved_role, 'student'),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    'pending_setup',
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_auth_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- PHASE 8: HELPER FUNCTIONS FOR RLS POLICIES
-- ============================================================================

-- Get current user's university ID
CREATE OR REPLACE FUNCTION public.get_user_university_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT university_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Get current user's department ID
CREATE OR REPLACE FUNCTION public.get_user_department_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Get current user's company ID
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Role check helper
CREATE OR REPLACE FUNCTION public.current_role_is(p_role public.user_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_user_role() = p_role;
$$;

-- ============================================================================
-- PHASE 9: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internship_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_internships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Super Admin can do everything
CREATE POLICY "super_admin_full_access" ON public.universities
  FOR ALL USING (public.current_role_is('super_admin'));

CREATE POLICY "super_admin_full_access" ON public.companies
  FOR ALL USING (public.current_role_is('super_admin'));

CREATE POLICY "super_admin_full_access" ON public.profiles
  FOR ALL USING (public.current_role_is('super_admin'));

CREATE POLICY "super_admin_full_access" ON public.students
  FOR ALL USING (public.current_role_is('super_admin'));

CREATE POLICY "super_admin_full_access" ON public.supervisors
  FOR ALL USING (public.current_role_is('super_admin'));

-- University Admin policies (scoped to their university)
CREATE POLICY "university_admin_universities" ON public.universities
  FOR ALL USING (
    public.current_role_is('university_admin') 
    AND id = public.get_user_university_id()
  );

CREATE POLICY "university_admin_departments" ON public.departments
  FOR ALL USING (
    public.current_role_is('university_admin')
    AND university_id = public.get_user_university_id()
  );

CREATE POLICY "university_admin_students_read" ON public.students
  FOR SELECT USING (
    public.current_role_is('university_admin')
    AND university_id = public.get_user_university_id()
  );

-- Department Coordinator policies (scoped to their department)
CREATE POLICY "coordinator_departments" ON public.departments
  FOR ALL USING (
    public.current_role_is('department_coordinator')
    AND id = public.get_user_department_id()
  );

CREATE POLICY "coordinator_programs" ON public.programs
  FOR ALL USING (
    public.current_role_is('department_coordinator')
    AND department_id = public.get_user_department_id()
  );

CREATE POLICY "coordinator_students" ON public.students
  FOR ALL USING (
    public.current_role_is('department_coordinator')
    AND university_id = public.get_user_university_id()
    AND department_id = public.get_user_department_id()
  );

-- Student policies (own data only)
CREATE POLICY "students_own_data" ON public.students
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "student_task_submissions" ON public.task_submissions
  FOR ALL USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE POLICY "student_attendance" ON public.attendance
  FOR ALL USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE POLICY "student_notifications" ON public.notifications
  FOR ALL USING (user_id = auth.uid());

-- Company HR policies (scoped to their company)
CREATE POLICY "company_hr_internships" ON public.internships
  FOR ALL USING (
    public.current_role_is('company_hr')
    AND company_id = public.get_user_company_id()
  );

CREATE POLICY "company_hr_applications" ON public.internship_applications
  FOR ALL USING (
    public.current_role_is('company_hr')
    AND internship_id IN (SELECT id FROM public.internships WHERE company_id = public.get_user_company_id())
  );

-- Public read access for active internships (marketplace)
CREATE POLICY "internships_public_read" ON public.internships
  FOR SELECT USING (is_active = true AND status IN ('published', 'active', 'open'));

-- Users can always update their own profile
CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Everyone can read profiles (basic visibility)
CREATE POLICY "profiles_readable" ON public.profiles
  FOR SELECT USING (true);

-- ============================================================================
-- DONE!
-- ============================================================================
-- Verify setup:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
