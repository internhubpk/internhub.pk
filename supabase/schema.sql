-- ============================================================================
-- INTERNHUB.PK — ENTERPRISE MULTI-TENANT SAAS DATABASE SCHEMA
-- ============================================================================
-- Platform:      Multi-Tenant SaaS — one system, many universities
--                 (internhub.pk -> IIUI, COMSATS, NUST, ... each isolated)
-- Target:        Supabase (PostgreSQL 15+)
-- Regenerated:   Rebuilt from scratch to match src/lib/validations.ts,
--                src/types/index.ts and every `.from("...")` call actually
--                used in the Next.js codebase (github.com/internhubpk/internhub.pk),
--                while fixing the data-model bugs found in the previous script:
--
--   FIXES APPLIED VS. THE OLD SCHEMA
--   ---------------------------------------------------------------------
--   1. `companies` and `host_organizations` were two different tables for
--      the same entity (company/host-organization). Some routes wrote to
--      one, some to the other -> data silently split across two tables.
--      FIX: single canonical `companies` table with every column both
--      routes need, plus an updatable compatibility VIEW named
--      `host_organizations` so already-shipped code keeps working.
--   2. `internship_applications` is the real table used by every API
--      route, but several dashboard pages queried `applications` directly
--      -> "relation does not exist" errors.
--      FIX: real table is `internship_applications`; compatibility VIEW
--      `applications` added.
--   3. Some routes check `companies.status` (text: active/suspended),
--      others check `companies.is_active` / `is_verified` (booleans).
--      FIX: schema now has all three, kept in sync with a trigger.
--   4. `company_users` was referenced (company_id, user_id, role,
--      first_name, last_name, email, is_active) but never created.
--   5. `supervisors`, `external_evaluators`, `licenses`, `settings`,
--      `messages`, `audit_logs` were used throughout the app but did not
--      exist in the old script at all -> every one of those API routes
--      was failing. All are now created with the exact columns the code
--      reads/writes.
--   6. `profiles` didn't have `first_name` / `last_name`, which every
--      relational join (`profiles:user_id(first_name,last_name)`) needs.
--   7. Status/enum values now match `src/lib/validations.ts` exactly
--      (e.g. application_status = pending/under_review/approved/
--      rejected/withdrawn, not the old applied/university_approved/...).
--   8. Every foreign key that should cascade / null-out on tenant
--      deletion now does so consistently, and every table used by the
--      app has RLS + is university-isolated by default.
--
--   NOTE ON "excluding separate db for each university": all universities
--   share one Postgres database/schema (this file). Isolation is done at
--   the row level via `university_id` + Row Level Security, exactly like
--   the original design intended — that IS the standard multi-tenant SaaS
--   pattern (single system, many tenants) described in the spec.
-- ============================================================================


-- ============================================================================
-- PHASE 0 — CLEAN SLATE
-- ============================================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
  FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', r.viewname);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.get_user_university_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.sync_profile_fields() CASCADE;
DROP FUNCTION IF EXISTS public.sync_company_status() CASCADE;
DROP FUNCTION IF EXISTS public.bump_internship_applicant_count() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_auth_user() CASCADE;

DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.document_type CASCADE;

-- ============================================================================
-- PHASE 1 — EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PHASE 2 — ENUM TYPES
-- (kept as real enums only for stable, foundational fields; every
--  workflow status below uses text + CHECK so product rules can evolve
--  with a simple migration instead of a risky ALTER TYPE)
-- ============================================================================

CREATE TYPE public.user_role AS ENUM (
  'super_admin',              -- Software house: billing, licensing, analytics
  'university_admin',         -- University internship office (HEC)
  'department_coordinator',   -- Scoped to one department
  'faculty_supervisor',       -- HEC faculty supervisor duties
  'student',
  'company_hr',                -- Host-organization / company user
  'site_supervisor',          -- On-site supervisor at the company
  'external_evaluator'        -- Optional industry expert evaluator
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
  'digital_signature',
  'resume',
  'cover_letter',
  'transcript',
  'other'
);

-- ============================================================================
-- PHASE 3 — PLATFORM CORE (Super Admin layer)
-- ============================================================================

