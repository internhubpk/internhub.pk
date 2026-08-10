-- ============================================================
-- INTERNHUB: COMPLETE DATABASE SCHEMA
-- ============================================================
-- INSTRUCTIONS:
-- 1. This script DROPS all existing tables first (fresh start)
-- 2. Then creates the complete schema matching the codebase
-- 3. Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PHASE 1: DROP EVERYTHING (Fresh Start)
-- ============================================================

-- Use a DO block to safely drop triggers (handles missing tables)
DO $$
BEGIN
    -- Drop triggers only if both trigger AND table exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'universities' AND table_schema = 'public') THEN
        DROP TRIGGER IF EXISTS update_universities_updated_at ON public.universities;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
        DROP TRIGGER IF EXISTS sync_profile_fields ON public.profiles;
    END IF;
END $$;

-- Drop all tables in reverse dependency order (CASCADE handles dependencies)
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.online_meetings CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.weekly_logs CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.evaluations CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.student_internships CASCADE;
DROP TABLE IF EXISTS public.internship_applications CASCADE;
DROP TABLE IF EXISTS public.internships CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.faculty CASCADE;
DROP TABLE IF EXISTS public.programs CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.university_policies CASCADE;
DROP TABLE IF EXISTS public.evaluation_rules CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.billing_invoices CASCADE;
DROP TABLE IF EXISTS public.storage_allocations CASCADE;
DROP TABLE IF EXISTS public.universities CASCADE;
DROP TABLE IF EXISTS public.platform_settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS public.document_type;
DROP TYPE IF EXISTS public.application_status;
DROP TYPE IF EXISTS public.user_role;

-- Drop functions
DROP FUNCTION IF EXISTS public.get_user_university_id();
DROP FUNCTION IF EXISTS public.internship_application_university_id(app public.internship_applications);
DROP FUNCTION IF EXISTS public.student_internship_university_id(si public.student_internships);
DROP FUNCTION IF EXISTS public.weekly_log_university_id(wl public.weekly_logs);
DROP FUNCTION IF EXISTS public.report_university_id(r public.reports);
DROP FUNCTION IF EXISTS public.attendance_university_id(a public.attendance);
DROP FUNCTION IF EXISTS public.evaluation_university_id(e public.evaluations);
DROP FUNCTION IF EXISTS public.chat_university_id(msg public.chat_messages);
DROP FUNCTION IF EXISTS public.meeting_university_id(m public.online_meetings);
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.sync_profile_email();

-- ============================================================
-- PHASE 2: EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PHASE 3: ENUM TYPES
-- ============================================================

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

CREATE TYPE public.application_status AS ENUM (
    'applied',
    'university_approved',
    'company_accepted',
    'company_rejected'
);

CREATE TYPE public.document_type AS ENUM (
    'weekly_log',
    'report',
    'certificate',
    'attendance',
    'offer_letter',
    'completion_letter',
    'internship_letter',
    'remarks',
    'digital_signature'
);

-- ============================================================
-- PHASE 4: CORE TABLES
-- NOTE: Order matters! Breaking circular FK dependencies
-- ============================================================

-- ----------------------------------------------------------
-- 4.1 UNIVERSITIES FIRST (without created_by FK initially)
-- Created first because profiles.university_id references it
-- ----------------------------------------------------------
CREATE TABLE public.universities (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            text NOT NULL,
    slug            text UNIQUE,
    description     text,
    logo_url        text,
    website         text,
    domain          text UNIQUE,
    subdomain       text UNIQUE,
    status          text NOT NULL DEFAULT 'active', -- active, inactive, suspended
    primary_color   text DEFAULT '#3B82F6',
    secondary_color text DEFAULT '#10B981',
    created_by      uuid, -- FK added AFTER profiles table is created
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz
);

-- ----------------------------------------------------------
-- 4.2 PROFILES (All Users) - Can now reference universities
-- ----------------------------------------------------------
CREATE TABLE public.profiles (
    user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role            public.user_role NOT NULL,
    university_id   uuid REFERENCES public.universities(id) ON DELETE SET NULL,
    department_id   uuid,
    company_id      uuid,
    full_name       text,
    email           text,
    first_name      text,
    last_name       text,
    phone           text,
    bio             text,
    avatar_url      text,
    status          text NOT NULL DEFAULT 'active', -- active, inactive, suspended, pending_setup
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz
);

