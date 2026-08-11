-- ============================================================================
-- INTERNHUB PRODUCTION DATABASE SCHEMA
-- Complete Schema with Proper RLS Policies
-- 
-- ⚠️ WARNING: This will DROP and RECREATE all tables
-- Run in Supabase SQL Editor on a FRESH project or backup first!
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP EVERYTHING CLEAN (Fresh Start)
-- ============================================================================

-- Drop policies first (they depend on tables)
DO $$
DECLARE
    policy_rec RECORD;
BEGIN
    FOR policy_rec IN 
        SELECT tablename, policyname FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_rec.policyname, policy_rec.tablename);
    END LOOP;
END $$;

-- Drop all custom tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS weekly_logs CASCADE;
DROP TABLE IF EXISTS evaluations CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS internship_assignments CASCADE;
DROP TABLE IF EXISTS internships CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS supervisors CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS host_organizations CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS programs CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS universities CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_recipients CASCADE;
DROP TABLE IF EXISTS notifications_sent CASCADE;
DROP TABLE IF EXISTS communications CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS licenses CASCADE;
DROP TABLE IF EXISTS platform_settings CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop types if they exist
DROP TYPE IF EXISTS user_role_type CASCADE;
DROP TYPE IF EXISTS internship_status_type CASCADE;
DROP TYPE IF EXISTS application_status_type CASCADE;
DROP TYPE IF EXISTS evaluation_type CASCADE;
DROP TYPE IF EXISTS evaluation_status CASCADE;
DROP TYPE IF EXISTS weekly_log_status CASCADE;
DROP TYPE IF EXISTS document_type CASCADE;
DROP TYPE IF EXISTS document_status CASCADE;
DROP TYPE IF EXISTS attendance_status CASCADE;
DROP TYPE IF EXISTS message_type CASCADE;
DROP TYPE IF EXISTS notification_category CASCADE;
DROP TYPE IF EXISTS notification_priority CASCADE;


-- ============================================================================
-- STEP 2: CREATE ENUM TYPES
-- ============================================================================

CREATE TYPE user_role_type AS ENUM (
  'super_admin', 'university_admin', 'department_coordinator', 
  'faculty_supervisor', 'student', 'company_hr', 'site_supervisor', 
  'external_evaluator', 'pending_assignment'
);

CREATE TYPE internship_status_type AS ENUM ('draft', 'open', 'active', 'completed', 'cancelled', 'expired');
CREATE TYPE application_status_type AS ENUM ('pending', 'reviewing', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE evaluation_type AS ENUM ('weekly_log', 'midterm', 'final', 'company_evaluation', 'supervisor_evaluation');
CREATE TYPE evaluation_status AS ENUM ('pending', 'in_progress', 'submitted', 'approved', 'rejected');
CREATE TYPE weekly_log_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'revision_required');
CREATE TYPE document_type AS ENUM ('resume', 'cover_letter', 'transcript', 'offer_letter', 'weekly_report', 'evaluation_form', 'certificate', 'other');
CREATE TYPE document_status AS ENUM ('pending', 'verified', 'rejected', 'expired');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'half_day', 'leave', 'holiday');
CREATE TYPE message_type AS ENUM ('direct', 'announcement', 'notification', 'system');
CREATE TYPE notification_category AS ENUM ('auth', 'application', 'evaluation', 'deadline', 'system', 'announcement');
CREATE TYPE notification_priority AS ENUM ('low', 'medium', 'high', 'urgent');


-- ============================================================================
-- STEP 3: CREATE CORE TABLES
-- ============================================================================

-- 3.1 UNIVERSITIES (Tenants)
CREATE TABLE universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  domain TEXT UNIQUE,
  address TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  license_tier TEXT NOT NULL DEFAULT 'free' CHECK (license_tier IN ('free', 'professional', 'enterprise')),
  license_expires_at TIMESTAMPTZ,
  max_students INTEGER,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 DEPARTMENTS
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  head_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.3 PROGRAMS (Degree Programs)
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  duration_years INTEGER NOT NULL DEFAULT 4,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 COMPANIES / HOST ORGANIZATIONS
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  industry TEXT,
  website TEXT,
  size TEXT CHECK (size IN ('small', 'medium', 'large', 'enterprise')),
  description TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  contact_person TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  university_id UUID REFERENCES universities(id), -- For partnered companies
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alias for clarity
CREATE VIEW host_organizations AS SELECT * FROM companies;