-- ----------------------------------------------------------------------
-- 3.1 UNIVERSITIES — every tenant. Created only by super_admin.
-- ----------------------------------------------------------------------
CREATE TABLE public.universities (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,
  logo_url          text,
  domain            text UNIQUE,
  subdomain         text UNIQUE,
  website           text,
  address           text,
  contact_email     text,
  contact_phone     text,
  description       text,
  primary_color     text DEFAULT '#3B82F6',
  secondary_color   text DEFAULT '#10B981',
  license_tier      text NOT NULL DEFAULT 'free'
                      CHECK (license_tier IN ('free','basic','professional','enterprise')),
  license_expires_at timestamptz,
  max_students      integer,
  settings          jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','inactive','suspended')),
  is_active         boolean NOT NULL DEFAULT true,
  created_by        uuid,                       -- FK added after profiles exists
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.universities IS 'Tenants of the InternHub SaaS platform. Each university gets its own logo, colors, (sub)domain, users, students and reports, isolated purely by RLS on university_id — no separate databases.';

-- ----------------------------------------------------------------------
-- 3.2 PROFILES — every human in the system (1 row per auth.users row)
-- ----------------------------------------------------------------------
CREATE TABLE public.profiles (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            public.user_role NOT NULL,
  university_id   uuid REFERENCES public.universities(id) ON DELETE SET NULL,
  department_id   uuid,                         -- FK added after departments exists
  company_id      uuid,                         -- FK added after companies exists
  full_name       text,
  first_name      text,
  last_name       text,
  email           text,
  phone           text,
  bio             text,
  avatar_url      text,
  student_id      text,                         -- convenience: enrollment number, if role=student
  company_name    text,                         -- convenience denormalized label, if role=company_hr
  job_title       text,
  organization    text,
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','suspended','pending_setup')),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'One row per auth.users row. role decides which dashboard and RLS policies apply.';

ALTER TABLE public.universities
  ADD CONSTRAINT universities_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------
-- 3.3 PLATFORM SETTINGS (legacy simple key/value, kept for backwards compat)
-- ----------------------------------------------------------------------
CREATE TABLE public.platform_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------
-- 3.4 SETTINGS — scoped platform/university config actually used by
--     /api/settings (key + scope + optional university_id + category)
-- ----------------------------------------------------------------------
CREATE TABLE public.settings (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key            text NOT NULL,
  value          jsonb NOT NULL DEFAULT 'null'::jsonb,
  scope          text NOT NULL DEFAULT 'platform' CHECK (scope IN ('platform','university')),
  university_id  uuid REFERENCES public.universities(id) ON DELETE CASCADE,
  category       text NOT NULL DEFAULT 'general',
  description    text,
  updated_by     uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, university_id, scope)
);

-- ----------------------------------------------------------------------
-- 3.5 LICENSES — subscription / licensing per university (super_admin only)
-- ----------------------------------------------------------------------
CREATE TABLE public.licenses (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id     uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  license_key       text NOT NULL UNIQUE,
  plan              text NOT NULL CHECK (plan IN ('free','basic','professional','enterprise')),
  user_limit        integer NOT NULL DEFAULT 100,
  storage_limit_mb  integer NOT NULL DEFAULT 1024,
  price             numeric(10,2) NOT NULL DEFAULT 0,
  auto_renew        boolean NOT NULL DEFAULT false,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','expired','cancelled','trial')),
  starts_at         timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------
-- 3.6 BILLING INVOICES — issued against a license
-- ----------------------------------------------------------------------
CREATE TABLE public.billing_invoices (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  license_id      uuid REFERENCES public.licenses(id) ON DELETE SET NULL,
  invoice_number  text UNIQUE,
  amount          numeric(10,2) NOT NULL,
  currency        text NOT NULL DEFAULT 'PKR',
  status          text NOT NULL DEFAULT 'unpaid'
                    CHECK (status IN ('unpaid','paid','overdue','cancelled','refunded')),
  issued_at       timestamptz NOT NULL DEFAULT now(),
  paid_at         timestamptz,
  due_date        date,
  items           jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes           text
);

-- ----------------------------------------------------------------------
-- 3.7 STORAGE ALLOCATIONS — per-university storage quota/usage
-- ----------------------------------------------------------------------
CREATE TABLE public.storage_allocations (
  university_id   uuid PRIMARY KEY REFERENCES public.universities(id) ON DELETE CASCADE,
  total_bytes     bigint NOT NULL DEFAULT 10737418240, -- 10 GB default
  used_bytes      bigint NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------
-- 3.8 AUDIT LOGS — compliance trail, written by src/lib/audit.ts
-- ----------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  action         text NOT NULL,
  entity_type    text NOT NULL,
  entity_id      uuid,
  university_id  uuid REFERENCES public.universities(id) ON DELETE SET NULL,
  user_id        uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  details        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address     text,
  user_agent     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- PHASE 4 — UNIVERSITY-SCOPED ACADEMIC STRUCTURE
-- ============================================================================

-- 4.1 DEPARTMENTS ------------------------------------------------------
CREATE TABLE public.departments (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id  uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name           text NOT NULL,
  code           text,
  description    text,
  head_id        uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id, code)
);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

-- 4.2 PROGRAMS (degree programs within a department) -------------------
CREATE TABLE public.programs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  department_id   uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name            text NOT NULL,
  code            text,
  degree_level    text, -- e.g. BS, MS, PhD
  duration_years  numeric(3,1),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 4.3 UNIVERSITY POLICIES & EVALUATION RULES (configurable, per docx) --
CREATE TABLE public.university_policies (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id  uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  policy_data    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id)
);

CREATE TABLE public.evaluation_rules (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id  uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  rules_data     jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id)
);

-- ============================================================================
-- PHASE 5 — PEOPLE: STUDENTS, SUPERVISORS, EVALUATORS
-- ============================================================================

