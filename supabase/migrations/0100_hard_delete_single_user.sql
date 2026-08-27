-- =============================================================================
-- 0100_hard_delete_single_user.sql
-- =============================================================================
-- Permanently delete a SINGLE user account (profile + auth.users row) and
-- everything that belongs exclusively to them, while preserving records that
-- reference them historically.
--
-- Used by:
--   * DELETE /api/super-admin/users/[id]     (super admin — any user)
--   * DELETE /api/students/[id]              (university admin / program
--                                             coordinator / super admin —
--                                             students of their university)
--   * DELETE /api/coordinators/[id]          (university admin / super admin)
--   * DELETE /api/supervisors/[id]           (DC / PC / super admin — faculty
--                                             supervisors of their university)
--
-- Semantics:
--   * Rows the user OWNS as the subject are deleted (ON DELETE CASCADE FKs):
--     students, supervisors, company_users rows, applications, task
--     assignments/submissions, weekly_logs, evaluations, attendance,
--     certificates, cv_uploads, their notification inbox, messages,
--     supervisor_remarks, mou_invitations they sent.
--   * Rows that merely REFERENCE the user as an actor are KEPT with the
--     reference set to NULL (ON DELETE NO ACTION FKs): internships they
--     created stay live for the company, evaluations they wrote survive as
--     historical records with evaluator_id NULL, audit_logs keep user_id NULL.
--   * Role-specific extra cleanup:
--       - student    → documents they uploaded are removed
--       - university_admin → nothing extra (university itself is untouched)
--   * auth.users row is deleted IN SQL (Supabase auth internal tables cascade).
--   * Guards: cannot delete yourself; cannot delete the last active
--     super_admin.
--   * Storage objects belonging to the user become orphans (same policy as
--     hard_delete_university / hard_delete_company).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.hard_delete_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role              text;
  v_name              text;
  v_super_count       bigint;
  v_deleted_profiles  bigint := 0;
  v_deleted_auth      bigint := 0;