-- ----------------------------------------------------------
-- 4.3 ADD DEFERRED FOREIGN KEYS (circular dependency resolved)
-- Now that BOTH tables exist, add the missing FK
-- ----------------------------------------------------------

-- Add FK: universities.created_by -> profiles.user_id
ALTER TABLE public.universities
ADD CONSTRAINT universities_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES public.profiles(user_id)
ON DELETE SET NULL;

-- ----------------------------------------------------------
-- 4.4 PLATFORM SETTINGS (Key-Value Store for Super Admin)
-- ----------------------------------------------------------
CREATE TABLE public.platform_settings (
    key             text PRIMARY KEY,
    value           jsonb NOT NULL DEFAULT '{}',
    updated_at      timestamptz DEFAULT now()
);

-- ============================================================
-- PHASE 5: UNIVERSITY-SCOPED TABLES
-- ============================================================

-- ----------------------------------------------------------
-- 5.1 DEPARTMENTS
-- ----------------------------------------------------------
CREATE TABLE public.departments (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    name            text NOT NULL,
    created_at      timestamptz DEFAULT now()
);

-- ----------------------------------------------------------
-- 5.2 PROGRAMS (Degree Programs within Departments)
-- ----------------------------------------------------------
CREATE TABLE public.programs (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    department_id   uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    name            text NOT NULL,
    created_at      timestamptz DEFAULT now()
);