-- 5.1 STUDENTS -----------------------------------------------------------
CREATE TABLE public.students (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id      uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  department_id      uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  program_id         uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  enrollment_number  text NOT NULL,
  semester           integer CHECK (semester BETWEEN 1 AND 20),
  cgpa               numeric(3,2) CHECK (cgpa BETWEEN 0 AND 4),
  status             text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','graduated','suspended','withdrawn')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (university_id, enrollment_number)
);

-- 5.2 SUPERVISORS — unifies faculty / site / external supervisors ------
-- (matches src/lib/validations.ts CreateSupervisorSchema exactly)
CREATE TABLE public.supervisors (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  type            text NOT NULL CHECK (type IN ('faculty','site','external')),
  department_id   uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  title           text,
  specialization  text,
  phone           text,
  email           text,
  max_interns     integer NOT NULL DEFAULT 10 CHECK (max_interns BETWEEN 1 AND 50),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type)
);

-- 5.3 EXTERNAL EVALUATORS — extra profile info for industry experts ----
CREATE TABLE public.external_evaluators (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id  uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  organization   text,
  designation    text,
  expertise      text,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','pending')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ============================================================================
-- PHASE 6 — COMPANIES / HOST ORGANIZATIONS + MARKETPLACE
-- ============================================================================

-- 6.1 COMPANIES (canonical — see header note #1 & #3) -------------------
CREATE TABLE public.companies (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id         uuid REFERENCES public.universities(id) ON DELETE CASCADE, -- null = platform-wide (super_admin owned)
  name                  text NOT NULL,
  slug                  text,
  logo_url              text,
  industry              text,
  website               text,
  size                  text CHECK (size IN ('small','medium','large','enterprise')),
  description           text,
  address               text,
  city                  text,
  country               text,
  phone                 text,
  email                 text,
  contact_person        text,
  contact_person_role   text,
  max_interns           integer NOT NULL DEFAULT 10 CHECK (max_interns BETWEEN 1 AND 500),
  is_verified           boolean NOT NULL DEFAULT false,
  is_active             boolean NOT NULL DEFAULT true,
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','suspended','pending')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

-- 6.2 COMPANY USERS — HR / admin staff belonging to a company ----------
CREATE TABLE public.company_users (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'hr' CHECK (role IN ('admin','hr','manager')),
  first_name  text,
  last_name   text,
  email       text,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','pending')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

-- 6.3 INTERNSHIPS — posted by companies, the marketplace listing -------
CREATE TABLE public.internships (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id         uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  company_id            uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  description           text NOT NULL,
  department_ids        uuid[] NOT NULL DEFAULT '{}',
  program_ids           uuid[] NOT NULL DEFAULT '{}',
  requirements          text,
  responsibilities      text,
  skills                text[] NOT NULL DEFAULT '{}',
  location              text,
  is_remote             boolean NOT NULL DEFAULT false,
  is_paid               boolean NOT NULL DEFAULT false,
  stipend               numeric(10,2),
  stipend_currency      text NOT NULL DEFAULT 'PKR',
  duration_weeks        integer NOT NULL CHECK (duration_weeks BETWEEN 1 AND 52),
  start_date            date,
  end_date              date,
  application_deadline  timestamptz,
  vacancies             integer NOT NULL DEFAULT 1 CHECK (vacancies BETWEEN 1 AND 1000),
  current_applicants    integer NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','published','closed','active','completed','cancelled','expired')),
  is_active             boolean NOT NULL DEFAULT true,
  created_by            uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 6.4 INTERNSHIP APPLICATIONS -------------------------------------------
CREATE TABLE public.internship_applications (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  internship_id         uuid NOT NULL REFERENCES public.internships(id) ON DELETE CASCADE,
  student_id            uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  cover_letter          text,
  resume_url            text,
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','under_review','approved','rejected','withdrawn')),
  company_response      text,
  university_response   text,
  applied_at            timestamptz NOT NULL DEFAULT now(),
  reviewed_at           timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (internship_id, student_id)
);

-- 6.5 STUDENT INTERNSHIPS — the active placement once approved ---------
CREATE TABLE public.student_internships (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id          uuid UNIQUE REFERENCES public.internship_applications(id) ON DELETE SET NULL,
  student_id              uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  internship_id           uuid NOT NULL REFERENCES public.internships(id) ON DELETE CASCADE,
  faculty_supervisor_id   uuid REFERENCES public.supervisors(id) ON DELETE SET NULL,
  site_supervisor_id      uuid REFERENCES public.supervisors(id) ON DELETE SET NULL,
  external_evaluator_id   uuid REFERENCES public.external_evaluators(id) ON DELETE SET NULL,
  start_date              date,
  end_date                date,
  working_hours_per_week  integer NOT NULL DEFAULT 40,
  transcript_status       text NOT NULL DEFAULT 'pending'
                            CHECK (transcript_status IN ('pending','approved','rejected')),
  status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','completed','terminated','paused')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- PHASE 7 — INTERNSHIP LIFECYCLE: LOGS, REPORTS, ATTENDANCE, EVALUATIONS
-- ============================================================================

-- 7.1 WEEKLY LOGS ---------------------------------------------------------
CREATE TABLE public.weekly_logs (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_internship_id   uuid NOT NULL REFERENCES public.student_internships(id) ON DELETE CASCADE,
  week_number             integer NOT NULL CHECK (week_number >= 1),
  week_start              date NOT NULL,
  week_end                date NOT NULL,
  tasks_completed         text,
  challenges              text,
  learnings               text,
  next_week_goals         text,
  hours_worked            numeric(5,2) NOT NULL DEFAULT 0 CHECK (hours_worked BETWEEN 0 AND 168),
  status                  text NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','submitted','approved','rejected')),
  reviewer_comments       text,
  reviewed_by             uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  reviewed_at             timestamptz,
  submitted_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_internship_id, week_number)
);

-- 7.2 REPORTS --------------------------------------------------------------
CREATE TABLE public.reports (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_internship_id   uuid NOT NULL REFERENCES public.student_internships(id) ON DELETE CASCADE,
  title                   text NOT NULL,
  content                 text,
  file_url                text,
  file_type               text,
  report_type             text NOT NULL CHECK (report_type IN ('weekly','monthly','final')),
  status                  text NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','submitted','under_review','approved','rejected')),
  reviewer_comments       text,
  reviewed_by             uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  submitted_at            timestamptz NOT NULL DEFAULT now(),
  reviewed_at             timestamptz
);

-- 7.3 ATTENDANCE -------------------------------------------------------
CREATE TABLE public.attendance (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_internship_id   uuid NOT NULL REFERENCES public.student_internships(id) ON DELETE CASCADE,
  date                    date NOT NULL DEFAULT CURRENT_DATE,
  check_in                timestamptz,
  check_out               timestamptz,
  hours_worked            numeric(4,2) CHECK (hours_worked BETWEEN 0 AND 24),
  status                  text NOT NULL DEFAULT 'present'
                            CHECK (status IN ('present','absent','late','half_day','leave','holiday')),
  notes                   text,
  location_lat            numeric(9,6),
  location_lng            numeric(9,6),
  verified                boolean NOT NULL DEFAULT false,
  recorded_by             uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_internship_id, date)
);

-- 7.4 EVALUATIONS — faculty / site / external / company evaluations ----
CREATE TABLE public.evaluations (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_internship_id   uuid NOT NULL REFERENCES public.student_internships(id) ON DELETE CASCADE,
  evaluator_id            uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  evaluator_type          text NOT NULL CHECK (evaluator_type IN ('faculty','site','external','company')),
  evaluation_period       text NOT NULL, -- e.g. "Week 3", "Midterm", "Final"
  criteria_scores         jsonb NOT NULL DEFAULT '{}'::jsonb, -- {"technical_skills":8,...}
  total_score             numeric(6,2),
  max_score                numeric(6,2) NOT NULL DEFAULT 100,
  comments                text,
  strengths               text,
  areas_for_improvement   text,
  activity_approved       boolean NOT NULL DEFAULT false,
  remarks_file_url        text,
  digital_signature       text,
  status                  text NOT NULL DEFAULT 'in_progress'
                            CHECK (status IN ('pending','in_progress','completed','approved')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  submitted_at            timestamptz
);

-- ============================================================================
-- PHASE 8 — DOCUMENTS, COMMUNICATION, MEETINGS, NOTIFICATIONS
-- ============================================================================

-- 8.1 DOCUMENTS — universal file store ---------------------------------
CREATE TABLE public.documents (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   uuid REFERENCES public.universities(id) ON DELETE CASCADE,
  uploaded_by     uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  document_type   public.document_type NOT NULL,
  entity_type     text NOT NULL
                    CHECK (entity_type IN ('student','internship','application','evaluation','company','weekly_log','report')),
  entity_id       uuid NOT NULL,
  file_name       text NOT NULL,
  file_url        text NOT NULL,
  file_size       bigint,
  mime_type       text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','verified','rejected','expired')),
  verified_by     uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  verified_at     timestamptz,
  expires_at      timestamptz,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 8.2 MESSAGES — direct messages / announcements (the "communications" API) --
CREATE TABLE public.messages (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id     uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  receiver_id   uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE, -- null = broadcast/announcement
  subject       text NOT NULL,
  content       text NOT NULL,
  type          text NOT NULL DEFAULT 'direct'
                  CHECK (type IN ('direct','announcement','notification','system')),
  is_read       boolean NOT NULL DEFAULT false,
  read_at       timestamptz,
  thread_id     uuid,
  attachments   text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 8.3 ONLINE MEETINGS — faculty <-> student video meetings --------------
CREATE TABLE public.online_meetings (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_user_id   uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  student_user_id   uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title             text,
  agenda            text,
  scheduled_at      timestamptz NOT NULL,
  duration_minutes  integer NOT NULL DEFAULT 60,
  meeting_link      text,
  meeting_platform  text, -- google_meet, zoom, teams
  status            text NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  notes             text,
  recording_url     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 8.4 NOTIFICATIONS — in-app notification center ------------------------
CREATE TABLE public.notifications (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title        text NOT NULL,
  message      text NOT NULL,
  category     text NOT NULL DEFAULT 'system'
                 CHECK (category IN ('auth','application','evaluation','deadline','system','announcement')),
  priority     text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  is_read      boolean NOT NULL DEFAULT false,
  action_url   text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- PHASE 9 — COMPATIBILITY VIEWS (fixes table-name drift found in the app)
-- ============================================================================

-- Some dashboard pages call `.from("applications")` while every API route
-- calls `.from("internship_applications")`. Both now resolve to the same data.
CREATE VIEW public.applications AS
  SELECT * FROM public.internship_applications;

-- Some routes call `.from("host_organizations")`, others `.from("companies")`.
-- Both now resolve to the same data.
CREATE VIEW public.host_organizations AS
  SELECT * FROM public.companies;

-- ============================================================================
-- PHASE 10 — HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_university_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT university_id FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Keep profiles.full_name / email in sync when first/last name or auth data changes
CREATE OR REPLACE FUNCTION public.sync_profile_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.email IS NULL THEN
    SELECT email INTO NEW.email FROM auth.users WHERE id = NEW.user_id;
  END IF;

  IF (NEW.full_name IS NULL OR NEW.full_name = '')
     AND (NEW.first_name IS NOT NULL OR NEW.last_name IS NOT NULL) THEN
    NEW.full_name := TRIM(COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,''));
  END IF;

  RETURN NEW;
END;
$$;

-- Keep companies.status <-> companies.is_active in sync (fixes issue #3)
CREATE OR REPLACE FUNCTION public.sync_company_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_active = false AND NEW.status = 'active' THEN
      NEW.status := 'suspended';
    ELSIF NEW.is_active = true AND NEW.status = 'suspended' THEN
      NEW.status := 'active';
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE' from here on, OLD is safe to reference
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active = false AND NEW.status = 'active' THEN
      NEW.status := 'suspended';
    ELSIF NEW.is_active = true AND NEW.status = 'suspended' THEN
      NEW.status := 'active';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.is_active := (NEW.status <> 'suspended');
  END IF;

  RETURN NEW;
END;
$$;

-- Auto-create a profile row whenever a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role, email, full_name, status, is_active)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student'),
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'pending_setup',
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Keep internships.current_applicants accurate
CREATE OR REPLACE FUNCTION public.bump_internship_applicant_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.internships SET current_applicants = current_applicants + 1 WHERE id = NEW.internship_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.internships SET current_applicants = GREATEST(current_applicants - 1, 0) WHERE id = OLD.internship_id;
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================================================
-- PHASE 11 — TRIGGERS
-- ============================================================================

CREATE TRIGGER trg_universities_updated_at BEFORE UPDATE ON public.universities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_profiles_sync BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_fields();

CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_supervisors_updated_at BEFORE UPDATE ON public.supervisors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_companies_status_sync BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.sync_company_status();

CREATE TRIGGER trg_internships_updated_at BEFORE UPDATE ON public.internships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON public.internship_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_applications_applicant_count
  AFTER INSERT OR DELETE ON public.internship_applications
  FOR EACH ROW EXECUTE FUNCTION public.bump_internship_applicant_count();

CREATE TRIGGER trg_student_internships_updated_at BEFORE UPDATE ON public.student_internships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_weekly_logs_updated_at BEFORE UPDATE ON public.weekly_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_evaluations_updated_at BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_licenses_updated_at BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-provision a profile row on signup (safe no-op if you create profiles
-- manually server-side instead — ON CONFLICT DO NOTHING above).
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- PHASE 12 — INDEXES
-- ============================================================================

CREATE INDEX idx_profiles_university ON public.profiles(university_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_company ON public.profiles(company_id);
CREATE INDEX idx_profiles_department ON public.profiles(department_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);

CREATE INDEX idx_universities_slug ON public.universities(slug);
CREATE INDEX idx_universities_status ON public.universities(status);

CREATE INDEX idx_departments_university ON public.departments(university_id);
CREATE INDEX idx_programs_university ON public.programs(university_id);
CREATE INDEX idx_programs_department ON public.programs(department_id);

CREATE INDEX idx_students_university ON public.students(university_id);
CREATE INDEX idx_students_user ON public.students(user_id);
CREATE INDEX idx_students_program ON public.students(program_id);

CREATE INDEX idx_supervisors_university ON public.supervisors(university_id);
CREATE INDEX idx_supervisors_type ON public.supervisors(type);
CREATE INDEX idx_supervisors_user ON public.supervisors(user_id);

CREATE INDEX idx_external_evaluators_university ON public.external_evaluators(university_id);

CREATE INDEX idx_companies_university ON public.companies(university_id);
CREATE INDEX idx_companies_active ON public.companies(is_active);
CREATE INDEX idx_companies_verified ON public.companies(is_verified);
CREATE INDEX idx_company_users_company ON public.company_users(company_id);
CREATE INDEX idx_company_users_user ON public.company_users(user_id);

CREATE INDEX idx_internships_university ON public.internships(university_id);
CREATE INDEX idx_internships_company ON public.internships(company_id);
CREATE INDEX idx_internships_status ON public.internships(status);
CREATE INDEX idx_internships_active ON public.internships(is_active);

CREATE INDEX idx_applications_internship ON public.internship_applications(internship_id);
CREATE INDEX idx_applications_student ON public.internship_applications(student_id);
CREATE INDEX idx_applications_status ON public.internship_applications(status);

CREATE INDEX idx_student_internships_student ON public.student_internships(student_id);
CREATE INDEX idx_student_internships_internship ON public.student_internships(internship_id);
CREATE INDEX idx_student_internships_status ON public.student_internships(status);
CREATE INDEX idx_student_internships_faculty ON public.student_internships(faculty_supervisor_id);
CREATE INDEX idx_student_internships_site ON public.student_internships(site_supervisor_id);

CREATE INDEX idx_weekly_logs_internship ON public.weekly_logs(student_internship_id);
CREATE INDEX idx_weekly_logs_status ON public.weekly_logs(status);

CREATE INDEX idx_reports_internship ON public.reports(student_internship_id);
CREATE INDEX idx_reports_status ON public.reports(status);

CREATE INDEX idx_attendance_internship ON public.attendance(student_internship_id);
CREATE INDEX idx_attendance_date ON public.attendance(date);

CREATE INDEX idx_evaluations_internship ON public.evaluations(student_internship_id);
CREATE INDEX idx_evaluations_evaluator ON public.evaluations(evaluator_id);
CREATE INDEX idx_evaluations_status ON public.evaluations(status);

CREATE INDEX idx_documents_university ON public.documents(university_id);
CREATE INDEX idx_documents_type ON public.documents(document_type);
CREATE INDEX idx_documents_entity ON public.documents(entity_type, entity_id);

CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX idx_messages_read ON public.messages(is_read);
CREATE INDEX idx_messages_thread ON public.messages(thread_id);

CREATE INDEX idx_meetings_faculty ON public.online_meetings(faculty_user_id);
CREATE INDEX idx_meetings_student ON public.online_meetings(student_user_id);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(is_read);

CREATE INDEX idx_licenses_university ON public.licenses(university_id);
CREATE INDEX idx_invoices_university ON public.billing_invoices(university_id);

CREATE INDEX idx_audit_logs_university ON public.audit_logs(university_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

CREATE INDEX idx_settings_scope ON public.settings(scope, university_id);

-- ============================================================================
-- PHASE 13 — ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_allocations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_policies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_evaluators   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internships           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internship_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_internships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_meetings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "profiles_university_select" ON public.profiles
  FOR SELECT USING (university_id IS NOT NULL AND university_id = public.get_user_university_id());

CREATE POLICY "profiles_super_admin_all" ON public.profiles
  FOR ALL USING (public.is_super_admin());

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR auth.role() = 'service_role'
    OR public.is_super_admin()
    OR public.get_user_role() = 'university_admin'
  );

-- ---------------------------------------------------------------------
-- UNIVERSITIES
-- ---------------------------------------------------------------------
CREATE POLICY "universities_public_select_active" ON public.universities
  FOR SELECT USING (status = 'active');

CREATE POLICY "universities_own_tenant" ON public.universities
  FOR ALL USING (id = public.get_user_university_id());

CREATE POLICY "universities_super_admin_all" ON public.universities
  FOR ALL USING (public.is_super_admin());

-- ---------------------------------------------------------------------
-- SUPER-ADMIN-ONLY PLATFORM TABLES
-- ---------------------------------------------------------------------
CREATE POLICY "platform_settings_super_admin" ON public.platform_settings
  FOR ALL USING (public.is_super_admin());

CREATE POLICY "licenses_super_admin" ON public.licenses
  FOR ALL USING (public.is_super_admin());

CREATE POLICY "invoices_super_admin" ON public.billing_invoices
  FOR ALL USING (public.is_super_admin());

CREATE POLICY "storage_super_admin" ON public.storage_allocations
  FOR ALL USING (public.is_super_admin());

CREATE POLICY "audit_logs_super_admin_select" ON public.audit_logs
  FOR SELECT USING (public.is_super_admin() OR university_id = public.get_user_university_id());

CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------
-- SETTINGS
-- ---------------------------------------------------------------------
CREATE POLICY "settings_platform_read" ON public.settings
  FOR SELECT USING (scope = 'platform' OR university_id = public.get_user_university_id());

CREATE POLICY "settings_write" ON public.settings
  FOR ALL USING (
    public.is_super_admin()
    OR (scope = 'university' AND university_id = public.get_user_university_id()
        AND public.get_user_role() IN ('university_admin'))
  );

-- ---------------------------------------------------------------------
-- ACADEMIC STRUCTURE — university isolation, standard pattern
-- ---------------------------------------------------------------------
CREATE POLICY "departments_isolation" ON public.departments
  FOR ALL USING (university_id = public.get_user_university_id());
CREATE POLICY "departments_super_admin" ON public.departments
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "departments_public_select" ON public.departments
  FOR SELECT USING (is_active = true);

CREATE POLICY "programs_isolation" ON public.programs
  FOR ALL USING (university_id = public.get_user_university_id());
CREATE POLICY "programs_super_admin" ON public.programs
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "programs_public_select" ON public.programs
  FOR SELECT USING (is_active = true);

CREATE POLICY "policies_isolation" ON public.university_policies
  FOR ALL USING (university_id = public.get_user_university_id());
CREATE POLICY "policies_super_admin" ON public.university_policies
  FOR ALL USING (public.is_super_admin());

CREATE POLICY "eval_rules_isolation" ON public.evaluation_rules
  FOR ALL USING (university_id = public.get_user_university_id());
CREATE POLICY "eval_rules_super_admin" ON public.evaluation_rules
  FOR ALL USING (public.is_super_admin());

-- ---------------------------------------------------------------------
-- STUDENTS
-- ---------------------------------------------------------------------
CREATE POLICY "students_isolation" ON public.students
  FOR ALL USING (university_id = public.get_user_university_id());
CREATE POLICY "students_super_admin" ON public.students
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "students_self_select" ON public.students
  FOR SELECT USING (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- SUPERVISORS / EXTERNAL EVALUATORS
-- ---------------------------------------------------------------------
CREATE POLICY "supervisors_isolation" ON public.supervisors
  FOR ALL USING (university_id = public.get_user_university_id());
CREATE POLICY "supervisors_super_admin" ON public.supervisors
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "supervisors_self_select" ON public.supervisors
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "external_evaluators_isolation" ON public.external_evaluators
  FOR ALL USING (university_id = public.get_user_university_id());
CREATE POLICY "external_evaluators_super_admin" ON public.external_evaluators
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "external_evaluators_self_select" ON public.external_evaluators
  FOR SELECT USING (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- COMPANIES / COMPANY USERS (marketplace-visible)
-- ---------------------------------------------------------------------
CREATE POLICY "companies_public_marketplace" ON public.companies
  FOR SELECT USING (is_verified = true AND is_active = true);

CREATE POLICY "companies_isolation" ON public.companies
  FOR ALL USING (university_id IS NOT NULL AND university_id = public.get_user_university_id());

CREATE POLICY "companies_own_company" ON public.companies
  FOR SELECT USING (id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));

CREATE POLICY "companies_hr_manage_own" ON public.companies
  FOR UPDATE USING (id IN (
    SELECT company_id FROM public.company_users
    WHERE user_id = auth.uid() AND role IN ('admin','hr')
  ));

CREATE POLICY "companies_super_admin" ON public.companies
  FOR ALL USING (public.is_super_admin());

CREATE POLICY "company_users_self" ON public.company_users
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "company_users_same_company" ON public.company_users
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));
CREATE POLICY "company_users_manage" ON public.company_users
  FOR ALL USING (
    public.is_super_admin()
    OR company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ---------------------------------------------------------------------
-- INTERNSHIPS (marketplace)
-- ---------------------------------------------------------------------
CREATE POLICY "internships_public_active" ON public.internships
  FOR SELECT USING (is_active = true AND status IN ('published','active'));

CREATE POLICY "internships_isolation" ON public.internships
  FOR ALL USING (university_id = public.get_user_university_id());

CREATE POLICY "internships_company_manage" ON public.internships
  FOR ALL USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));

CREATE POLICY "internships_super_admin" ON public.internships
  FOR ALL USING (public.is_super_admin());

-- ---------------------------------------------------------------------
-- APPLICATIONS
-- ---------------------------------------------------------------------
CREATE POLICY "applications_university_isolation" ON public.internship_applications
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.internships i
    WHERE i.id = internship_id AND i.university_id = public.get_user_university_id()
  ));

CREATE POLICY "applications_student_own" ON public.internship_applications
  FOR ALL USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE POLICY "applications_company_view" ON public.internship_applications
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.internships i
    JOIN public.company_users cu ON cu.company_id = i.company_id
    WHERE i.id = internship_id AND cu.user_id = auth.uid()
  ));

CREATE POLICY "applications_super_admin" ON public.internship_applications
  FOR ALL USING (public.is_super_admin());

-- ---------------------------------------------------------------------
-- STUDENT INTERNSHIPS
-- ---------------------------------------------------------------------
CREATE POLICY "student_internships_isolation" ON public.student_internships
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.internships i
    WHERE i.id = internship_id AND i.university_id = public.get_user_university_id()
  ));

CREATE POLICY "student_internships_student_own" ON public.student_internships
  FOR SELECT USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE POLICY "student_internships_supervisor" ON public.student_internships
  FOR SELECT USING (
    faculty_supervisor_id IN (SELECT id FROM public.supervisors WHERE user_id = auth.uid())
    OR site_supervisor_id IN (SELECT id FROM public.supervisors WHERE user_id = auth.uid())
  );

CREATE POLICY "student_internships_super_admin" ON public.student_internships
  FOR ALL USING (public.is_super_admin());

-- ---------------------------------------------------------------------
-- WEEKLY LOGS / REPORTS / ATTENDANCE / EVALUATIONS
-- (all keyed off student_internship_id -> same isolation shape)
-- ---------------------------------------------------------------------
CREATE POLICY "weekly_logs_isolation" ON public.weekly_logs
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.student_internships si
    JOIN public.internships i ON i.id = si.internship_id
    WHERE si.id = student_internship_id AND i.university_id = public.get_user_university_id()
  ));
