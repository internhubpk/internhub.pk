-- ============================================================================
-- InternHub.pk — Initial Schema Migration
-- Multi-tenant University Internship Management Platform
-- ----------------------------------------------------------------------------
-- This migration creates the complete normalized PostgreSQL schema for
-- InternHub on Supabase. It is idempotent: every object uses CREATE TABLE IF
-- NOT EXISTS / CREATE EXTENSION IF NOT EXISTS so it can be safely re-run.
--
-- Design principles:
--   * UUID primary keys (except `profiles.user_id` which mirrors auth.users.id)
--   * Explicit foreign keys with intentionally-chosen ON DELETE behavior
--   * CHECK constraints for enums / status values
--   * Timestamps with sensible defaults
--   * Indexes on every column used by RLS predicates or hot lookups
--   * No plaintext passwords, no custom auth tables — Supabase Auth is the
--     source of truth for authentication; this schema only stores profile /
--     tenant / operational data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Enumerated types
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'super_admin',
    'university_admin',
    'department_coordinator',
    'faculty_supervisor',
    'student',
    'company_hr',
    'site_supervisor',
    'external_evaluator',
    'pending_assignment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE internship_status AS ENUM ('draft','open','active','completed','cancelled','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE application_status AS ENUM ('pending','reviewing','accepted','rejected','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE evaluation_type AS ENUM ('weekly_log','midterm','final','company_evaluation','supervisor_evaluation','task');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE evaluation_status AS ENUM ('pending','in_progress','submitted','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE weekly_log_status AS ENUM ('draft','submitted','approved','rejected','revision_required');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_type AS ENUM ('resume','cover_letter','transcript','offer_letter','weekly_report','evaluation_form','certificate','cv','task_attachment','signature','internship_letter','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('pending','verified','rejected','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present','absent','late','half_day','leave','holiday');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('direct','announcement','notification','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_category AS ENUM ('auth','application','evaluation','deadline','system','announcement','task','attendance','certificate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM ('low','medium','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE supervisor_type AS ENUM ('faculty','site','external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE student_internship_status AS ENUM ('assigned','active','paused','completed','terminated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE license_tier AS ENUM ('free','professional','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('draft','published','closed','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_submission_status AS ENUM ('pending','submitted','resubmitted','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE certificate_status AS ENUM ('draft','issued','revoked','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE profile_status AS ENUM ('pending','active','suspended','disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. Universities
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS universities (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  domain          text UNIQUE,
  logo_url        text,
  address         text,
  city            text,
  state           text,
  country         text,
  contact_email   text,
  contact_phone   text,
  is_active       boolean NOT NULL DEFAULT true,
  license_tier    license_tier NOT NULL DEFAULT 'free',
  license_expires_at timestamptz,
  max_students    integer,
  settings        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `universities` exists (idempotent against older partial deployments).
ALTER TABLE universities ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS domain text;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS license_tier license_tier;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS license_expires_at timestamptz;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS max_students integer;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS settings jsonb;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_universities_slug ON universities(slug);
CREATE INDEX IF NOT EXISTS idx_universities_active ON universities(is_active);

-- ----------------------------------------------------------------------------
-- 3. Departments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name            text NOT NULL,
  code            text,
  head_id         uuid, -- references profiles.user_id, set after profiles table; FK added below
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id, code),
  -- Composite uniqueness on (id, university_id) so that downstream tables (programs,
  -- students, supervisors, internships) can use a composite foreign key to enforce
  -- "this department belongs to the same university" at the database level without
  -- relying on a CHECK subquery (which PostgreSQL does not support).
  UNIQUE (id, university_id)
);

-- Defensive: ensure every column of `departments` exists (idempotent against older partial deployments).
ALTER TABLE departments ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS head_id uuid;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_departments_university ON departments(university_id);

-- Idempotently add the composite uniqueness constraint required by the programs
-- composite FK below. Older deployments of this migration did not include it.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
      WHERE conrelid = 'departments'::regclass
        AND conname = 'departments_id_university_id_key'
  ) THEN
    ALTER TABLE departments
      ADD CONSTRAINT departments_id_university_id_key UNIQUE (id, university_id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Programs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id   uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name            text NOT NULL,
  code            text,
  description     text,
  duration_weeks  integer,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Enforce that the program's department belongs to the SAME university.
  -- Implemented as a composite foreign key (preferred over a CHECK subquery,
  -- which PostgreSQL does not support — SQLSTATE 0A000).
  -- Together with the (department_id → departments.id) FK above, this guarantees
  -- both: department exists, AND department.university_id = programs.university_id.
  FOREIGN KEY (department_id, university_id)
    REFERENCES departments(id, university_id)
    ON DELETE CASCADE,
  UNIQUE (id, department_id)
);

-- Defensive: ensure every column of `programs` exists (idempotent against older partial deployments).
ALTER TABLE programs ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS duration_weeks integer;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_programs_university ON programs(university_id);
CREATE INDEX IF NOT EXISTS idx_programs_department ON programs(department_id);

-- Idempotently add the composite uniqueness constraint required by downstream
-- composite FKs (students, supervisors, internships reference programs via
-- (program_id, department_id)).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
      WHERE conrelid = 'programs'::regclass
        AND conname = 'programs_id_department_id_key'
  ) THEN
    ALTER TABLE programs
      ADD CONSTRAINT programs_id_department_id_key UNIQUE (id, department_id);
  END IF;
END $$;

-- Idempotently add the composite FK from programs(department_id, university_id)
-- to departments(id, university_id). Older deployments of this migration used
-- an invalid CHECK subquery instead; if that legacy constraint still exists on
-- the table, drop it first. We also skip adding the FK if any equivalent
-- composite FK already exists (e.g. created inline by CREATE TABLE on a fresh
-- database).
DO $$ BEGIN
  ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_dept_in_uni;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
      WHERE conrelid = 'programs'::regclass
        AND confrelid = 'departments'::regclass
        AND contype = 'f'
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(conkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'programs'::regclass AND attname IN ('department_id', 'university_id'))
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(confkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'departments'::regclass AND attname IN ('id', 'university_id'))
  ) THEN
    ALTER TABLE programs
      ADD CONSTRAINT programs_dept_in_uni_fk
      FOREIGN KEY (department_id, university_id)
      REFERENCES departments(id, university_id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Companies (a.k.a. host organizations)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  logo_url        text,
  industry        text,
  website         text,
  size            text,
  description     text,
  address         text,
  city            text,
  country         text,
  contact_person  text,
  contact_email   text NOT NULL,
  contact_phone   text,
  is_verified     boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  university_id   uuid REFERENCES universities(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `companies` exists (idempotent against older partial deployments).
ALTER TABLE companies ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS size text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_verified boolean;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_companies_university ON companies(university_id);
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active);
CREATE INDEX IF NOT EXISTS idx_companies_verified ON companies(is_verified);

-- ----------------------------------------------------------------------------
-- 6. Profiles — one row per auth.users row
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  username        text UNIQUE,
  full_name       text,
  first_name      text,
  last_name       text,
  role            user_role NOT NULL DEFAULT 'pending_assignment',
  avatar_url      text,
  phone           text,
  bio             text,
  university_id   uuid REFERENCES universities(id) ON DELETE SET NULL,
  department_id   uuid REFERENCES departments(id) ON DELETE SET NULL,
  program_id      uuid REFERENCES programs(id) ON DELETE SET NULL,
  company_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  status          profile_status NOT NULL DEFAULT 'pending',
  is_active       boolean NOT NULL DEFAULT true,
  -- role-specific convenience fields
  student_id_number text,
  company_name    text,
  job_title       text,
  organization    text,
  github_url      text,
  linkedin_url    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `profiles` exists (idempotent against older partial deployments).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role user_role;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS program_id uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status profile_status;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_id_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Make sure the unique constraint on username exists (idempotent).
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_university ON profiles(university_id);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_program ON profiles(program_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Now that profiles exists, add FK from departments.head_id -> profiles.user_id
DO $$ BEGIN
  ALTER TABLE departments
    ADD CONSTRAINT departments_head_fk
    FOREIGN KEY (head_id) REFERENCES profiles(user_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 7. Students — extension table for student-specific academic data
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  user_id             uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  university_id       uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  department_id       uuid REFERENCES departments(id) ON DELETE SET NULL,
  program_id          uuid REFERENCES programs(id) ON DELETE SET NULL,
  enrollment_year     integer,
  expected_graduation date,
  cgpa                numeric(3,2),
  student_id_number   text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Composite FKs enforce cross-table integrity at the DB level:
  --  * if department_id is set, it must belong to the same university
  --  * if program_id is set, it must belong to the same department
  -- (PostgreSQL MATCH SIMPLE allows NULL columns to skip the check, which is
  -- the desired behavior since department_id / program_id are optional.)
  FOREIGN KEY (department_id, university_id)
    REFERENCES departments(id, university_id)
    ON DELETE SET NULL,
  FOREIGN KEY (program_id, department_id)
    REFERENCES programs(id, department_id)
    ON DELETE SET NULL
);

-- Defensive: ensure every column of `students` exists (idempotent against older partial deployments).
ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE students ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE students ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE students ADD COLUMN IF NOT EXISTS program_id uuid;
ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_year integer;
ALTER TABLE students ADD COLUMN IF NOT EXISTS expected_graduation date;
ALTER TABLE students ADD COLUMN IF NOT EXISTS cgpa numeric(3,2);
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_id_number text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_students_university ON students(university_id);
CREATE INDEX IF NOT EXISTS idx_students_department ON students(department_id);
CREATE INDEX IF NOT EXISTS idx_students_program ON students(program_id);

-- Idempotently add composite FKs for students (older deployments lacked them).
-- Skip if an equivalent composite FK already exists (created inline by
-- CREATE TABLE on a fresh database).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
      WHERE conrelid = 'students'::regclass
        AND confrelid = 'departments'::regclass
        AND contype = 'f'
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(conkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'students'::regclass AND attname IN ('department_id', 'university_id'))
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(confkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'departments'::regclass AND attname IN ('id', 'university_id'))
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_dept_in_uni_fk
      FOREIGN KEY (department_id, university_id)
      REFERENCES departments(id, university_id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
      WHERE conrelid = 'students'::regclass
        AND confrelid = 'programs'::regclass
        AND contype = 'f'
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(conkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'students'::regclass AND attname IN ('program_id', 'department_id'))
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(confkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'programs'::regclass AND attname IN ('id', 'department_id'))
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_prog_in_dept_fk
      FOREIGN KEY (program_id, department_id)
      REFERENCES programs(id, department_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. Supervisors — extension table for supervisor-type users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supervisors (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  type            supervisor_type NOT NULL,
  university_id   uuid REFERENCES universities(id) ON DELETE CASCADE,
  department_id   uuid REFERENCES departments(id) ON DELETE SET NULL,
  program_id      uuid REFERENCES programs(id) ON DELETE SET NULL,
  company_id      uuid REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Composite FKs enforce cross-table integrity (NULLs skip per MATCH SIMPLE):
  --  * if department_id is set, it must belong to the same university
  --  * if program_id is set, it must belong to the same department
  FOREIGN KEY (department_id, university_id)
    REFERENCES departments(id, university_id)
    ON DELETE SET NULL,
  FOREIGN KEY (program_id, department_id)
    REFERENCES programs(id, department_id)
    ON DELETE SET NULL
);

-- Defensive: ensure every column of `supervisors` exists (idempotent against older partial deployments).
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS type supervisor_type;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS program_id uuid;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS employee_id text;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_supervisors_user ON supervisors(user_id);
CREATE INDEX IF NOT EXISTS idx_supervisors_type ON supervisors(type);
CREATE INDEX IF NOT EXISTS idx_supervisors_university ON supervisors(university_id);
CREATE INDEX IF NOT EXISTS idx_supervisors_company ON supervisors(company_id);
CREATE INDEX IF NOT EXISTS idx_supervisors_department ON supervisors(department_id);
CREATE INDEX IF NOT EXISTS idx_supervisors_program ON supervisors(program_id);

-- Idempotently add composite FKs for supervisors (older deployments lacked them).
-- Skip if an equivalent composite FK already exists (created inline by
-- CREATE TABLE on a fresh database).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
      WHERE conrelid = 'supervisors'::regclass
        AND confrelid = 'departments'::regclass
        AND contype = 'f'
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(conkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'supervisors'::regclass AND attname IN ('department_id', 'university_id'))
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(confkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'departments'::regclass AND attname IN ('id', 'university_id'))
  ) THEN
    ALTER TABLE supervisors
      ADD CONSTRAINT supervisors_dept_in_uni_fk
      FOREIGN KEY (department_id, university_id)
      REFERENCES departments(id, university_id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
      WHERE conrelid = 'supervisors'::regclass
        AND confrelid = 'programs'::regclass
        AND contype = 'f'
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(conkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'supervisors'::regclass AND attname IN ('program_id', 'department_id'))
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(confkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'programs'::regclass AND attname IN ('id', 'department_id'))
  ) THEN
    ALTER TABLE supervisors
      ADD CONSTRAINT supervisors_prog_in_dept_fk
      FOREIGN KEY (program_id, department_id)
      REFERENCES programs(id, department_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 9. Company users (membership table)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_users (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

-- Defensive: ensure every column of `company_users` exists (idempotent against older partial deployments).
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_company_users_company ON company_users(company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_user ON company_users(user_id);

-- ----------------------------------------------------------------------------
-- 10. Internships
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internships (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           text NOT NULL,
  description     text,
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  university_id   uuid REFERENCES universities(id) ON DELETE CASCADE,
  department_id   uuid REFERENCES departments(id) ON DELETE SET NULL,
  program_id      uuid REFERENCES programs(id) ON DELETE SET NULL,
  location        text,
  remote          boolean NOT NULL DEFAULT false,
  is_paid         boolean NOT NULL DEFAULT false,
  stipend         numeric(12,2),
  stipend_currency text NOT NULL DEFAULT 'PKR',
  duration_weeks  integer,
  status          internship_status NOT NULL DEFAULT 'draft',
  required_skills text[] NOT NULL DEFAULT '{}',
  requirements    text[] NOT NULL DEFAULT '{}',
  benefits        text[] NOT NULL DEFAULT '{}',
  max_applicants  integer,
  current_applicants integer NOT NULL DEFAULT 0,
  start_date      date,
  end_date        date,
  application_deadline timestamptz,
  created_by      uuid NOT NULL REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Composite FKs enforce cross-table integrity (NULLs skip per MATCH SIMPLE):
  --  * if department_id is set, it must belong to the same university
  --  * if program_id is set, it must belong to the same department
  FOREIGN KEY (department_id, university_id)
    REFERENCES departments(id, university_id)
    ON DELETE SET NULL,
  FOREIGN KEY (program_id, department_id)
    REFERENCES programs(id, department_id)
    ON DELETE SET NULL
);

-- Defensive: ensure every column of `internships` exists (idempotent against older partial deployments).
ALTER TABLE internships ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS program_id uuid;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS remote boolean;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS is_paid boolean;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS stipend numeric(12,2);
ALTER TABLE internships ADD COLUMN IF NOT EXISTS stipend_currency text;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS duration_weeks integer;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS status internship_status;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS required_skills text[];
ALTER TABLE internships ADD COLUMN IF NOT EXISTS requirements text[];
ALTER TABLE internships ADD COLUMN IF NOT EXISTS benefits text[];
ALTER TABLE internships ADD COLUMN IF NOT EXISTS max_applicants integer;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS current_applicants integer;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS application_deadline timestamptz;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_internships_company ON internships(company_id);
CREATE INDEX IF NOT EXISTS idx_internships_university ON internships(university_id);
CREATE INDEX IF NOT EXISTS idx_internships_department ON internships(department_id);
CREATE INDEX IF NOT EXISTS idx_internships_program ON internships(program_id);
CREATE INDEX IF NOT EXISTS idx_internships_status ON internships(status);
CREATE INDEX IF NOT EXISTS idx_internships_created_by ON internships(created_by);

-- Idempotently add composite FKs for internships (older deployments lacked them).
-- Skip if an equivalent composite FK already exists (created inline by
-- CREATE TABLE on a fresh database).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
      WHERE conrelid = 'internships'::regclass
        AND confrelid = 'departments'::regclass
        AND contype = 'f'
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(conkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'internships'::regclass AND attname IN ('department_id', 'university_id'))
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(confkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'departments'::regclass AND attname IN ('id', 'university_id'))
  ) THEN
    ALTER TABLE internships
      ADD CONSTRAINT internships_dept_in_uni_fk
      FOREIGN KEY (department_id, university_id)
      REFERENCES departments(id, university_id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
      WHERE conrelid = 'internships'::regclass
        AND confrelid = 'programs'::regclass
        AND contype = 'f'
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(conkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'internships'::regclass AND attname IN ('program_id', 'department_id'))
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(confkey::int2[]) AS x) = (SELECT array_agg(attnum ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'programs'::regclass AND attname IN ('id', 'department_id'))
  ) THEN
    ALTER TABLE internships
      ADD CONSTRAINT internships_prog_in_dept_fk
      FOREIGN KEY (program_id, department_id)
      REFERENCES programs(id, department_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 11. Internship applications (alias `applications`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS internship_applications (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  internship_id   uuid NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cover_letter    text,
  resume_url      text,
  status          application_status NOT NULL DEFAULT 'pending',
  applied_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (internship_id, student_user_id)
);

-- Defensive: ensure every column of `internship_applications` exists (idempotent against older partial deployments).
ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS internship_id uuid;
ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS student_user_id uuid;
ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS cover_letter text;
ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS resume_url text;
ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS status application_status;
ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE internship_applications ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_applications_internship ON internship_applications(internship_id);
CREATE INDEX IF NOT EXISTS idx_applications_student ON internship_applications(student_user_id);
CREATE INDEX IF NOT EXISTS idx_applications_company ON internship_applications(company_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON internship_applications(status);

-- Compatibility alias: `applications` view (read-only, mirrors internship_applications)
DROP VIEW IF EXISTS applications;
CREATE VIEW applications AS SELECT * FROM internship_applications;

-- ----------------------------------------------------------------------------
-- 12. Student internships — the assignment/active placement junction
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_internships (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_user_id          uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  internship_id            uuid NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  application_id           uuid REFERENCES internship_applications(id) ON DELETE SET NULL,
  company_id               uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  university_id            uuid REFERENCES universities(id) ON DELETE CASCADE,
  department_id            uuid REFERENCES departments(id) ON DELETE SET NULL,
  program_id               uuid REFERENCES programs(id) ON DELETE SET NULL,
  faculty_supervisor_id    uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  site_supervisor_id       uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  start_date               date NOT NULL,
  end_date                 date,
  status                   student_internship_status NOT NULL DEFAULT 'assigned',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_user_id, internship_id)
);

-- Defensive: ensure every column of `student_internships` exists (idempotent against older partial deployments).
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS student_user_id uuid;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS internship_id uuid;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS application_id uuid;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS program_id uuid;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS faculty_supervisor_id uuid;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS site_supervisor_id uuid;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS status student_internship_status;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_si_student ON student_internships(student_user_id);
CREATE INDEX IF NOT EXISTS idx_si_internship ON student_internships(internship_id);
CREATE INDEX IF NOT EXISTS idx_si_company ON student_internships(company_id);
CREATE INDEX IF NOT EXISTS idx_si_faculty ON student_internships(faculty_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_si_site ON student_internships(site_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_si_university ON student_internships(university_id);
CREATE INDEX IF NOT EXISTS idx_si_department ON student_internships(department_id);
CREATE INDEX IF NOT EXISTS idx_si_program ON student_internships(program_id);

-- ----------------------------------------------------------------------------
-- 13. Intern supervisor assignments — historical / multi-supervisor log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intern_supervisor_assignments (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_internship_id uuid NOT NULL REFERENCES student_internships(id) ON DELETE CASCADE,
  supervisor_id       uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  type                supervisor_type NOT NULL,
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  ended_at            timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `intern_supervisor_assignments` exists (idempotent against older partial deployments).
ALTER TABLE intern_supervisor_assignments ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE intern_supervisor_assignments ADD COLUMN IF NOT EXISTS student_internship_id uuid;
ALTER TABLE intern_supervisor_assignments ADD COLUMN IF NOT EXISTS supervisor_id uuid;
ALTER TABLE intern_supervisor_assignments ADD COLUMN IF NOT EXISTS type supervisor_type;
ALTER TABLE intern_supervisor_assignments ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE intern_supervisor_assignments ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE intern_supervisor_assignments ADD COLUMN IF NOT EXISTS created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_isa_student_internship ON intern_supervisor_assignments(student_internship_id);
CREATE INDEX IF NOT EXISTS idx_isa_supervisor ON intern_supervisor_assignments(supervisor_id);

-- ----------------------------------------------------------------------------
-- 14. Tasks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id      uuid REFERENCES programs(id) ON DELETE CASCADE,
  internship_id   uuid REFERENCES internships(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES profiles(user_id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  instructions    text,
  due_date        timestamptz,
  max_score       numeric(5,2),
  is_published    boolean NOT NULL DEFAULT false,
  status          task_status NOT NULL DEFAULT 'draft',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- A task must be scoped to either a program OR an internship
  CONSTRAINT tasks_scope_check CHECK (program_id IS NOT NULL OR internship_id IS NOT NULL)
);

-- Defensive: ensure every column of `tasks` exists (idempotent against older partial deployments).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS program_id uuid;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS internship_id uuid;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS instructions text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS max_score numeric(5,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_published boolean;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status task_status;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_tasks_program ON tasks(program_id);
CREATE INDEX IF NOT EXISTS idx_tasks_internship ON tasks(internship_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ----------------------------------------------------------------------------
-- 15. Task assignments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_assignments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  assigned_by     uuid NOT NULL REFERENCES profiles(user_id) ON DELETE SET NULL,
  due_date        timestamptz,
  status          task_submission_status NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, student_user_id)
);

-- Defensive: ensure every column of `task_assignments` exists (idempotent against older partial deployments).
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS task_id uuid;
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS student_user_id uuid;
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS assigned_by uuid;
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS due_date timestamptz;
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS status task_submission_status;
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_ta_task ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_ta_student ON task_assignments(student_user_id);
CREATE INDEX IF NOT EXISTS idx_ta_assigned_by ON task_assignments(assigned_by);

-- ----------------------------------------------------------------------------
-- 16. Task submissions (alias `submissions`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_submissions (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_assignment_id  uuid NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
  task_id             uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  student_user_id     uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  content             text,
  attachment_urls     text[] NOT NULL DEFAULT '{}',
  status              task_submission_status NOT NULL DEFAULT 'submitted',
  score               numeric(5,2),
  feedback            text,
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  reviewed_at         timestamptz,
  reviewed_by         uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `task_submissions` exists (idempotent against older partial deployments).
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS task_assignment_id uuid;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS task_id uuid;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS student_user_id uuid;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS attachment_urls text[];
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS status task_submission_status;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS score numeric(5,2);
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS feedback text;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_ts_assignment ON task_submissions(task_assignment_id);
CREATE INDEX IF NOT EXISTS idx_ts_task ON task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_ts_student ON task_submissions(student_user_id);
CREATE INDEX IF NOT EXISTS idx_ts_reviewed_by ON task_submissions(reviewed_by);

DROP VIEW IF EXISTS submissions;
CREATE VIEW submissions AS SELECT * FROM task_submissions;

-- ----------------------------------------------------------------------------
-- 17. Task attachments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_attachments (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  file_url    text NOT NULL,
  file_size   integer,
  mime_type   text,
  uploaded_by uuid NOT NULL REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `task_attachments` exists (idempotent against older partial deployments).
ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS task_id uuid;
ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS file_size integer;
ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS uploaded_by uuid;
ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_tatt_task ON task_attachments(task_id);

-- ----------------------------------------------------------------------------
-- 18. Weekly logs (alias `weekly_reports`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_logs (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_user_id     uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  internship_id       uuid REFERENCES internships(id) ON DELETE CASCADE,
  student_internship_id uuid REFERENCES student_internships(id) ON DELETE SET NULL,
  week_number         integer NOT NULL,
  week_start_date     date NOT NULL,
  week_end_date       date NOT NULL,
  tasks_completed     text[] NOT NULL DEFAULT '{}',
  challenges          text,
  learnings           text,
  next_week_goals     text,
  hours_worked        numeric(5,2),
  status              weekly_log_status NOT NULL DEFAULT 'draft',
  supervisor_feedback text,
  supervisor_id       uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  reviewed_at         timestamptz,
  submitted_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_user_id, week_start_date, internship_id)
);

-- Defensive: ensure every column of `weekly_logs` exists (idempotent against older partial deployments).
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS student_user_id uuid;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS internship_id uuid;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS student_internship_id uuid;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS week_number integer;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS week_start_date date;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS week_end_date date;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS tasks_completed text[];
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS challenges text;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS learnings text;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS next_week_goals text;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS hours_worked numeric(5,2);
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS status weekly_log_status;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS supervisor_feedback text;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS supervisor_id uuid;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE weekly_logs ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_wl_student ON weekly_logs(student_user_id);
CREATE INDEX IF NOT EXISTS idx_wl_internship ON weekly_logs(internship_id);
CREATE INDEX IF NOT EXISTS idx_wl_supervisor ON weekly_logs(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_wl_status ON weekly_logs(status);

DROP VIEW IF EXISTS weekly_reports;
CREATE VIEW weekly_reports AS SELECT * FROM weekly_logs;

-- ----------------------------------------------------------------------------
-- 19. Evaluations — generic evaluations table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            evaluation_type NOT NULL,
  student_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  internship_id   uuid REFERENCES internships(id) ON DELETE CASCADE,
  student_internship_id uuid REFERENCES student_internships(id) ON DELETE SET NULL,
  task_id         uuid REFERENCES tasks(id) ON DELETE SET NULL,
  task_submission_id uuid REFERENCES task_submissions(id) ON DELETE SET NULL,
  evaluator_id    uuid NOT NULL REFERENCES profiles(user_id) ON DELETE SET NULL,
  evaluator_role  user_role NOT NULL,
  status          evaluation_status NOT NULL DEFAULT 'pending',
  scores          jsonb NOT NULL DEFAULT '{}'::jsonb,
  comments        text,
  rating          numeric(3,2) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  submitted_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `evaluations` exists (idempotent against older partial deployments).
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS type evaluation_type;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS student_user_id uuid;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS internship_id uuid;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS student_internship_id uuid;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS task_id uuid;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS task_submission_id uuid;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS evaluator_id uuid;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS evaluator_role user_role;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS status evaluation_status;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS scores jsonb;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS comments text;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS rating numeric(3,2);
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_eval_student ON evaluations(student_user_id);
CREATE INDEX IF NOT EXISTS idx_eval_internship ON evaluations(internship_id);
CREATE INDEX IF NOT EXISTS idx_eval_evaluator ON evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_eval_type ON evaluations(type);
CREATE INDEX IF NOT EXISTS idx_eval_status ON evaluations(status);

DROP VIEW IF EXISTS site_supervisor_evaluations;
CREATE VIEW site_supervisor_evaluations AS
  SELECT * FROM evaluations WHERE evaluator_role = 'site_supervisor';

DROP VIEW IF EXISTS faculty_evaluations;
CREATE VIEW faculty_evaluations AS
  SELECT * FROM evaluations WHERE evaluator_role = 'faculty_supervisor';

-- ----------------------------------------------------------------------------
-- 20. Attendance
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  internship_id   uuid NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  student_internship_id uuid REFERENCES student_internships(id) ON DELETE SET NULL,
  date            date NOT NULL,
  check_in        timestamptz,
  check_out       timestamptz,
  status          attendance_status NOT NULL DEFAULT 'present',
  notes           text,
  location_lat    numeric(9,6),
  location_lng    numeric(9,6),
  verified        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_user_id, internship_id, date)
);

-- Defensive: ensure every column of `attendance` exists (idempotent against older partial deployments).
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS student_user_id uuid;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS internship_id uuid;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS student_internship_id uuid;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in timestamptz;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out timestamptz;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status attendance_status;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS location_lat numeric(9,6);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS location_lng numeric(9,6);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS verified boolean;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_att_student ON attendance(student_user_id);
CREATE INDEX IF NOT EXISTS idx_att_internship ON attendance(internship_id);
CREATE INDEX IF NOT EXISTS idx_att_date ON attendance(date);

-- ----------------------------------------------------------------------------
-- 21. Certificates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificates (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  internship_id   uuid REFERENCES internships(id) ON DELETE SET NULL,
  university_id   uuid REFERENCES universities(id) ON DELETE CASCADE,
  company_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  title           text NOT NULL,
  certificate_number text UNIQUE,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  issued_by       uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  file_url        text,
  status          certificate_status NOT NULL DEFAULT 'draft',
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `certificates` exists (idempotent against older partial deployments).
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS student_user_id uuid;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS internship_id uuid;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS certificate_number text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS issued_at timestamptz;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS issued_by uuid;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS status certificate_status;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_certs_student ON certificates(student_user_id);
CREATE INDEX IF NOT EXISTS idx_certs_internship ON certificates(internship_id);
CREATE INDEX IF NOT EXISTS idx_certs_university ON certificates(university_id);
CREATE INDEX IF NOT EXISTS idx_certs_company ON certificates(company_id);

-- ----------------------------------------------------------------------------
-- 22. Documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  type            document_type NOT NULL,
  url             text NOT NULL,
  size            bigint,
  mime_type       text,
  uploaded_by     uuid NOT NULL REFERENCES profiles(user_id) ON DELETE SET NULL,
  entity_type     text NOT NULL CHECK (entity_type IN ('student','internship','application','evaluation','task','company','certificate','signature')),
  entity_id       uuid,
  status          document_status NOT NULL DEFAULT 'pending',
  verified_by     uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  verified_at     timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `documents` exists (idempotent against older partial deployments).
ALTER TABLE documents ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS type document_type;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS size bigint;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by uuid;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status document_status;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verified_by uuid;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_docs_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_docs_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_docs_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_docs_status ON documents(status);

-- ----------------------------------------------------------------------------
-- 23. CV uploads
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cv_uploads (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  file_url        text NOT NULL,
  file_size       bigint,
  file_name       text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `cv_uploads` exists (idempotent against older partial deployments).
ALTER TABLE cv_uploads ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE cv_uploads ADD COLUMN IF NOT EXISTS student_user_id uuid;
ALTER TABLE cv_uploads ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE cv_uploads ADD COLUMN IF NOT EXISTS file_size bigint;
ALTER TABLE cv_uploads ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE cv_uploads ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE cv_uploads ADD COLUMN IF NOT EXISTS created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_cv_student ON cv_uploads(student_user_id);
CREATE INDEX IF NOT EXISTS idx_cv_active ON cv_uploads(is_active);

-- ----------------------------------------------------------------------------
-- 24. Notifications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  sender_id       uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  title           text NOT NULL,
  message         text NOT NULL,
  category        notification_category NOT NULL DEFAULT 'system',
  priority        notification_priority NOT NULL DEFAULT 'medium',
  is_read         boolean NOT NULL DEFAULT false,
  action_url      text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `notifications` exists (idempotent against older partial deployments).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category notification_category;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority notification_priority;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read boolean;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_sender ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);

DROP VIEW IF EXISTS notification_recipients;
CREATE VIEW notification_recipients AS SELECT * FROM notifications;

DROP VIEW IF EXISTS notifications_sent;
CREATE VIEW notifications_sent AS
  SELECT * FROM notifications WHERE sender_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 25. Messages (direct messaging)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id       uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  receiver_id     uuid REFERENCES profiles(user_id) ON DELETE CASCADE,
  subject         text,
  content         text NOT NULL,
  type            message_type NOT NULL DEFAULT 'direct',
  is_read         boolean NOT NULL DEFAULT false,
  thread_id       uuid,
  attachments     text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `messages` exists (idempotent against older partial deployments).
ALTER TABLE messages ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_id uuid;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS receiver_id uuid;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS type message_type;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read boolean;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_id uuid;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments text[];
ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_msg_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_msg_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_msg_thread ON messages(thread_id);

-- ----------------------------------------------------------------------------
-- 26. Audit logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  action          text NOT NULL,
  entity_type     text NOT NULL,
  entity_id       uuid,
  university_id   uuid REFERENCES universities(id) ON DELETE SET NULL,
  details         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `audit_logs` exists (idempotent against older partial deployments).
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_university ON audit_logs(university_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 27. Platform settings (alias `settings`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key             text NOT NULL UNIQUE,
  value           jsonb NOT NULL,
  description     text,
  updated_by      uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `platform_settings` exists (idempotent against older partial deployments).
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS key text;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS value jsonb;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz;
DROP VIEW IF EXISTS settings;
CREATE VIEW settings AS SELECT * FROM platform_settings;

-- ----------------------------------------------------------------------------
-- 28. Storage allocations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storage_allocations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   uuid REFERENCES universities(id) ON DELETE CASCADE,
  bucket_name     text NOT NULL,
  allocated_bytes bigint NOT NULL DEFAULT 0,
  used_bytes      bigint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id, bucket_name)
);

-- Defensive: ensure every column of `storage_allocations` exists (idempotent against older partial deployments).
ALTER TABLE storage_allocations ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE storage_allocations ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE storage_allocations ADD COLUMN IF NOT EXISTS bucket_name text;
ALTER TABLE storage_allocations ADD COLUMN IF NOT EXISTS allocated_bytes bigint;
ALTER TABLE storage_allocations ADD COLUMN IF NOT EXISTS used_bytes bigint;
ALTER TABLE storage_allocations ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE storage_allocations ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_sa_university ON storage_allocations(university_id);

-- ----------------------------------------------------------------------------
-- 29. Licenses & subscriptions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS licenses (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   uuid REFERENCES universities(id) ON DELETE CASCADE,
  tier            license_tier NOT NULL DEFAULT 'free',
  features        jsonb NOT NULL DEFAULT '{}'::jsonb,
  limits          jsonb NOT NULL DEFAULT '{}'::jsonb,
  pricing_monthly numeric(12,2),
  pricing_annually numeric(12,2),
  expires_at      timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `licenses` exists (idempotent against older partial deployments).
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS tier license_tier;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS features jsonb;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS limits jsonb;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS pricing_monthly numeric(12,2);
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS pricing_annually numeric(12,2);
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS is_active boolean;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_licenses_university ON licenses(university_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  license_id      uuid REFERENCES licenses(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled','expired')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  ends_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `subscriptions` exists (idempotent against older partial deployments).
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS license_id uuid;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS ends_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_subs_university ON subscriptions(university_id);

-- ----------------------------------------------------------------------------
-- 30. Reports & templates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_templates (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id   uuid REFERENCES universities(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text NOT NULL,
  format          text NOT NULL DEFAULT 'csv',
  parameters      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `report_templates` exists (idempotent against older partial deployments).
ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS format text;
ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS parameters jsonb;
ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_rt_university ON report_templates(university_id);

CREATE TABLE IF NOT EXISTS reports (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  type            text NOT NULL,
  format          text NOT NULL DEFAULT 'csv',
  parameters      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid NOT NULL REFERENCES profiles(user_id) ON DELETE SET NULL,
  university_id   uuid REFERENCES universities(id) ON DELETE CASCADE,
  department_id   uuid REFERENCES departments(id) ON DELETE CASCADE,
  file_url        text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `reports` exists (idempotent against older partial deployments).
ALTER TABLE reports ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS format text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS parameters jsonb;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS university_id uuid;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_reports_university ON reports(university_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);

-- ----------------------------------------------------------------------------
-- 31. Supervisor remarks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supervisor_remarks (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  supervisor_id   uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  internship_id   uuid REFERENCES internships(id) ON DELETE CASCADE,
  remark          text NOT NULL,
  rating          numeric(3,2) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Defensive: ensure every column of `supervisor_remarks` exists (idempotent against older partial deployments).
ALTER TABLE supervisor_remarks ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE supervisor_remarks ADD COLUMN IF NOT EXISTS supervisor_id uuid;
ALTER TABLE supervisor_remarks ADD COLUMN IF NOT EXISTS student_user_id uuid;
ALTER TABLE supervisor_remarks ADD COLUMN IF NOT EXISTS internship_id uuid;
ALTER TABLE supervisor_remarks ADD COLUMN IF NOT EXISTS remark text;
ALTER TABLE supervisor_remarks ADD COLUMN IF NOT EXISTS rating numeric(3,2);
ALTER TABLE supervisor_remarks ADD COLUMN IF NOT EXISTS created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_sr_supervisor ON supervisor_remarks(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_sr_student ON supervisor_remarks(student_user_id);

-- ----------------------------------------------------------------------------
-- 32. External evaluators (extension table — mirrors supervisor rows of type='external')
-- ----------------------------------------------------------------------------
-- A simple view to satisfy any code that queries `external_evaluators` directly.
-- Note: we explicitly list columns to avoid duplicate-column errors (both
-- `supervisors` and `profiles` have university_id / department_id). The
-- supervisor row is the source of truth for scoping; the profile columns
-- (email, full_name) are joined in for convenience.
DROP VIEW IF EXISTS external_evaluators;
CREATE VIEW external_evaluators AS
  SELECT
    s.id, s.user_id, s.type, s.university_id, s.department_id, s.program_id,
    s.company_id, s.employee_id, s.is_active, s.created_at, s.updated_at,
    p.email, p.full_name
  FROM supervisors s
  JOIN profiles p ON p.user_id = s.user_id
  WHERE s.type = 'external';

-- ----------------------------------------------------------------------------
-- 33. site_supervisors view (alias for supervisors of type='site')
-- ----------------------------------------------------------------------------
-- Same approach: explicit columns to avoid duplicates. The profile's
-- company_id is exposed as `company_id_profile` for callers that need to
-- distinguish the supervisor's own company_id from the profile's company_id.
DROP VIEW IF EXISTS site_supervisors;
CREATE VIEW site_supervisors AS
  SELECT
    s.id, s.user_id, s.type, s.university_id, s.department_id, s.program_id,
    s.company_id, s.employee_id, s.is_active, s.created_at, s.updated_at,
    p.email, p.full_name, p.company_id AS company_id_profile
  FROM supervisors s
  JOIN profiles p ON p.user_id = s.user_id
  WHERE s.type = 'site';

-- ----------------------------------------------------------------------------
-- 34. host_organizations view (alias for companies)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS host_organizations;
CREATE VIEW host_organizations AS SELECT * FROM companies;

-- ----------------------------------------------------------------------------
-- 35. updated_at triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_universities
    BEFORE UPDATE ON universities
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_departments
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_programs
    BEFORE UPDATE ON programs
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_companies
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_students
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_supervisors
    BEFORE UPDATE ON supervisors
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_internships
    BEFORE UPDATE ON internships
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_internship_applications
    BEFORE UPDATE ON internship_applications
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_student_internships
    BEFORE UPDATE ON student_internships
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_tasks
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_task_assignments
    BEFORE UPDATE ON task_assignments
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_task_submissions
    BEFORE UPDATE ON task_submissions
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_weekly_logs
    BEFORE UPDATE ON weekly_logs
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_evaluations
    BEFORE UPDATE ON evaluations
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_certificates
    BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_licenses
    BEFORE UPDATE ON licenses
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_storage_allocations
    BEFORE UPDATE ON storage_allocations
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_platform_settings
    BEFORE UPDATE ON platform_settings
    FOR EACH ROW EXECUTE FUNCTION internhub_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 36. Auto-create profile when auth.users row is created
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role text;
  assigned_role user_role;
BEGIN
  meta_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.raw_app_meta_data->>'role',
    'pending_assignment'
  );
  assigned_role := CASE
    WHEN meta_role = 'super_admin' THEN 'super_admin'
    WHEN meta_role = 'university_admin' THEN 'university_admin'
    WHEN meta_role = 'department_coordinator' THEN 'department_coordinator'
    WHEN meta_role = 'faculty_supervisor' THEN 'faculty_supervisor'
    WHEN meta_role = 'student' THEN 'student'
    WHEN meta_role = 'company_hr' THEN 'company_hr'
    WHEN meta_role = 'site_supervisor' THEN 'site_supervisor'
    WHEN meta_role = 'external_evaluator' THEN 'external_evaluator'
    ELSE 'pending_assignment'
  END;

  INSERT INTO public.profiles (
    user_id, email, full_name, first_name, last_name, role,
    avatar_url, phone, status, is_active
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    assigned_role,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN assigned_role = 'pending_assignment' THEN 'pending' ELSE 'active' END,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION internhub_handle_new_user();

-- ----------------------------------------------------------------------------
-- 37. Attendance auto-create on task submission (Phase 14)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION internhub_touch_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  si_rec RECORD;
  att_exists boolean;
  att_date date := CURRENT_DATE;
BEGIN
  -- Find the active student_internships row for this student
  SELECT * INTO si_rec
    FROM student_internships
    WHERE student_user_id = NEW.student_user_id
      AND status IN ('assigned','active')
    ORDER BY created_at DESC
    LIMIT 1;

  IF si_rec.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Respect internship end date (do not record attendance after end_date)
  IF si_rec.end_date IS NOT NULL AND att_date > si_rec.end_date THEN
    RETURN NEW;
  END IF;

  -- Idempotent: skip if attendance already exists for today
  SELECT EXISTS(
    SELECT 1 FROM attendance
      WHERE student_user_id = NEW.student_user_id
        AND internship_id = si_rec.internship_id
        AND date = att_date
  ) INTO att_exists;

  IF NOT att_exists THEN
    INSERT INTO attendance (student_user_id, internship_id, student_internship_id, date, status, verified)
    VALUES (NEW.student_user_id, si_rec.internship_id, si_rec.id, att_date, 'present', true)
    ON CONFLICT (student_user_id, internship_id, date) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_task_submission_attendance ON task_submissions;
CREATE TRIGGER on_task_submission_attendance
  AFTER INSERT ON task_submissions
  FOR EACH ROW EXECUTE FUNCTION internhub_touch_attendance();

-- ============================================================================
-- End of 0001_initial_schema.sql
-- ============================================================================
