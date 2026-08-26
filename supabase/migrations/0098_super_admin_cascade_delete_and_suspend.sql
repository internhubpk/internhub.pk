-- =============================================================================
-- 0098_super_admin_cascade_delete_and_suspend.sql
-- =============================================================================
-- Super-Admin account lifecycle:
--
--   1. hard_delete_university(uuid)  — permanently delete a university AND
--      everything under it: all user accounts (university admin, coordinators,
--      supervisors, students), their auth.users rows, departments, programs,
--      students records, internships posted to the university, weekly logs,
--      tasks, applications, certificates, MOUs, and any companies registered
--      under the university (with their own accounts + internships).
--
--   2. hard_delete_company(uuid)     — permanently delete a company AND all
--      of its accounts (company HR, site supervisors), internships,
--      applications, student internship records, weekly logs written at
--      those internships, MOUs, documents, and supervisors.
--
--   3. cascade_set_users_suspended(uuid[], boolean) — flip a set of users
--      between suspended/active: updates profiles.status + profiles.is_active
--      AND auth.users.banned_until (so suspended users cannot log in or
--      refresh tokens) + wipes their auth.sessions (immediate sign-out).
--
-- Design notes:
--   * All functions are SECURITY DEFINER, owned by postgres (the role the
--     Supabase Management API / SQL editor runs as). RLS is bypassed.
--   * EXECUTE is revoked from anon/authenticated/public — only postgres and
--     service_role may call them (the Next.js super-admin API routes use the
--     service-role key).
--   * auth.users rows are deleted IN SQL. Supabase's auth schema internal
--     tables (identities, sessions, mfa_factors, …) reference auth.users with
--     ON DELETE CASCADE, so they clean up automatically.
--   * Deletion runs in strict FK-dependency order (leaf tables first).
--   * Storage objects belonging to deleted users are NOT removed (no FK
--     tracking); they become unreachable orphans, which is safe.
--   * Idempotent: deleting a non-existent id deletes nothing and returns
--     zero counts.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. HARD-DELETE A COMPANY (used standalone AND by hard_delete_university for
--    companies registered under the university)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hard_delete_company(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_ids        uuid[];
  v_internship_ids  uuid[];
  v_si_ids          uuid[];
  v_task_ids        uuid[];
  v_deleted_profiles  bigint := 0;
  v_deleted_auth      bigint := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = p_company_id) THEN
    RETURN jsonb_build_object('error', 'company not found');
  END IF;

  -- Collect ID sets up-front.
  SELECT COALESCE(array_agg(user_id), '{}') INTO v_user_ids
    FROM profiles WHERE company_id = p_company_id;

  SELECT COALESCE(array_agg(id), '{}') INTO v_internship_ids
    FROM internships WHERE company_id = p_company_id;

  SELECT COALESCE(array_agg(id), '{}') INTO v_si_ids
    FROM student_internships
   WHERE company_id = p_company_id
      OR internship_id = ANY(v_internship_ids);

  SELECT COALESCE(array_agg(id), '{}') INTO v_task_ids
    FROM tasks WHERE created_by = ANY(v_user_ids);

  -- ---- leaf tables -------------------------------------------------------
  DELETE FROM weekly_log_daily_entries
   WHERE weekly_log_id IN (
     SELECT id FROM weekly_logs
      WHERE student_user_id  = ANY(v_user_ids)
         OR internship_id    = ANY(v_internship_ids)
         OR student_internship_id = ANY(v_si_ids)
         OR supervisor_id    = ANY(v_user_ids)
   );

  DELETE FROM weekly_logs
   WHERE student_user_id  = ANY(v_user_ids)
      OR internship_id    = ANY(v_internship_ids)
      OR student_internship_id = ANY(v_si_ids)
      OR supervisor_id    = ANY(v_user_ids);

  DELETE FROM supervisor_remarks
   WHERE student_user_id = ANY(v_user_ids)
      OR supervisor_id   = ANY(v_user_ids)
      OR internship_id   = ANY(v_internship_ids);

  DELETE FROM attendance
   WHERE student_user_id     = ANY(v_user_ids)
      OR internship_id       = ANY(v_internship_ids)
      OR student_internship_id = ANY(v_si_ids);

  DELETE FROM evaluations
   WHERE student_user_id      = ANY(v_user_ids)
      OR evaluator_id         = ANY(v_user_ids)
      OR internship_id        = ANY(v_internship_ids)
      OR student_internship_id = ANY(v_si_ids)
      OR task_id              = ANY(v_task_ids);

  DELETE FROM task_submissions
   WHERE student_user_id     = ANY(v_user_ids)
      OR reviewed_by         = ANY(v_user_ids)
      OR task_id             = ANY(v_task_ids)
      OR task_assignment_id IN (
            SELECT id FROM task_assignments
             WHERE task_id = ANY(v_task_ids) OR student_user_id = ANY(v_user_ids)
               OR assigned_by = ANY(v_user_ids)
         );

  DELETE FROM task_attachments
   WHERE task_id     = ANY(v_task_ids)
      OR uploaded_by = ANY(v_user_ids);

  DELETE FROM task_assignments
   WHERE task_id        = ANY(v_task_ids)
      OR student_user_id = ANY(v_user_ids)
      OR assigned_by    = ANY(v_user_ids);

  DELETE FROM tasks WHERE id = ANY(v_task_ids);

  DELETE FROM certificates
   WHERE company_id      = p_company_id
      OR internship_id   = ANY(v_internship_ids)
      OR student_user_id = ANY(v_user_ids)
      OR issued_by       = ANY(v_user_ids);

  DELETE FROM intern_supervisor_assignments
   WHERE student_internship_id = ANY(v_si_ids)
      OR supervisor_id          = ANY(v_user_ids)
      OR internship_id          = ANY(v_internship_ids);

  DELETE FROM student_internships WHERE id = ANY(v_si_ids);

  DELETE FROM internship_applications
   WHERE company_id      = p_company_id
      OR internship_id   = ANY(v_internship_ids)
      OR student_user_id = ANY(v_user_ids);

  DELETE FROM internship_target_departments
   WHERE internship_id = ANY(v_internship_ids);

  DELETE FROM internships WHERE id = ANY(v_internship_ids);

  DELETE FROM documents
   WHERE company_id   = p_company_id
      OR uploaded_by  = ANY(v_user_ids)
      OR verified_by  = ANY(v_user_ids);

  DELETE FROM mou_invitations WHERE company_id = p_company_id;
  DELETE FROM company_university_mous WHERE company_id = p_company_id;
  DELETE FROM supervisors       WHERE company_id = p_company_id;
  DELETE FROM company_users     WHERE company_id = p_company_id;

  DELETE FROM generated_reports
   WHERE student_id    = ANY(v_user_ids)
      OR internship_id = ANY(v_internship_ids);

  DELETE FROM messages
   WHERE sender_id   = ANY(v_user_ids)
      OR receiver_id = ANY(v_user_ids);

  DELETE FROM notifications
   WHERE user_id   = ANY(v_user_ids)
      OR sender_id = ANY(v_user_ids);

  DELETE FROM cv_uploads WHERE student_user_id = ANY(v_user_ids);

  DELETE FROM reports         WHERE created_by = ANY(v_user_ids);
  DELETE FROM report_templates WHERE created_by = ANY(v_user_ids);

  -- Surviving rows that point at deleted users via nullable FK columns.
  UPDATE programs
     SET default_external_evaluator_id = NULL
   WHERE default_external_evaluator_id = ANY(v_user_ids);
  UPDATE programs
     SET default_faculty_supervisor_id = NULL
   WHERE default_faculty_supervisor_id = ANY(v_user_ids);
  UPDATE programs
     SET program_coordinator_id = NULL
   WHERE program_coordinator_id = ANY(v_user_ids);

  -- ---- accounts -----------------------------------------------------------
  DELETE FROM profiles WHERE company_id = p_company_id;
  GET DIAGNOSTICS v_deleted_profiles = ROW_COUNT;

  DELETE FROM auth.users WHERE id = ANY(v_user_ids);
  GET DIAGNOSTICS v_deleted_auth = ROW_COUNT;

  DELETE FROM companies WHERE id = p_company_id;

  RETURN jsonb_build_object(
    'deleted_profiles', v_deleted_profiles,
    'deleted_auth_users', v_deleted_auth
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. HARD-DELETE A UNIVERSITY (including its sub-companies)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hard_delete_university(p_university_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_ids         uuid[];
  v_internship_ids   uuid[];
  v_si_ids           uuid[];
  v_task_ids         uuid[];
  v_sub_company_ids  uuid[];
  c                  uuid;
  v_row_count       bigint := 0;
  v_deleted_profiles bigint := 0;
  v_deleted_auth     bigint := 0;
  v_deleted_companies bigint := 0;
  v_company_result   jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM universities WHERE id = p_university_id) THEN
    RETURN jsonb_build_object('error', 'university not found');
  END IF;

  -- Collect ID sets up-front.
  SELECT COALESCE(array_agg(user_id), '{}') INTO v_user_ids
    FROM profiles WHERE university_id = p_university_id;

  SELECT COALESCE(array_agg(id), '{}') INTO v_internship_ids
    FROM internships WHERE university_id = p_university_id;

  SELECT COALESCE(array_agg(id), '{}') INTO v_si_ids
    FROM student_internships
   WHERE university_id = p_university_id
      OR internship_id = ANY(v_internship_ids);

  SELECT COALESCE(array_agg(id), '{}') INTO v_task_ids
    FROM tasks WHERE university_id = p_university_id;

  SELECT COALESCE(array_agg(id), '{}') INTO v_sub_company_ids
    FROM companies WHERE university_id = p_university_id;

  -- 2a. Delete sub-companies first (they may target this university's
  --     departments through internship_target_departments rows and they own
  --     their own accounts/internships).
  FOREACH c IN ARRAY v_sub_company_ids LOOP
    v_company_result := public.hard_delete_company(c);
    v_deleted_profiles := v_deleted_profiles
      + COALESCE((v_company_result->>'deleted_profiles')::bigint, 0);
    v_deleted_auth := v_deleted_auth
      + COALESCE((v_company_result->>'deleted_auth_users')::bigint, 0);
    v_deleted_companies := v_deleted_companies + 1;
  END LOOP;

  -- Recompute the university's own user set (sub-company deletion never
  -- touches university-scoped profiles, but stay defensive).
  SELECT COALESCE(array_agg(user_id), '{}') INTO v_user_ids
    FROM profiles WHERE university_id = p_university_id;

  -- 2b. Leaf tables ---------------------------------------------------------
  DELETE FROM weekly_log_daily_entries
   WHERE weekly_log_id IN (
     SELECT id FROM weekly_logs
      WHERE student_user_id       = ANY(v_user_ids)
         OR internship_id         = ANY(v_internship_ids)
         OR student_internship_id = ANY(v_si_ids)
         OR supervisor_id         = ANY(v_user_ids)
         OR faculty_supervisor_id = ANY(v_user_ids)
         OR site_supervisor_id    = ANY(v_user_ids)
         OR external_evaluator_id = ANY(v_user_ids)
   );

  DELETE FROM weekly_logs
   WHERE student_user_id       = ANY(v_user_ids)
      OR internship_id         = ANY(v_internship_ids)
      OR student_internship_id = ANY(v_si_ids)
      OR supervisor_id         = ANY(v_user_ids)
      OR faculty_supervisor_id = ANY(v_user_ids)
      OR site_supervisor_id    = ANY(v_user_ids)
      OR external_evaluator_id = ANY(v_user_ids);

  DELETE FROM supervisor_remarks
   WHERE student_user_id = ANY(v_user_ids)
      OR supervisor_id   = ANY(v_user_ids)
      OR internship_id   = ANY(v_internship_ids);

  DELETE FROM attendance
   WHERE student_user_id       = ANY(v_user_ids)
      OR internship_id         = ANY(v_internship_ids)
      OR student_internship_id = ANY(v_si_ids);

  DELETE FROM evaluations
   WHERE student_user_id       = ANY(v_user_ids)
      OR evaluator_id          = ANY(v_user_ids)
      OR internship_id         = ANY(v_internship_ids)
      OR student_internship_id = ANY(v_si_ids)
      OR task_id               = ANY(v_task_ids);

  DELETE FROM task_submissions
   WHERE student_user_id     = ANY(v_user_ids)
      OR reviewed_by         = ANY(v_user_ids)
      OR task_id             = ANY(v_task_ids)
      OR task_assignment_id IN (
            SELECT id FROM task_assignments
             WHERE task_id = ANY(v_task_ids) OR student_user_id = ANY(v_user_ids)
               OR assigned_by = ANY(v_user_ids)
         );

  DELETE FROM task_attachments
   WHERE task_id     = ANY(v_task_ids)
      OR uploaded_by = ANY(v_user_ids);

  DELETE FROM task_assignments
   WHERE task_id         = ANY(v_task_ids)
      OR student_user_id = ANY(v_user_ids)
      OR assigned_by     = ANY(v_user_ids);

  DELETE FROM tasks WHERE university_id = p_university_id;

  DELETE FROM certificates
   WHERE university_id  = p_university_id
      OR internship_id  = ANY(v_internship_ids)
      OR student_user_id = ANY(v_user_ids)
      OR issued_by      = ANY(v_user_ids);

  DELETE FROM intern_supervisor_assignments
   WHERE student_internship_id = ANY(v_si_ids)
      OR supervisor_id          = ANY(v_user_ids)
      OR internship_id          = ANY(v_internship_ids);

  DELETE FROM student_internships WHERE id = ANY(v_si_ids);

  DELETE FROM internship_applications
   WHERE student_user_id = ANY(v_user_ids)
      OR internship_id   = ANY(v_internship_ids);

  DELETE FROM internship_target_departments
   WHERE university_id = p_university_id
      OR internship_id = ANY(v_internship_ids);

  DELETE FROM internships WHERE university_id = p_university_id;

  -- NOTE: documents has NO university_id column (company-scoped only) —
  -- university users' documents are removed via uploaded_by/verified_by.
  DELETE FROM documents
   WHERE uploaded_by = ANY(v_user_ids)
      OR verified_by = ANY(v_user_ids);

  DELETE FROM reports          WHERE university_id = p_university_id OR created_by = ANY(v_user_ids);
  DELETE FROM report_templates WHERE university_id = p_university_id OR created_by = ANY(v_user_ids);

  DELETE FROM generated_reports
   WHERE student_id    = ANY(v_user_ids)
      OR internship_id = ANY(v_internship_ids);

  DELETE FROM messages
   WHERE sender_id   = ANY(v_user_ids)
      OR receiver_id = ANY(v_user_ids);

  DELETE FROM notifications
   WHERE user_id   = ANY(v_user_ids)
      OR sender_id = ANY(v_user_ids);

  DELETE FROM cv_uploads WHERE student_user_id = ANY(v_user_ids);

  DELETE FROM mou_invitations
   WHERE university_id  = p_university_id
      OR inviter_user_id = ANY(v_user_ids);

  DELETE FROM company_university_mous WHERE university_id = p_university_id;

  DELETE FROM students   WHERE university_id = p_university_id;
  DELETE FROM supervisors WHERE university_id = p_university_id;
  DELETE FROM company_users WHERE user_id = ANY(v_user_ids);
  DELETE FROM programs   WHERE university_id = p_university_id;
  DELETE FROM departments WHERE university_id = p_university_id;
  DELETE FROM subscriptions      WHERE university_id = p_university_id;
  DELETE FROM licenses           WHERE university_id = p_university_id;
  DELETE FROM storage_allocations WHERE university_id = p_university_id;
  DELETE FROM holidays           WHERE university_id = p_university_id;

  DELETE FROM audit_logs
   WHERE university_id = p_university_id
      OR user_id       = ANY(v_user_ids);

  -- Surviving rows that point at deleted users via nullable FK columns.
  UPDATE platform_settings SET updated_by = NULL
   WHERE updated_by = ANY(v_user_ids);

  -- 2c. Accounts ------------------------------------------------------------
  DELETE FROM profiles WHERE university_id = p_university_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_deleted_profiles := v_deleted_profiles + v_row_count;

  DELETE FROM auth.users WHERE id = ANY(v_user_ids);
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_deleted_auth := v_deleted_auth + v_row_count;

  DELETE FROM universities WHERE id = p_university_id;

  RETURN jsonb_build_object(
    'deleted_profiles', v_deleted_profiles,
    'deleted_auth_users', v_deleted_auth,
    'deleted_companies', v_deleted_companies
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. CASCADE SUSPEND / ACTIVATE A SET OF USERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cascade_set_users_suspended(
  p_user_ids  uuid[],
  p_suspended boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE profiles
     SET status     = CASE WHEN p_suspended THEN 'suspended'::profile_status ELSE 'active'::profile_status END,
         is_active  = NOT p_suspended,
         updated_at = now()
   WHERE user_id = ANY(p_user_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Ban / unban at the auth layer so suspended users cannot sign in or
  -- refresh their tokens.
  -- NOTE: a FINITE far-future timestamp is used instead of 'infinity' —
  -- GoTrue (Supabase Auth) cannot scan the Postgres 'infinity' special
  -- value into a Go time.Time, which makes every auth query for the user
  -- fail with a generic "Database error" instead of the proper
  -- "User is banned" response. 200 years is effectively indefinite.
  UPDATE auth.users
     SET banned_until = CASE WHEN p_suspended THEN now() + interval '200 years' ELSE NULL END
   WHERE id = ANY(p_user_ids);

  -- Kill live sessions for instant sign-out when suspending.
  IF p_suspended THEN
    DELETE FROM auth.sessions WHERE user_id = ANY(p_user_ids);
  END IF;

  RETURN v_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- Permissions: only postgres + service_role may run these.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS internhub.hard_delete_company(uuid);
REVOKE EXECUTE ON FUNCTION public.hard_delete_company(uuid) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS internhub.hard_delete_university(uuid);
REVOKE EXECUTE ON FUNCTION public.hard_delete_university(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cascade_set_users_suspended(uuid[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hard_delete_company(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hard_delete_university(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cascade_set_users_suspended(uuid[], boolean) TO service_role;

COMMENT ON FUNCTION public.hard_delete_university(uuid) IS
  'Super-admin: permanently delete a university, all of its user accounts (profiles + auth.users), departments, programs, students, internships posted to it, logs, tasks, MOUs, and companies registered under it. SECURITY DEFINER; service_role only.';
COMMENT ON FUNCTION public.hard_delete_company(uuid) IS
  'Super-admin: permanently delete a company, all of its accounts (profiles + auth.users), internships, applications, student internship records, weekly logs written at those internships, MOUs, and supervisors. SECURITY DEFINER; service_role only.';
COMMENT ON FUNCTION public.cascade_set_users_suspended(uuid[], boolean) IS
  'Super-admin: suspend/activate a set of users — updates profiles.status/is_active, sets auth.users.banned_until (indefinite ban while suspended) and deletes their auth.sessions for immediate sign-out. SECURITY DEFINER; service_role only.';