-- ----------------------------------------------------------
-- 5.3 FACULTY MEMBERS
-- ----------------------------------------------------------
CREATE TABLE public.faculty (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    department_id   uuid REFERENCES public.departments(id) ON DELETE SET NULL,
    created_at      timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- ----------------------------------------------------------
-- 5.4 STUDENTS
-- ----------------------------------------------------------
CREATE TABLE public.students (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    program_id      uuid REFERENCES public.programs(id) ON DELETE SET NULL,
    enrollment_year int,
    created_at      timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- ----------------------------------------------------------
-- 5.5 COMPANIES (Host Organizations)
-- ----------------------------------------------------------
CREATE TABLE public.companies (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    name            text NOT NULL,
    industry        text,
    website         text,
    logo_url        text,
    description     text,
    is_active       boolean DEFAULT true,
    created_at      timestamptz DEFAULT now()
);

-- ----------------------------------------------------------
-- 5.6 INTERNSHIPS (Posted by Companies)
-- ----------------------------------------------------------
CREATE TABLE public.internships (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    title           text NOT NULL,
    description     text,
    location        text,
    type            text, -- remote, onsite, hybrid
    duration_weeks  int,
    is_paid         boolean DEFAULT false,
    stipend         numeric(10,2),
    requirements    text[],
    skills_required text[],
    is_active       boolean DEFAULT true,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz
);

-- ----------------------------------------------------------
-- 5.7 INTERNSHIP APPLICATIONS
-- ----------------------------------------------------------
CREATE TABLE public.internship_applications (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    internship_id           uuid NOT NULL REFERENCES public.internships(id) ON DELETE CASCADE,
    student_id              uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    status                  public.application_status NOT NULL DEFAULT 'applied',
    cover_letter            text,
    resume_url              text,
    university_approved_by  uuid REFERENCES public.profiles(user_id),
    company_decision_by     uuid REFERENCES public.profiles(user_id),
    applied_at              timestamptz DEFAULT now(),
    reviewed_at             timestamptz,
    UNIQUE(internship_id, student_id)
);

-- ----------------------------------------------------------
-- 5.8 STUDENT INTERNSHIPS (Active Placements)
-- ----------------------------------------------------------
CREATE TABLE public.student_internships (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id          uuid UNIQUE NOT NULL REFERENCES public.internship_applications(id) ON DELETE CASCADE,
    student_id              uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    internship_id           uuid NOT NULL REFERENCES public.internships(id) ON DELETE CASCADE,
    faculty_supervisor_id   uuid REFERENCES public.faculty(id),
    site_supervisor_id      uuid REFERENCES public.profiles(user_id),
    external_evaluator_id   uuid REFERENCES public.profiles(user_id),
    start_date              date,
    end_date                date,
    working_hours_per_week  int DEFAULT 40,
    transcript_status       text DEFAULT 'pending', -- pending, approved, rejected
    status                  text DEFAULT 'active', -- active, completed, terminated, paused
    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz
);

-- ----------------------------------------------------------
-- 5.9 WEEKLY LOGS (Student submissions)
-- ----------------------------------------------------------
CREATE TABLE public.weekly_logs (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_internship_id   uuid NOT NULL REFERENCES public.student_internships(id) ON DELETE CASCADE,
    week_number             int NOT NULL,
    content                 text NOT NULL,
    tasks_completed         text[],
    challenges_faced        text[],
    learning_outcomes       text[],
    next_week_goals         text[],
    supervisor_feedback      text,
    status                  text DEFAULT 'submitted', -- submitted, approved, needs_revision
    submitted_at            timestamptz DEFAULT now(),
    reviewed_at             timestamptz,
    reviewed_by             uuid REFERENCES public.profiles(user_id),
    UNIQUE(student_internship_id, week_number)
);

-- ----------------------------------------------------------
-- 5.10 REPORTS (Student reports/documents)
-- ----------------------------------------------------------
CREATE TABLE public.reports (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_internship_id   uuid NOT NULL REFERENCES public.student_internships(id) ON DELETE CASCADE,
    title                   text NOT NULL,
    description             text,
    file_url                text NOT NULL,
    file_type               text, -- pdf, docx, etc.
    report_type             text, -- weekly, monthly, final
    status                  text DEFAULT 'submitted', -- submitted, approved, rejected
    submitted_at            timestamptz DEFAULT now(),
    reviewed_by             uuid REFERENCES public.profiles(user_id),
    review_feedback         text,
    reviewed_at             timestamptz
);

-- ----------------------------------------------------------
-- 5.11 ATTENDANCE RECORDS
-- ----------------------------------------------------------
CREATE TABLE public.attendance (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_internship_id   uuid NOT NULL REFERENCES public.student_internships(id) ON DELETE CASCADE,
    date                    date NOT NULL DEFAULT CURRENT_DATE,
    check_in                timestamptz,
    check_out               timestamptz,
    status                  text NOT NULL DEFAULT 'present', -- present, absent, late, half_day, leave
    notes                   text,
    recorded_by             uuid REFERENCES public.profiles(user_id),
    created_at              timestamptz DEFAULT now(),
    UNIQUE(student_internship_id, date)
);

-- ----------------------------------------------------------
-- 5.12 EVALUATIONS
-- ----------------------------------------------------------
CREATE TABLE public.evaluations (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_internship_id   uuid NOT NULL REFERENCES public.student_internships(id) ON DELETE CASCADE,
    evaluator_user_id       uuid NOT NULL REFERENCES public.profiles(user_id),
    evaluator_role          public.user_role NOT NULL,
    week_number             int,
    
    -- Scoring criteria (each out of 5 or 10)
    technical_skills        int,
    communication_skills    int,
    punctuality             int,
    teamwork                int,
    problem_solving         int,
    professionalism          int,
    overall_rating          int,
    max_score               int DEFAULT 50,
    
    comments                text,
    strengths               text[],
    areas_for_improvement   text[],
    activity_approved       boolean DEFAULT false,
    remarks_file_url        text,
    digital_signature       text,
    status                  text DEFAULT 'draft', -- draft, submitted, finalized
    created_at              timestamptz DEFAULT now(),
    submitted_at            timestamptz
);

-- ----------------------------------------------------------
-- 5.13 DOCUMENTS (Universal File Store)
-- ----------------------------------------------------------
CREATE TABLE public.documents (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    uploaded_by     uuid NOT NULL REFERENCES public.profiles(user_id),
    document_type   public.document_type NOT NULL,
    file_name       text NOT NULL,
    file_url        text NOT NULL,
    file_size       bigint,
    mime_type       text,
    related_entity  text, -- student_internship, application, user, etc.
    related_id      uuid,
    metadata        jsonb DEFAULT '{}',
    is_verified     boolean DEFAULT false,
    verified_by     uuid REFERENCES public.profiles(user_id),
    verified_at     timestamptz,
    created_at      timestamptz DEFAULT now()
);

-- ----------------------------------------------------------
-- 5.14 CHAT MESSAGES
-- ----------------------------------------------------------
CREATE TABLE public.chat_messages (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id     uuid NOT NULL REFERENCES public.profiles(user_id),
    receiver_id   uuid NOT NULL REFERENCES public.profiles(user_id),
    message       text NOT NULL,
    message_type  text DEFAULT 'text', -- text, file, image, system
    file_url      text,
    is_read       boolean DEFAULT false,
    read_at       timestamptz,
    created_at    timestamptz DEFAULT now()
);

-- ----------------------------------------------------------
-- 5.15 ONLINE MEETINGS
-- ----------------------------------------------------------
CREATE TABLE public.online_meetings (
    id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    faculty_user_id   uuid NOT NULL REFERENCES public.profiles(user_id),
    student_user_id   uuid NOT NULL REFERENCES public.profiles(user_id),
    title             text,
    agenda            text,
    scheduled_at      timestamptz NOT NULL,
    duration_minutes  int DEFAULT 60,
    meeting_link      text,
    meeting_platform  text, -- google_meet, zoom, teams, etc.
    status            text DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
    notes             text,
    recording_url     text,
    created_at        timestamptz DEFAULT now()
);

-- ----------------------------------------------------------
-- 5.16 UNIVERSITY POLICIES
-- ----------------------------------------------------------
CREATE TABLE public.university_policies (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    policy_data     jsonb NOT NULL DEFAULT '{}',
    updated_at      timestamptz DEFAULT now()
);

-- ----------------------------------------------------------
-- 5.17 EVALUATION RULES
-- ----------------------------------------------------------
CREATE TABLE public.evaluation_rules (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    rules_data      jsonb NOT NULL DEFAULT '{}',
    updated_at      timestamptz DEFAULT now()
);

-- ============================================================
-- PHASE 6: SUPER ADMIN TABLES (Billing & Subscriptions)
-- ============================================================

-- ----------------------------------------------------------
-- 6.1 SUBSCRIPTIONS
-- ----------------------------------------------------------
CREATE TABLE public.subscriptions (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    plan_name       text NOT NULL, -- free, professional, enterprise
    status          text NOT NULL DEFAULT 'active', -- active, cancelled, expired, past_due
    start_date      date,
    end_date        date,
    price           numeric(10,2),
    billing_cycle   text, -- monthly, yearly
    features        jsonb DEFAULT '{}',
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz
);

-- ----------------------------------------------------------
-- 6.2 BILLING INVOICES
-- ----------------------------------------------------------
CREATE TABLE public.billing_invoices (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    invoice_number  text UNIQUE,
    amount          numeric(10,2) NOT NULL,
    currency        text DEFAULT 'USD',
    status          text DEFAULT 'unpaid', -- unpaid, paid, overdue, cancelled, refunded
    issued_at       timestamptz DEFAULT now(),
    paid_at         timestamptz,
    due_date        date,
    items           jsonb DEFAULT '[]',
    notes           text
);

-- ----------------------------------------------------------
-- 6.3 STORAGE ALLOCATIONS
-- ----------------------------------------------------------
CREATE TABLE public.storage_allocations (
    university_id   uuid PRIMARY KEY REFERENCES public.universities(id) ON DELETE CASCADE,
    total_bytes     bigint NOT NULL DEFAULT 10737418240,   -- 10 GB default
    used_bytes      bigint NOT NULL DEFAULT 0,
    updated_at      timestamptz DEFAULT now()
);

-- ============================================================
-- PHASE 7: HELPER FUNCTIONS
-- ============================================================

-- Get current user's university ID
CREATE OR REPLACE FUNCTION public.get_user_university_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT university_id FROM public.profiles
    WHERE user_id = auth.uid();
$$;

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sync profile data from auth.users
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS NULL AND NEW.user_id IS NOT NULL THEN
        SELECT raw_user_meta_data->>'email' INTO NEW.email
        FROM auth.users
        WHERE id = NEW.user_id;
    END IF;
    
    IF NEW.full_name IS NULL AND (NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL) THEN
        NEW.full_name = COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '');
        NEW.full_name = TRIM(NEW.full_name);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PHASE 8: TRIGGERS
-- ============================================================

-- Auto-update universities.updated_at
CREATE TRIGGER update_universities_updated_at
    BEFORE UPDATE ON public.universities
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update profiles.updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Sync email on profile insert/update
CREATE TRIGGER sync_profile_fields
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_email();

-- ============================================================
-- PHASE 9: INDEXES (Performance)
-- ============================================================

-- Profiles indexes
CREATE INDEX idx_profiles_university ON public.profiles(university_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_status ON public.profiles(status);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_full_name ON public.profiles(full_name);

-- Universities indexes
CREATE INDEX idx_universities_slug ON public.universities(slug);
CREATE INDEX idx_universities_domain ON public.universities(domain);
CREATE INDEX idx_universities_status ON public.universities(status);

-- Department/Program indexes
CREATE INDEX idx_departments_university ON public.departments(university_id);
CREATE INDEX idx_programs_university ON public.programs(university_id);
CREATE INDEX idx_programs_department ON public.programs(department_id);

-- Faculty/Student indexes
CREATE INDEX idx_faculty_university ON public.faculty(university_id);
CREATE INDEX idx_faculty_department ON public.faculty(department_id);
CREATE INDEX idx_students_university ON public.students(university_id);
CREATE INDEX idx_students_program ON public.students(program_id);

-- Company indexes
CREATE INDEX idx_companies_university ON public.companies(university_id);
CREATE INDEX idx_companies_active ON public.companies(is_active);

-- Internship indexes
CREATE INDEX idx_internships_university ON public.internships(university_id);
CREATE INDEX idx_internships_company ON public.internships(company_id);
CREATE INDEX idx_internships_active ON public.internships(is_active);

-- Application indexes
CREATE INDEX idx_applications_internship ON public.internship_applications(internship_id);
CREATE INDEX idx_applications_student ON public.internship_applications(student_id);
CREATE INDEX idx_applications_status ON public.internship_applications(status);

-- Student internship indexes
CREATE INDEX idx_student_internships_student ON public.student_internships(student_id);
CREATE INDEX idx_student_internships_internship ON public.student_internships(internship_id);
CREATE INDEX idx_student_internships_status ON public.student_internships(status);

-- Weekly logs indexes
CREATE INDEX idx_weekly_logs_internship ON public.weekly_logs(student_internship_id);
CREATE INDEX idx_weekly_logs_status ON public.weekly_logs(status);

-- Reports indexes
CREATE INDEX idx_reports_internship ON public.reports(student_internship_id);
CREATE INDEX idx_reports_status ON public.reports(status);

-- Attendance indexes
CREATE INDEX idx_attendance_internship ON public.attendance(student_internship_id);
CREATE INDEX idx_attendance_date ON public.attendance(date);

-- Evaluation indexes
CREATE INDEX idx_evaluations_internship ON public.evaluations(student_internship_id);
CREATE INDEX idx_evaluations_evaluator ON public.evaluations(evaluator_user_id);

-- Document indexes
CREATE INDEX idx_documents_university ON public.documents(university_id);
CREATE INDEX idx_documents_type ON public.documents(document_type);
CREATE INDEX idx_documents_entity ON public.documents(related_entity, related_id);

-- Chat indexes
CREATE INDEX idx_chat_sender ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_receiver ON public.chat_messages(receiver_id);
CREATE INDEX idx_chat_read ON public.chat_messages(is_read);

-- Meeting indexes
CREATE INDEX idx_meetings_faculty ON public.online_meetings(faculty_user_id);
CREATE INDEX idx_meetings_student ON public.online_meetings(student_user_id);
CREATE INDEX idx_meetings_status ON public.online_meetings(status);

-- Subscription indexes
CREATE INDEX idx_subscriptions_university ON public.subscriptions(university_id);
CREATE INDEX idx_invoices_university ON public.billing_invoices(university_id);

-- ============================================================
-- PHASE 10: ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internship_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_internships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_allocations ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------
-- PROFILES RLS Policies
-- ----------------------------------------------------------

-- Users can access their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- University members can see others in same university
CREATE POLICY "University isolation select" ON public.profiles
    FOR SELECT USING (university_id = public.get_user_university_id());

-- Super admin full access
CREATE POLICY "Super admin full access profiles" ON public.profiles
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- Service role can insert (for creating profiles during signup)
CREATE POLICY "Service role can insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (auth.role() = 'service_role' OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- ----------------------------------------------------------
-- UNIVERSITIES RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation universities" ON public.universities
    FOR ALL USING (id = public.get_user_university_id());

CREATE POLICY "Super admin full access universities" ON public.universities
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- Everyone can view active universities (for marketplace)
CREATE POLICY "Anyone can view universities" ON public.universities
    FOR SELECT USING (status = 'active');

-- ----------------------------------------------------------
-- DEPARTMENTS RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation departments" ON public.departments
    FOR ALL USING (university_id = public.get_user_university_id());

CREATE POLICY "Super admin full access departments" ON public.departments
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- ----------------------------------------------------------
-- PROGRAMS RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation programs" ON public.programs
    FOR ALL USING (university_id = public.get_user_university_id());

CREATE POLICY "Super admin full access programs" ON public.programs
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- ----------------------------------------------------------
-- FACULTY RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation faculty" ON public.faculty
    FOR ALL USING (university_id = public.get_user_university_id());

CREATE POLICY "Super admin full access faculty" ON public.faculty
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- ----------------------------------------------------------
-- STUDENTS RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation students" ON public.students
    FOR ALL USING (university_id = public.get_user_university_id());

CREATE POLICY "Super admin full access students" ON public.students
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- Students can view own record
CREATE POLICY "Students can view own record" ON public.students
    FOR SELECT USING (user_id IN (
        SELECT user_id FROM public.profiles WHERE user_id = auth.uid()
    ));

-- ----------------------------------------------------------
-- COMPANIES RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation companies" ON public.companies
    FOR ALL USING (university_id = public.get_user_university_id());

CREATE POLICY "Super admin full access companies" ON public.companies
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- ----------------------------------------------------------
-- INTERNSHIPS RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation internships" ON public.internships
    FOR ALL USING (university_id = public.get_user_university_id());

CREATE POLICY "Super admin full access internships" ON public.internhips
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- Anyone can view active internships (marketplace)
CREATE POLICY "Anyone can view active internships" ON public.internships
    FOR SELECT USING (is_active = true);

-- ----------------------------------------------------------
-- APPLICATIONS RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation applications" ON public.internship_applications
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.internships 
        WHERE id = internship_id AND university_id = public.get_user_university_id()
    ));