-- ============================================================================
-- STEP 4: USER & PROFILE TABLES
-- ============================================================================

-- 4.1 PROFILES (Main user profile table)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  role user_role_type NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  username TEXT UNIQUE,
  
  -- University/Department links
  university_id UUID REFERENCES universities(id),
  department_id UUID REFERENCES departments(id),
  
  -- Company link (for company_hr)
  company_id UUID REFERENCES companies(id),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Role-specific fields
  student_id UUID, -- Links to students table
  company_name TEXT, -- For external evaluators/supervisors
  job_title TEXT,
  organization TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by user_id
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_university_id ON profiles(university_id);


-- ============================================================================
-- STEP 5: STUDENT-SPECIFIC TABLES
-- ============================================================================

-- 5.1 STUDENTS (Extended student profile)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  university_id UUID NOT NULL REFERENCES universities(id),
  department_id UUID REFERENCES departments(id),
  program_id UUID REFERENCES programs(id),
  
  -- Academic Info
  enrollment_number TEXT UNIQUE,
  cgpa NUMERIC(3, 2) CHECK (cgpa >= 0 AND cgpa <= 4),
  semester INTEGER CHECK (semester > 0 AND semester <= 12),
  expected_graduation DATE,
  
  -- Skills & Preferences
  skills TEXT[] DEFAULT '{}',
  preferred_industries TEXT[] DEFAULT '{}',
  resume_url TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'withdrawn', 'suspended')),
  
  -- Internship tracking
  current_internship_id UUID,
  total_completed_internships INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_university_id ON students(university_id);
CREATE INDEX idx_students_program_id ON students(program_id);
CREATE INDEX idx_students_enrollment_number ON students(enrollment_number);


-- 5.2 SUPERVISORS (Faculty & Site Supervisors)
CREATE TABLE supervisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('faculty', 'site')),
  
  -- University affiliation
  university_id UUID REFERENCES universities(id),
  department_id UUID REFERENCES departments(id),
  
  -- Supervision scope
  program_ids UUID[] DEFAULT '{}',
  max_supervisees INTEGER NOT NULL DEFAULT 10,
  current_supervisee_count INTEGER NOT NULL DEFAULT 0,
  
  -- Company affiliation (for site supervisors)
  company_id UUID REFERENCES companies(id),
  
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supervisors_user_id ON supervisors(user_id);
CREATE INDEX idx_supervisors_type ON supervisors(type);


-- ============================================================================
-- STEP 6: INTERNSHIP MANAGEMENT
-- ============================================================================

-- 6.1 INTERNSHIPS (Job Postings)
CREATE TABLE internships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Company info
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL, -- Denormalized for queries
  
  -- Department/Program targeting
  department_id UUID REFERENCES departments(id),
  program_ids UUID[] DEFAULT '{}',
  
  -- Location
  location TEXT,
  remote BOOLEAN NOT NULL DEFAULT false,
  
  -- Compensation
  is_paid BOOLEAN NOT NULL DEFAULT false,
  stipend NUMERIC(10, 2),
  stipend_currency TEXT NOT NULL DEFAULT 'PKR',
  
  -- Duration
  duration_weeks INTEGER NOT NULL CHECK (duration_weeks > 0),
  start_date DATE,
  end_date DATE,
  application_deadline DATE,
  
  -- Status
  status internship_status_type NOT NULL DEFAULT 'draft',
  
  -- Requirements
  required_skills TEXT[] DEFAULT '{}',
  requirements TEXT[] DEFAULT '{}',
  benefits TEXT[] DEFAULT '{}',
  
  -- Application limits
  max_applicants INTEGER,
  current_applicants INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_internships_company_id ON internships(company_id);
CREATE INDEX idx_internships_status ON internships(status);
CREATE INDEX idx_internships_deadline ON internships(application_deadline);


-- 6.2 APPLICATIONS
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id UUID NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  
  -- Student info (denormalized for queries)
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  
  -- Application content
  cover_letter TEXT,
  resume_url TEXT,
  
  -- Status
  status application_status_type NOT NULL DEFAULT 'pending',
  
  -- Review info
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure one application per student per internship
  UNIQUE(internship_id, student_id)
);

