-- ============================================================================
-- InternHub.pk — Optional seed data
-- ----------------------------------------------------------------------------
-- This file is OPTIONAL. It creates a few universities, departments,
-- programs, and a single demo company so the platform is not empty on first
-- boot. It does NOT create any users (auth.users). All user accounts must be
-- created via Supabase Auth and then promoted via the bootstrap functions in
-- 0004_bootstrap_admin.sql.
--
-- Run order: 0001 → 0002 → 0003 → 0004 → (optionally) 0005_seed
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Universities
-- ----------------------------------------------------------------------------
INSERT INTO universities (id, name, slug, domain, city, country, contact_email, is_active, license_tier)
VALUES
  ('6a6a6a6a-0000-0000-0000-000000000001', 'International Islamic University Islamabad', 'iiui', 'iiui.edu.pk', 'Islamabad', 'Pakistan', 'registrar@iiui.edu.pk', true, 'professional'),
  ('6a6a6a6a-0000-0000-0000-000000000002', 'COMSATS University Islamabad', 'comsats', 'comsats.edu.pk', 'Islamabad', 'Pakistan', 'registrar@comsats.edu.pk', true, 'professional'),
  ('6a6a6a6a-0000-0000-0000-000000000003', 'National University of Sciences & Technology', 'nust', 'nust.edu.pk', 'Islamabad', 'Pakistan', 'registrar@nust.edu.pk', true, 'enterprise')
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Departments (one per university as example)
-- ----------------------------------------------------------------------------
INSERT INTO departments (id, university_id, name, code, is_active)
VALUES
  ('7b7b7b7b-0000-0000-0000-000000000001', '6a6a6a6a-0000-0000-0000-000000000001', 'Department of Computer Science', 'CS', true),
  ('7b7b7b7b-0000-0000-0000-000000000002', '6a6a6a6a-0000-0000-0000-000000000001', 'Department of Management Sciences', 'MGMT', true),
  ('7b7b7b7b-0000-0000-0000-000000000003', '6a6a6a6a-0000-0000-0000-000000000002', 'Department of Computer Science', 'CS', true),
  ('7b7b7b7b-0000-0000-0000-000000000004', '6a6a6a6a-0000-0000-0000-000000000003', 'School of Electrical Engineering & Computer Science', 'SEECS', true)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Programs
-- ----------------------------------------------------------------------------
INSERT INTO programs (id, university_id, department_id, name, code, duration_weeks, is_active)
VALUES
  ('8c8c8c8c-0000-0000-0000-000000000001', '6a6a6a6a-0000-0000-0000-000000000001', '7b7b7b7b-0000-0000-0000-000000000001', 'BS Computer Science', 'BSCS', 16, true),
  ('8c8c8c8c-0000-0000-0000-000000000002', '6a6a6a6a-0000-0000-0000-000000000001', '7b7b7b7b-0000-0000-0000-000000000002', 'BBA', 'BBA', 16, true),
  ('8c8c8c8c-0000-0000-0000-000000000003', '6a6a6a6a-0000-0000-0000-000000000002', '7b7b7b7b-0000-0000-0000-000000000003', 'BS Software Engineering', 'BSSE', 16, true),
  ('8c8c8c8c-0000-0000-0000-000000000004', '6a6a6a6a-0000-0000-0000-000000000003', '7b7b7b7b-0000-0000-0000-000000000004', 'BS Computer Engineering', 'BCE', 16, true)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Companies
-- ----------------------------------------------------------------------------
INSERT INTO companies (id, name, slug, industry, website, city, country, contact_email, is_verified, is_active)
VALUES
  ('9d9d9d9d-0000-0000-0000-000000000001', 'Systems Limited', 'systems-limited', 'Information Technology', 'https://www.systemsltd.com', 'Lahore', 'Pakistan', 'careers@systemsltd.com', true, true),
  ('9d9d9d9d-0000-0000-0000-000000000002', 'NetSol Technologies', 'netsol', 'Information Technology', 'https://www.netsoltech.com', 'Lahore', 'Pakistan', 'careers@netsoltech.com', true, true),
  ('9d9d9d9d-0000-0000-0000-000000000003', 'Engro Corporation', 'engro', 'Diversified', 'https://www.engro.com', 'Karachi', 'Pakistan', 'careers@engro.com', true, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- End of 0005_seed.sql
-- ============================================================================