CREATE POLICY "weekly_logs_student_own" ON public.weekly_logs
  FOR ALL USING (student_internship_id IN (
    SELECT si.id FROM public.student_internships si
    JOIN public.students s ON s.id = si.student_id
    WHERE s.user_id = auth.uid()
  ));
CREATE POLICY "weekly_logs_super_admin" ON public.weekly_logs
  FOR ALL USING (public.is_super_admin());

CREATE POLICY "reports_isolation" ON public.reports
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.student_internships si
    JOIN public.internships i ON i.id = si.internship_id
    WHERE si.id = student_internship_id AND i.university_id = public.get_user_university_id()
  ));
CREATE POLICY "reports_student_own" ON public.reports
  FOR ALL USING (student_internship_id IN (
    SELECT si.id FROM public.student_internships si
    JOIN public.students s ON s.id = si.student_id
    WHERE s.user_id = auth.uid()
  ));
CREATE POLICY "reports_super_admin" ON public.reports
  FOR ALL USING (public.is_super_admin());

CREATE POLICY "attendance_isolation" ON public.attendance
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.student_internships si
    JOIN public.internships i ON i.id = si.internship_id
    WHERE si.id = student_internship_id AND i.university_id = public.get_user_university_id()
  ));
CREATE POLICY "attendance_student_own" ON public.attendance
  FOR SELECT USING (student_internship_id IN (
    SELECT si.id FROM public.student_internships si
    JOIN public.students s ON s.id = si.student_id
    WHERE s.user_id = auth.uid()
  ));