CREATE INDEX idx_applications_internship_id ON applications(internship_id);
CREATE INDEX idx_applications_student_id ON applications(student_id);
CREATE INDEX idx_applications_status ON applications(status);


-- 6.3 INTERNSHIP ASSIGNMENTS (Active Internships)
CREATE TABLE internship_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id UUID NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  
  -- Assignment details
  assigned_by UUID REFERENCES profiles(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Supervisor assignments
  faculty_supervisor_id UUID REFERENCES supervisors(id),
  site_supervisor_id UUID REFERENCES supervisors(id),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated', 'paused')),
  
  -- Completion
  completion_date DATE,
  completion_notes TEXT,
  certificate_issued BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(student_id, internship_id)
);

CREATE INDEX idx_assignment_student ON internship_assignments(student_id);
CREATE INDEX idx_assignment_internship ON internship_assignments(internship_id);
CREATE INDEX idx_assignment_supervisor ON internship_assignments(faculty_supervisor_id, site_supervisor_id);


-- ============================================================================
-- STEP 7: EVALUATIONS & ASSESSMENTS
-- ============================================================================

CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type evaluation_type NOT NULL,
  
  -- Subject
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  internship_id UUID REFERENCES internship_assignments(id) ON DELETE SET NULL,
  
  -- Evaluator
  evaluator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evaluator_role user_role_type NOT NULL,
  
  -- Status
  status evaluation_status NOT NULL DEFAULT 'pending',
  
  -- Scores (JSONB for flexible scoring criteria)
  scores JSONB,
  total_score NUMERIC(5, 2),
  max_score NUMERIC(5, 2) DEFAULT 100,
  
  -- Feedback
  comments TEXT,
  strengths TEXT[],
  improvements TEXT[],
  
  -- Period
  evaluation_period TEXT CHECK (evaluation_period IN ('midterm', 'final', 'weekly', 'monthly', 'special')),
  week_number INTEGER,
  
  submitted_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_student ON evaluations(student_id);
CREATE INDEX idx_evaluations_evaluator ON evaluations(evaluator_id);
CREATE INDEX idx_evaluations_status ON evaluations(status);
CREATE INDEX idx_evaluations_type ON evaluations(type);


-- ============================================================================
-- STEP 8: WEEKLY LOGS (Student Reports)
-- ============================================================================

CREATE TABLE weekly_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  internship_id UUID NOT NULL REFERENCES internship_assignments(id) ON DELETE CASCADE,
  
  -- Week info
  week_number INTEGER NOT NULL CHECK (week_number > 0 AND week_number <= 52),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  
  -- Content
  tasks_completed TEXT[] DEFAULT '{}',
  challenges TEXT,
  learnings TEXT,
  next_week_goals TEXT,
  hours_worked NUMERIC(4, 1) CHECK (hours_worked >= 0 AND hours_worked <= 168),
  
  -- Status
  status weekly_log_status NOT NULL DEFAULT 'draft',
  
  -- Review
  supervisor_feedback TEXT,
  supervisor_id UUID REFERENCES supervisors(id),
  reviewed_at TIMESTAMPTZ,
  
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- One log per student per week per internship
  UNIQUE(student_id, internship_id, week_number)
);

CREATE INDEX idx_weekly_logs_student ON weekly_logs(student_id);
CREATE INDEX idx_weekly_logs_status ON weekly_logs(status);
CREATE INDEX idx_weekly_logs_internship ON weekly_logs(internship_id);


-- ============================================================================
-- STEP 9: ATTENDANCE TRACKING
-- ============================================================================

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  internship_id UUID NOT NULL REFERENCES internship_assignments(id) ON DELETE CASCADE,
  
  date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  
  -- Location (optional)
  location_lat NUMERIC(10, 6),
  location_lng NUMERIC(10, 6),
  
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(student_id, date)
);

CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);


-- ============================================================================
-- STEP 10: DOCUMENTS
-- ============================================================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type document_type NOT NULL,
  url TEXT NOT NULL, -- Storage URL
  size BIGINT NOT NULL, -- in bytes
  mime_type TEXT NOT NULL,
  
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Entity linking
  entity_type TEXT NOT NULL CHECK (entity_type IN ('student', 'internship', 'application', 'evaluation', 'user')),
  entity_id UUID NOT NULL,
  
  status document_status NOT NULL DEFAULT 'pending',
  
  -- Verification fields
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX idx_documents_uploader ON documents(uploaded_by);
CREATE INDEX idx_documents_type ON documents(type);


