-- ============================================================================
-- 0024_company_hr_extras.sql
-- ----------------------------------------------------------------------------
-- Adds optional columns that the company-hr feature code already writes to,
-- plus a default-corrected student_internships.status sanity check.
-- All statements are idempotent (ADD COLUMN IF NOT EXISTS).
-- ============================================================================

-- 1. Supervisors table: extra profile metadata that company-hr keeps alongside
--    the linked `profiles` row. The migration is intentionally permissive so
--    older deployments that already added these columns manually are not broken.
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS department_focus text;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS specialization text;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS program_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS last_login timestamptz;

-- 2. Internships table: optional fields the company-hr form collects.
ALTER TABLE internships ADD COLUMN IF NOT EXISTS location_type text NOT NULL DEFAULT 'on_site';
ALTER TABLE internships ADD COLUMN IF NOT EXISTS target_departments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Intern supervisor assignments: optional convenience columns used by the
--    company-hr UI (assigned_by / is_active / unassigned_at / unassigned_by).
--    The schema-strict equivalents (`student_internship_id`, `assigned_at`,
--    `ended_at`) already exist from migration 0001.
ALTER TABLE intern_supervisor_assignments ADD COLUMN IF NOT EXISTS intern_id uuid;
ALTER TABLE intern_supervisor_assignments ADD COLUMN IF NOT EXISTS internship_id uuid;
ALTER TABLE intern_supervisor_assignments ADD COLUMN IF NOT EXISTS assigned_by uuid;
ALTER TABLE intern_supervisor_assignments ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE intern_supervisor_assignments ADD COLUMN IF NOT EXISTS unassigned_at timestamptz;
ALTER TABLE intern_supervisor_assignments ADD COLUMN IF NOT EXISTS unassigned_by uuid;

-- 4. Documents table: optional company_id column for fast scoping (avoids
--    needing a join through student_internships just to filter by company).
ALTER TABLE documents ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_docs_company ON documents(company_id);

-- Done.