BEGIN
  SELECT p.role, COALESCE(p.full_name, p.email) INTO v_role, v_name
    FROM profiles p WHERE p.user_id = p_user_id;

  IF v_role IS NULL THEN
    -- Profile already gone; still clean up a dangling auth user if present.
    DELETE FROM auth.users WHERE id = p_user_id;
    GET DIAGNOSTICS v_deleted_auth = ROW_COUNT;
    RETURN jsonb_build_object('ok', true, 'warning', 'profile was already missing',
                              'auth_deleted', v_deleted_auth);
  END IF;

  -- Guard 1: never allow a user to delete their own account.
  IF auth.uid() IS NOT NULL AND auth.uid() = p_user_id THEN
    RETURN jsonb_build_object('error', 'you cannot delete your own account');
  END IF;

  -- Guard 2: never delete the last remaining active super admin.
  IF v_role = 'super_admin' THEN
    SELECT count(*) INTO v_super_count
      FROM profiles
     WHERE role = 'super_admin'
       AND status = 'active'
       AND id <> p_user_id;
    IF v_super_count = 0 THEN
      RETURN jsonb_build_object('error', 'cannot delete the last active super admin');
    END IF;
  END IF;

  ----------------------------------------------------------------------------
  -- 1. Detach "actor" references (FK ON DELETE NO ACTION → set NULL).
  --    Historical records survive; ownership is removed.
  ----------------------------------------------------------------------------
  UPDATE departments               SET head_id                   = NULL WHERE head_id                   = p_user_id;
  UPDATE programs                  SET default_external_evaluator_id = NULL WHERE default_external_evaluator_id = p_user_id;
  UPDATE programs                  SET default_faculty_supervisor_id  = NULL WHERE default_faculty_supervisor_id  = p_user_id;
  UPDATE programs                  SET program_coordinator_id       = NULL WHERE program_coordinator_id       = p_user_id;
  UPDATE students                  SET faculty_supervisor_id        = NULL WHERE faculty_supervisor_id        = p_user_id;
  UPDATE internships               SET created_by                   = NULL WHERE created_by                   = p_user_id;
  UPDATE student_internships       SET external_evaluator_id        = NULL WHERE external_evaluator_id        = p_user_id;
  UPDATE student_internships       SET faculty_supervisor_id        = NULL WHERE faculty_supervisor_id        = p_user_id;
  UPDATE student_internships       SET site_supervisor_id           = NULL WHERE site_supervisor_id           = p_user_id;
  UPDATE tasks                     SET created_by                   = NULL WHERE created_by                   = p_user_id;
  UPDATE task_assignments          SET assigned_by                  = NULL WHERE assigned_by                  = p_user_id;
  UPDATE task_submissions          SET reviewed_by                  = NULL WHERE reviewed_by                  = p_user_id;
  UPDATE task_attachments          SET uploaded_by                  = NULL WHERE uploaded_by                  = p_user_id;
  UPDATE weekly_logs               SET external_evaluator_id        = NULL WHERE external_evaluator_id        = p_user_id;
  UPDATE weekly_logs               SET faculty_supervisor_id        = NULL WHERE faculty_supervisor_id        = p_user_id;
  UPDATE weekly_logs               SET site_supervisor_id           = NULL WHERE site_supervisor_id           = p_user_id;
  UPDATE weekly_logs               SET supervisor_id                = NULL WHERE supervisor_id                = p_user_id;
  UPDATE evaluations               SET evaluator_id                 = NULL WHERE evaluator_id                 = p_user_id;
  UPDATE certificates              SET issued_by                    = NULL WHERE issued_by                    = p_user_id;
  UPDATE documents                 SET verified_by                  = NULL WHERE verified_by                  = p_user_id;
  UPDATE notifications             SET sender_id                    = NULL WHERE sender_id                    = p_user_id;
  UPDATE notifications             SET actor_user_id                 = NULL WHERE actor_user_id                 = p_user_id;
  UPDATE audit_logs                SET user_id                      = NULL WHERE user_id                      = p_user_id;
  UPDATE platform_settings         SET updated_by                   = NULL WHERE updated_by                   = p_user_id;
  UPDATE report_templates          SET created_by                   = NULL WHERE created_by                   = p_user_id;
  UPDATE reports                   SET created_by                   = NULL WHERE created_by                   = p_user_id;

  ----------------------------------------------------------------------------
  -- 2. Role-specific cleanup.
  ----------------------------------------------------------------------------
  IF v_role = 'student' THEN
    -- A student's uploaded documents belong to them personally (company_id
    -- is NULL on student uploads); company-shared documents are untouched.
    DELETE FROM documents WHERE uploaded_by = p_user_id AND company_id IS NULL;
  ELSE
    -- HR / supervisors may have uploaded company-shared documents — keep
    -- those, just detach ownership (already done above).
    NULL;
  END IF;

  ----------------------------------------------------------------------------
  -- 3. Delete the profile row. All "subject" FKs are ON DELETE CASCADE and
  --    remove the user's own data automatically.
  ----------------------------------------------------------------------------
  DELETE FROM profiles WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_profiles = ROW_COUNT;

  ----------------------------------------------------------------------------
  -- 4. Delete the auth user (identities/sessions/mfa cascade inside auth).
  ----------------------------------------------------------------------------
  DELETE FROM auth.users WHERE id = p_user_id;
  GET DIAGNOSTICS v_deleted_auth = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'role', v_role,
    'name', v_name,
    'profiles_deleted', v_deleted_profiles,
    'auth_deleted', v_deleted_auth
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- Permissions: only postgres + service_role may run this.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.hard_delete_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_user(uuid) TO service_role;

COMMENT ON FUNCTION public.hard_delete_user(uuid) IS
  'Permanently delete a single user account: profile + auth.users + all data where the user is the subject (applications, logs, evaluations, submissions…). Records that merely reference the user as an actor are preserved with the reference set to NULL. Guards: self-deletion and last-active-super-admin deletion are blocked. SECURITY DEFINER; service_role only.';