-- ============================================================================
-- STEP 11: TASKS
-- ============================================================================

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Assignment
  assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Context
  internship_id UUID REFERENCES internship_assignments(id),
  student_id UUID REFERENCES students(id),
  
  -- Dates
  due_date DATE,
  completed_at TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'cancelled')),
  
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_student ON tasks(student_id);


-- ============================================================================
-- STEP 12: NOTIFICATIONS SYSTEM
-- ============================================================================

-- 12.1 Notifications (User inbox)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'announcement' CHECK (type IN ('announcement', 'reminder', 'alert', 'system', 'task', 'evaluation')),
  category notification_category DEFAULT 'system',
  priority notification_priority NOT NULL DEFAULT 'medium',
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sender_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- 12.2 Notification Recipients (For sent notifications)
CREATE TABLE notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- 12.3 Sent Notifications Log (For senders)
CREATE TABLE notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT DEFAULT 'announcement',
  priority notification_priority DEFAULT 'medium',
  target_type TEXT CHECK (target_type IN ('individual', 'program', 'department', 'all')),
  target_id UUID,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  action_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- STEP 13: COMMUNICATIONS / MESSAGING
-- ============================================================================

CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type message_type NOT NULL DEFAULT 'direct',
  
  -- Participants
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Null for announcements
  
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  
  thread_id UUID, -- For conversation threading
  attachments TEXT[] DEFAULT '{}',
  
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Context
  internship_id UUID,
  student_id UUID,
  
  parent_id UUID REFERENCES communications(id), -- For replies
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_communications_sender ON communications(sender_id);
CREATE INDEX idx_communications_receiver ON communications(receiver_id);
CREATE INDEX idx_communications_thread ON communications(thread_id);


-- ============================================================================
-- STEP 14: AUDIT LOGS
-- ============================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  
  -- Request info
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);


-- ============================================================================
-- STEP 15: LICENSES & SETTINGS
-- ============================================================================

-- 15.1 Licenses
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID UNIQUE REFERENCES universities(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'professional', 'enterprise')),
  features TEXT[] DEFAULT '{}',
  
  limits JSONB DEFAULT '{
    "maxUniversities": 1,
    "maxStudentsPerUniversity": 500,
    "maxAdmins": 10,
    "storageGB": 5,
    "apiCallsPerMonth": 10000
  }'::jsonb,
  
  pricing JSONB DEFAULT '{"monthly": null, "annual": null}'::jsonb,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15.2 Platform Settings
CREATE TABLE platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO platform_settings (key, value, description) VALUES
  ('maintenance_mode', false, 'Enable maintenance mode'),
  ('allow_registration', true, 'Allow new user registration'),
  ('default_license_tier', 'free', 'Default tier for new universities'),
  ('max_file_size_mb', 10, 'Maximum file upload size in MB'),
  ('session_timeout_minutes', 1440, 'Session timeout in minutes (24h default)');


-- ============================================================================
-- STEP 16: REPORTS
-- ============================================================================

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('summary', 'detailed', 'analytics', 'custom')),
  format TEXT NOT NULL CHECK (format IN ('pdf', 'csv', 'excel')),
  parameters JSONB DEFAULT '{}'::jsonb,
  
  generated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT, -- URL to stored report
  file_size BIGINT,
  
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_reports_generator ON reports(generated_by);
CREATE INDEX idx_reports_status ON reports(status);


-- ============================================================================
-- STEP 17: ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE internships ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE internship_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- STEP 18: RLS POLICIES - PROFILES TABLE
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "profiles_users_view_own" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own profile (on signup)
CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Super admins can do anything with profiles
CREATE POLICY "super_admin_full_profiles" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- University admins can view profiles from their university
CREATE POLICY "uni_admin_view_uni_profiles" ON profiles
  FOR SELECT USING (
    university_id IN (
      SELECT university_id FROM profiles WHERE user_id = auth.uid() AND role = 'university_admin'
    )
  );

-- Department coordinators can view profiles from their department
CREATE POLICY "dept_coord_view_dept_profiles" ON profiles
  FOR SELECT USING (
    department_id IN (
      SELECT department_id FROM profiles WHERE user_id = auth.uid() AND role = 'department_coordinator'
    )
  );