CREATE POLICY "Super admin full access applications" ON public.internship_applications
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- Students can view own applications
CREATE POLICY "Students can view own applications" ON public.internship_applications
    FOR SELECT USING (student_id IN (
        SELECT id FROM public.students WHERE user_id = auth.uid()
    ));

-- ----------------------------------------------------------
-- STUDENT INTERNSHIPS RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation student_internships" ON public.student_internships
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.internships 
        WHERE id = internship_id AND university_id = public.get_user_university_id()
    ));

CREATE POLICY "Super admin full access student_internships" ON public.student_internships
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- ----------------------------------------------------------
-- WEEKLY LOGS RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation weekly_logs" ON public.weekly_logs
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.student_internships si
        JOIN public.internships i ON i.id = si.internship_id
        WHERE si.id = student_internship_id AND i.university_id = public.get_user_university_id()
    ));

CREATE POLICY "Super admin full access weekly_logs" ON public.weekly_logs
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- Students can manage own logs
CREATE POLICY "Students can manage own logs" ON public.weekly_logs
    FOR ALL USING (student_internship_id IN (
        SELECT id FROM public.student_internships 
        WHERE student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    ));

-- ----------------------------------------------------------
-- REPORTS RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation reports" ON public.reports
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.student_internships si
        JOIN public.internships i ON i.id = si.internship_id
        WHERE si.id = student_internship_id AND i.university_id = public.get_user_university_id()
    ));