CREATE POLICY "attendance_super_admin" ON public.attendance
  FOR ALL USING (public.is_super_admin());

CREATE POLICY "evaluations_isolation" ON public.evaluations
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.student_internships si
    JOIN public.internships i ON i.id = si.internship_id
    WHERE si.id = student_internship_id AND i.university_id = public.get_user_university_id()
  ));
CREATE POLICY "evaluations_evaluator_own" ON public.evaluations
  FOR ALL USING (evaluator_id = auth.uid());
CREATE POLICY "evaluations_student_view" ON public.evaluations
  FOR SELECT USING (student_internship_id IN (
    SELECT si.id FROM public.student_internships si
    JOIN public.students s ON s.id = si.student_id
    WHERE s.user_id = auth.uid()
  ));
CREATE POLICY "evaluations_super_admin" ON public.evaluations
  FOR ALL USING (public.is_super_admin());

-- ---------------------------------------------------------------------
-- DOCUMENTS
-- ---------------------------------------------------------------------
CREATE POLICY "documents_isolation" ON public.documents
  FOR ALL USING (university_id = public.get_user_university_id());
CREATE POLICY "documents_owner" ON public.documents
  FOR ALL USING (uploaded_by = auth.uid());
CREATE POLICY "documents_super_admin" ON public.documents
  FOR ALL USING (public.is_super_admin());