-- Faculty supervisors can view their supervisees' profiles
CREATE POLICY "faculty_view_student_profiles" ON profiles
  FOR SELECT USING (
    user_id IN (
      SELECT s.user_id FROM students s
      JOIN supervisors sup ON sup.user_id = auth.uid() AND sup.type = 'faculty'
      WHERE s.program_id = ANY(sup.program_ids)
    )
  );


-- ============================================================================
-- STEP 19: RLS POLICIES - UNIVERSITIES
-- ============================================================================

-- Super admins can view all universities
CREATE POLICY "super_admin_view_universities" ON universities
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- University admins can view their university
CREATE POLICY "uni_admin_view_own_university" ON universities
  FOR SELECT USING (
    id IN (SELECT university_id FROM profiles WHERE user_id = auth.uid())
  );

-- Department coordinators can view their university
CREATE POLICY "dept_coord_view_university" ON universities
  FOR SELECT USING (
    id IN (SELECT university_id FROM profiles WHERE user_id = auth.uid())
  );

-- Faculty/students can view their university
CREATE POLICY "users_view_own_university" ON universities
  FOR SELECT USING (
    id IN (SELECT university_id FROM profiles WHERE user_id = auth.uid())
  );

-- Public can view active universities (for marketplace)
CREATE POLICY "public_view_active_universities" ON universities
  FOR SELECT USING (is_active = true);

-- Only super admins can modify universities
CREATE POLICY "super_admin_manage_universities" ON universities
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );


-- ============================================================================
-- STEP 20: RLS POLICIES - STUDENTS
-- ============================================================================

-- Students can view their own record
CREATE POLICY "students_view_own" ON students
  FOR SELECT USING (auth.uid() = user_id);

-- Students can update some of their own data
CREATE POLICY "students_update_own" ON students
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Super admins can manage all students
CREATE POLICY "super_admin_full_students" ON students
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- University admins can view/manage students from their university
CREATE POLICY "uni_admin_view_students" ON students
  FOR SELECT USING (
    university_id IN (SELECT university_id FROM profiles WHERE user_id = auth.uid() AND role = 'university_admin')
  );
CREATE POLICY "uni_admin_update_students" ON students
  FOR UPDATE USING (
    university_id IN (SELECT university_id FROM profiles WHERE user_id = auth.uid() AND role = 'university_admin')
  ) WITH CHECK (
    university_id IN (SELECT university_id FROM profiles WHERE user_id = auth.uid() AND role = 'university_admin')
  );

-- Department coordinators can view students from their department
CREATE POLICY "dept_coord_view_students" ON students
  FOR SELECT USING (
    department_id IN (SELECT department_id FROM profiles WHERE user_id = auth.uid() AND role = 'department_coordinator')
  );

-- Faculty supervisors can view their supervised students
CREATE POLICY "faculty_view_supervised_students" ON students
  FOR SELECT USING (
    program_id IS NOT NULL AND program_id = ANY(
      SELECT program_ids FROM supervisors WHERE user_id = auth.uid() AND type = 'faculty'
    )
  );

-- Site supervisors can view their assigned interns
CREATE POLICY "site_supervisor_view_assigned" ON students
  FOR SELECT USING (
    id IN (
      SELECT ia.student_id FROM internship_assignments ia
      WHERE ia.site_supervisor_id = (SELECT id FROM supervisors WHERE user_id = auth.uid() AND type = 'site')
    )
  );

-- Company HR can view students who applied to their internships
CREATE POLICY "company_hr_view_applicants" ON students
  FOR SELECT USING (
    id IN (SELECT student_id FROM applications a JOIN internships i ON a.internship_id = i.id WHERE i.company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid()))
  );


-- ============================================================================
-- STEP 21: RLS POLICIES - INTERNSHIPS
-- ============================================================================

-- Super admins can view all
CREATE POLICY "super_admin_all_internships" ON internships
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Company HR can view/manage their company's internships
CREATE POLICY "company_hr_own_internships" ON internships
  FOR ALL USING (company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- Students can view open/published internships
CREATE POLICY "students_view_open_internships" ON internships
  FOR SELECT USING (status = 'open');

-- University staff can view internships related to their university
CREATE POLICY "uni_staff_view_internships" ON internships
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role IN ('university_admin', 'department_coordinator', 'faculty_supervisor'))
  );

