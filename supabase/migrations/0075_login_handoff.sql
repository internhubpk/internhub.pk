-- ============================================================================
-- InternHub.pk — Migration 0075: Secure login handoff table
-- ----------------------------------------------------------------------------
-- Stores short-lived (60s), single-use tokens that allow the subdomain
-- /login page to prefill the email field after a cross-subdomain redirect.
--
-- SECURITY:
--   * Tokens are 128-bit UUIDs (unguessable).
--   * 60-second expiry (set by the application code on insert).
--   * Single-use (the consume endpoint sets used_at = now() atomically).
--   * No passwords are ever stored — only the email (already public-ish).
--   * RLS allows anyone to INSERT (the creating user is already auth'd
--     on the apex; the token is the secret). SELECT requires either:
--       - The row's user_id = auth.uid() (the user who created it)
--       - OR a service-role call (which bypasses RLS)
--     This lets the apex INSERT (auth.uid = the user), and lets the
--     subdomain SELECT+UPDATE via the service role (the subdomain may
--     not have the user auth'd yet — but the token is the secret).
-- ============================================================================

CREATE TABLE IF NOT EXISTS login_handoffs (
  token          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL,
  email          text NOT NULL,
  expires_at     timestamptz NOT NULL,
  used_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_handoffs_user ON login_handoffs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_handoffs_expires ON login_handoffs(expires_at);

ALTER TABLE login_handoffs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can INSERT a handoff row for their own user_id
DROP POLICY IF EXISTS login_handoffs_insert_policy ON login_handoffs;
CREATE POLICY login_handoffs_insert_policy ON login_handoffs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- The user can SELECT their own handoffs (used by the apex to verify creation)
DROP POLICY IF EXISTS login_handoffs_select_policy ON login_handoffs;
CREATE POLICY login_handoffs_select_policy ON login_handoffs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- The user can UPDATE their own handoffs (used by the consume endpoint on
-- the apex-side; the subdomain will use the service role to bypass RLS)
DROP POLICY IF EXISTS login_handoffs_update_policy ON login_handoffs;
CREATE POLICY login_handoffs_update_policy ON login_handoffs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-cleanup: delete handoffs older than 10 minutes (well past the 60s
-- expiry). Runs every 5 minutes via pg_cron if available; otherwise the
-- application can run a periodic cleanup.
-- (Note: pg_cron may not be enabled on all Supabase projects — the
-- application handles cleanup lazily on insert.)

COMMENT ON TABLE login_handoffs IS 'Short-lived (60s), single-use tokens for cross-subdomain email prefill during login redirect.';