CREATE POLICY "Super admin full access reports" ON public.reports
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- ----------------------------------------------------------
-- ATTENDANCE RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation attendance" ON public.attendance
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.student_internships si
        JOIN public.internships i ON i.id = si.internship_id
        WHERE si.id = student_internship_id AND i.university_id = public.get_user_university_id()
    ));

CREATE POLICY "Super admin full access attendance" ON public.attendance
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- ----------------------------------------------------------
-- EVALUATIONS RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation evaluations" ON public.evaluations
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.student_internships si
        JOIN public.internships i ON i.id = si.internship_id
        WHERE si.id = student_internship_id AND i.university_id = public.get_user_university_id()
    ));

CREATE POLICY "Super admin full access evaluations" ON public.evaluations
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- Evaluators can manage own evaluations
CREATE POLICY "Evaluators can manage evaluations" ON public.evaluations
    FOR ALL USING (evaluator_user_id = auth.uid());

-- ----------------------------------------------------------
-- DOCUMENTS RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "University isolation documents" ON public.documents
    FOR ALL USING (university_id = public.get_user_university_id());

CREATE POLICY "Super admin full access documents" ON public.documents
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- ----------------------------------------------------------
-- CHAT MESSAGES RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "Chat participants can view messages" ON public.chat_messages
    FOR SELECT USING (
        sender_id = auth.uid() OR receiver_id = auth.uid()
    );