-- Faculty can view internships their students are in
CREATE POLICY "faculty_view_student_internships" ON internships
  FOR SELECT USING (
    id IN (SELECT internship_id FROM internship_assignments WHERE student_id IN (
      SELECT s.user_id FROM students s
      JOIN supervisors sup ON sup.type = 'faculty' AND s.program_id = ANY(sup.program_ids)
      WHERE sup.user_id = auth.uid()
    ))
  );


-- ============================================================================
-- STEP 22: RLS POLICIES - APPLICATIONS
-- ============================================================================

-- Students can view their own applications
CREATE POLICY "students_view_own_applications" ON applications
  FOR SELECT USING (student_id = (SELECT id FROM students WHERE user_id = auth.uid()));

-- Students can create applications
CREATE POLICY "students_create_applications" ON applications
  FOR INSERT WITH CHECK (student_id = (SELECT id FROM students WHERE user_id = auth.uid()));

-- Super admins can manage all
CREATE POLICY "super_admin_all_applications" ON applications
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Company HR can view applications to their internships
CREATE POLICY "company_hr_view_applications" ON applications
  FOR ALL USING (
    internship_id IN (SELECT id FROM internships WHERE company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid()))
  );

-- University staff can view applications from their students
CREATE POLICY "uni_staff_view_applications" ON applications
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE university_id = (SELECT university_id FROM profiles WHERE user_id = auth.uid()))
  );


-- ============================================================================
-- STEP 23: RLS POLICIES - NOTIFICATIONS
-- ============================================================================

-- Users can view their own notifications
CREATE POLICY "users_view_own_notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "users_update_own_notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Staff can insert notifications (send to others)
CREATE POLICY "staff_send_notifications" ON notifications
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() 
      AND role IN ('faculty_supervisor', 'department_coordinator', 'university_admin', 'super_admin')
    )
  );

-- Super admins can manage all notifications
CREATE POLICY "super_admin_notifications" ON notifications
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'));


-- ============================================================================
-- STEP 24: RLS POLICIES - OTHER TABLES (Summary)
-- ============================================================================

-- WEEKLY LOGS
CREATE POLICY "students_own_weekly_logs" ON weekly_logs
  FOR ALL USING (student_id = (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "super_admin_weekly_logs" ON weekly_logs
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "faculty_view_weekly_logs" ON weekly_logs
  FOR SELECT, UPDATE USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN supervisors sup ON sup.user_id = auth.uid() AND sup.type = 'faculty'
      WHERE s.program_id = ANY(sup.program_ids)
    )
  );

-- EVALUATIONS
CREATE POLICY "evaluators_own_evaluations" ON evaluations
  FOR ALL USING (evaluator_id = auth.uid());
