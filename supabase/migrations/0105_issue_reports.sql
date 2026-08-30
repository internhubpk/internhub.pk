-- 0105_issue_reports.sql
--
-- CONTEXT
-- -------
-- New "Report an Issue" feature:
--   - Any authenticated user can report an issue from the sidebar
--     (name + email autofilled from their profile, issue description
--     typed by the user).
--   - The reporting user can see and track the status of every issue
--     they've personally submitted (their own "My Issues" list).
--   - super_admin gets a platform-wide Issue Reports section and can move
--     each issue through: open -> working -> solved, or reject it.
--
-- SECURITY MODEL
-- ---------------
--   INSERT : any authenticated user, but ONLY as themselves
--            (reporter_user_id must equal auth.uid(); status is forced
--            to 'open' regardless of what the client sends).
--   SELECT : reporter sees their own rows; super_admin sees all rows.
--   UPDATE : ONLY super_admin may update (status / admin_note). The
--            reporter cannot edit their own report after submission —
--            this prevents a reporter tampering with status/admin_note
--            themselves, which would defeat the whole workflow.
--   DELETE : no one (including reporters) can delete via RLS; only
--            super_admin can, for cleanup of spam/duplicates.
--
-- Idempotent: safe to re-run.

-- ----------------------------------------------------------------------------
-- 1. Status enum
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE issue_status AS ENUM ('open', 'working', 'solved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. issue_reports table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_reports (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Who reported it. ON DELETE CASCADE: if the account is hard-deleted the
  -- report goes with it (matches the platform's existing hard-delete
  -- behavior for other user-owned tables).
  reporter_user_id  uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,

  -- Name/email are captured at submission time (autofilled from the
  -- profile in the UI, but stored as plain columns rather than joined
  -- live) so the record is still meaningful even if the profile's
  -- name/email later changes or the account is removed.
  name              text NOT NULL,
  email             text NOT NULL,
  issue             text NOT NULL,

  status            issue_status NOT NULL DEFAULT 'open',

  -- Optional note from the admin explaining a rejection or resolution.
  admin_note        text,
  -- Who last changed the status, and when.
  resolved_by       uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  resolved_at       timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT issue_reports_issue_not_blank CHECK (btrim(issue) <> ''),
  CONSTRAINT issue_reports_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT issue_reports_email_not_blank CHECK (btrim(email) <> '')
);

CREATE INDEX IF NOT EXISTS idx_issue_reports_reporter ON issue_reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_status ON issue_reports(status);
CREATE INDEX IF NOT EXISTS idx_issue_reports_created_at ON issue_reports(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. updated_at trigger
-- ----------------------------------------------------------------------------
-- NOTE: there is no shared updated_at trigger function currently active in
-- this schema (the old public.update_updated_at_column() was dropped in
-- 0028_security_hardening.sql), so this migration defines its own local
-- function rather than assuming one exists.
CREATE OR REPLACE FUNCTION issue_reports_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_issue_reports_updated_at ON issue_reports;
CREATE TRIGGER trg_issue_reports_updated_at
  BEFORE UPDATE ON issue_reports
  FOR EACH ROW
  EXECUTE FUNCTION issue_reports_set_updated_at();

-- Stamp resolved_by/resolved_at automatically whenever status moves to a
-- terminal state (solved/rejected), and clear them if it's ever moved back
-- to open/working. Keeps the "who closed this" audit trail correct even if
-- an admin route forgets to set it explicitly.
CREATE OR REPLACE FUNCTION issue_reports_stamp_resolution()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('solved', 'rejected') AND OLD.status NOT IN ('solved', 'rejected') THEN
    NEW.resolved_at := now();
    NEW.resolved_by := COALESCE(NEW.resolved_by, auth.uid());
  ELSIF NEW.status IN ('open', 'working') AND OLD.status IN ('solved', 'rejected') THEN
    NEW.resolved_at := NULL;
    NEW.resolved_by := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_issue_reports_stamp_resolution ON issue_reports;
CREATE TRIGGER trg_issue_reports_stamp_resolution
  BEFORE UPDATE ON issue_reports
  FOR EACH ROW
  EXECUTE FUNCTION issue_reports_stamp_resolution();

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE issue_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS issue_reports_select ON issue_reports;
CREATE POLICY issue_reports_select ON issue_reports
  FOR SELECT TO authenticated
  USING (
    reporter_user_id = (SELECT auth.uid())
    OR internhub.is_super_admin()
  );

DROP POLICY IF EXISTS issue_reports_insert ON issue_reports;
CREATE POLICY issue_reports_insert ON issue_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_user_id = (SELECT auth.uid())
    AND status = 'open'
    AND resolved_by IS NULL
    AND resolved_at IS NULL
  );

-- Only super_admin can update (status transitions, admin_note). Reporters
-- have no UPDATE policy at all, so any UPDATE attempt from a reporter is
-- rejected by RLS regardless of what the application layer does.
DROP POLICY IF EXISTS issue_reports_update ON issue_reports;
CREATE POLICY issue_reports_update ON issue_reports
  FOR UPDATE TO authenticated
  USING (internhub.is_super_admin())
  WITH CHECK (internhub.is_super_admin());

-- Only super_admin can delete (spam/duplicate cleanup).
DROP POLICY IF EXISTS issue_reports_delete ON issue_reports;
CREATE POLICY issue_reports_delete ON issue_reports
  FOR DELETE TO authenticated
  USING (internhub.is_super_admin());

GRANT SELECT, INSERT ON issue_reports TO authenticated;
GRANT UPDATE, DELETE ON issue_reports TO authenticated; -- narrowed by RLS above to super_admin

COMMENT ON TABLE issue_reports IS 'User-submitted issue/bug reports. Reporters can view their own; super_admin can view/manage all (open -> working -> solved, or rejected).';