CREATE POLICY "Users can send messages" ON public.chat_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
    );

CREATE POLICY "Users can update own messages" ON public.chat_messages
    FOR UPDATE USING (sender_id = auth.uid());

-- ----------------------------------------------------------
-- ONLINE MEETINGS RLS Policies
-- ----------------------------------------------------------

CREATE POLICY "Meeting participants can view" ON public.online_meetings
    FOR SELECT USING (
        faculty_user_id = auth.uid() OR student_user_id = auth.uid()
    );

CREATE POLICY "Faculty can create meetings" ON public.online_meetings
    FOR INSERT WITH CHECK (faculty_user_id = auth.uid());

CREATE POLICY "Faculty can update meetings" ON public.online_meetings
    FOR UPDATE USING (faculty_user_id = auth.uid());

-- ----------------------------------------------------------
-- SUBSCRIPTIONS/BILLING RLS (Super Admin Only)
-- ----------------------------------------------------------

CREATE POLICY "Super admin only subscriptions" ON public.subscriptions
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

CREATE POLICY "Super admin only invoices" ON public.billing_invoices
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

CREATE POLICY "Super admin only storage" ON public.storage_allocations
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ));

-- ============================================================
-- PHASE 11: SEED DATA (Optional Default Admin)
-- ============================================================

-- Note: Uncomment below to create a default super admin after first auth user registers
-- This should be run manually after you create your Supabase auth account

/*
INSERT INTO public.profiles (user_id, role, full_name, email, status)
SELECT 
    id, 
    'super_admin'::user_role,
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'email',
    'active'
FROM auth.users 
WHERE email = 'your-admin@email.com'
ON CONFLICT (user_id) DO NOTHING;
*/

-- ============================================================
-- COMPLETE!
-- ============================================================
-- Verify installation with:
--
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' ORDER BY table_name;
--
-- Should return 23 tables:
-- attendance, billing_invoices, chat_messages, companies, 
-- departments, documents, evaluations, faculty, internships, 
-- internship_applications, online_meetings, platform_settings, 
-- programs, profiles, reports, storage_allocations, 
-- student_internships, students, subscriptions, universities, 
-- university_policies, evaluation_rules, weekly_logs
-- ============================================================