CREATE POLICY "students_view_own_evaluations" ON evaluations
  FOR SELECT USING (student_id = (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "super_admin_evaluations" ON evaluations
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- ATTENDANCE
CREATE POLICY "students_own_attendance" ON attendance
  FOR SELECT USING (student_id = (SELECT id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "super_admin_attendance" ON attendance
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "company_hr_attendance" ON attendance
  FOR ALL USING (
    internship_id IN (SELECT id FROM internship_assignments WHERE internship_id IN (
      SELECT id FROM internships WHERE company_id = (SELECT company_id FROM profiles WHERE user_id = auth.uid())
    ))
  );

-- DOCUMENTS
CREATE POLICY "users_own_documents" ON documents
  FOR ALL USING (uploaded_by = auth.uid());
CREATE POLICY "super_admin_documents" ON documents
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- TASKS
CREATE POLICY "users_own_tasks" ON tasks
  FOR ALL USING (assigned_to = auth.uid() OR assigned_by = auth.uid());
CREATE POLICY "super_admin_tasks" ON tasks
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- COMMUNICATIONS
CREATE POLICY "users_own_messages" ON communications
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "users_send_messages" ON communications
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- REPORTS
CREATE POLICY "users_own_reports" ON reports
  FOR ALL USING (generated_by = auth.uid());
CREATE POLICY "super_admin_reports" ON reports
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- DEPARTMENTS (viewable within university)
CREATE POLICY "view_departments" ON departments
  FOR SELECT USING (
    university_id IN (SELECT university_id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );
CREATE POLICY "manage_departments" ON departments
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('super_admin', 'university_admin')));

-- PROGRAMS
CREATE POLICY "view_programs" ON programs
  FOR SELECT USING (
    university_id IN (SELECT university_id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- SUPERVISORS
CREATE POLICY "view_supervisors" ON supervisors
  FOR SELECT USING (
    university_id IN (SELECT university_id FROM profiles WHERE user_id = auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );
CREATE POLICY "manage_supervisors" ON supervisors
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('super_admin', 'university_admin')));

-- COMPANIES
CREATE POLICY "public_view_companies" ON companies
  FOR SELECT USING (is_active = true AND is_verified = true);
CREATE POLICY "company_hr_own_company" ON companies
  FOR ALL USING (id = (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "super_admin_companies" ON companies
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- AUDIT LOGS (only super admins can view)
CREATE POLICY "super_admin_audit_logs" ON audit_logs
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "insert_audit_logs" ON audit_logs
  FOR INSERT WITH CHECK (true); -- System inserts

-- LICENSES
CREATE POLICY "view_licenses" ON licenses
  FOR SELECT USING (
    university_id = (SELECT university_id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );
CREATE POLICY "manage_licenses" ON licenses
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- PLATFORM SETTINGS (only super admins)
CREATE POLICY "super_admin_settings" ON platform_settings
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'super_admin'));
-- Allow reads for basic functionality
CREATE POLICY "public_read_settings" ON platform_settings
  FOR SELECT USING (true);


-- ============================================================================
-- STEP 25: HELPER FUNCTIONS
-- ============================================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role_type AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE;

-- Check if current user has specific role
CREATE OR REPLACE FUNCTION has_role(target_role user_role_type)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = target_role);
$$ LANGUAGE sql STABLE;

-- Get current user's university ID
CREATE OR REPLACE FUNCTION get_current_user_university_id()
RETURNS UUID AS $$
  SELECT university_id FROM profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE;

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to tables that have it
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_universities_updated_at BEFORE UPDATE ON universities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supervisors_updated_at BEFORE UPDATE ON supervisors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_internships_updated_at BEFORE UPDATE ON internships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_internship_assignments_updated_at BEFORE UPDATE ON internship_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_logs_updated_at BEFORE UPDATE ON weekly_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- STEP 25.5: AUTO-CREATE PROFILE ON USER SIGNUP (CRITICAL!)
-- ============================================================================

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_user_meta_data->>'user_role',
    'pending_assignment'
  );
  
  INSERT INTO profiles (
    user_id, 
    email, 
    full_name, 
    first_name,
    last_name,
    role,
    is_active
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'first_name'),
    COALESCE(NEW.raw_user_meta_data->>'last_name'),
    v_role::user_role_type,
    true
  ) ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Fix existing users without profiles
INSERT INTO profiles (user_id, email, full_name, role, is_active)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email),
  COALESCE(raw_user_meta_data->>'role', 'student')::user_role_type,
  true
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.user_id = au.id
);


-- ============================================================================
-- STEP 26: INSERT SUPER ADMIN (IMPORTANT!)
-- ============================================================================

-- This creates the super admin profile for your existing auth user
-- Replace 'YOUR_USER_ID_HERE' with actual UUID if needed, or run after creating auth user

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the first super admin user or use existing
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    INSERT INTO profiles (user_id, email, full_name, role, is_active)
    VALUES (v_user_id, COALESCE(
      (SELECT email FROM auth.users WHERE id = v_user_id),
      'admin@internhub.pk'
    ), 'Super Admin', 'super_admin', true)
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE NOTICE 'Super admin profile created for user: %', v_user_id;
  ELSE
    RAISE NOTICE 'No users found. Create an auth user first, then re-run this script.';
  END IF;
END $$;


COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to confirm everything works)
-- ============================================================================

-- Check all tables exist
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Count policies per table
-- SELECT tablename, COUNT(*) as policy_count FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename ORDER BY tablename;

-- Test: Can you see your own profile?
-- SELECT * FROM profiles WHERE user_id = auth.uid();

-- Test: Can you see universities?
-- SELECT * FROM universities LIMIT 5;

-- Test: Notification count
-- SELECT count(*) FROM notifications WHERE user_id = auth.uid() AND is_read = false;