-- ---------------------------------------------------------------------
-- MESSAGES
-- ---------------------------------------------------------------------
CREATE POLICY "messages_participants_select" ON public.messages
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "messages_send" ON public.messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- ---------------------------------------------------------------------
-- ONLINE MEETINGS
-- ---------------------------------------------------------------------
CREATE POLICY "meetings_participants_select" ON public.online_meetings
  FOR SELECT USING (faculty_user_id = auth.uid() OR student_user_id = auth.uid());
CREATE POLICY "meetings_faculty_create" ON public.online_meetings
  FOR INSERT WITH CHECK (faculty_user_id = auth.uid());
CREATE POLICY "meetings_faculty_update" ON public.online_meetings
  FOR UPDATE USING (faculty_user_id = auth.uid());

-- ---------------------------------------------------------------------
-- NOTIFICATIONS
-- ---------------------------------------------------------------------
CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- PHASE 14 — GRANTS (Supabase Data API / PostgREST needs these too)
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.universities, public.internships, public.companies,
  public.host_organizations, public.profiles, public.departments, public.programs
  TO anon;

GRANT EXECUTE ON FUNCTION public.get_user_university_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

GRANT USAGE ON TYPE public.user_role TO authenticated, anon;
GRANT USAGE ON TYPE public.document_type TO authenticated, anon;

-- Grant on the compatibility views explicitly (views don't inherit table grants)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.host_organizations TO authenticated;
GRANT SELECT ON public.applications, public.host_organizations TO anon;

-- ============================================================================
-- PHASE 15 — SEED (run manually once you have your first auth user)
-- ============================================================================
-- UPDATE public.profiles SET role = 'super_admin', status = 'active'
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'internhub.pk@gmail.com');

-- ============================================================================
-- DONE — verify with:
--   SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;
--   SELECT viewname FROM pg_views WHERE schemaname = 'public';
-- ============================================================================
