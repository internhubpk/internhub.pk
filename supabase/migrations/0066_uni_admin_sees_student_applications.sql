-- ============================================================================
-- InternHub.pk — 0050_uni_admin_sees_student_applications.sql
-- ----------------------------------------------------------------------------
-- BUG: University admin dashboard & reports page showed 0 pending/accepted/
-- rejected applications even when their students had submitted real
-- applications.
--
-- ROOT CAUSE
--   The `app_select` RLS policy on `internship_applications` allows a
--   university_admin to read applications only when the underlying
--   internship's `university_id` matches the admin's university:
--
--     EXISTS (SELECT 1 FROM internships i
--             WHERE i.id = internship_applications.internship_id
--               AND i.university_id = internhub.current_university_id())
--
--   Company HR creates internships with `university_id = NULL` (the
--   internship is open to applicants from any university — this is by
--   design and matches the marketplace behaviour). With `university_id`
--   NULL, the EXISTS clause evaluates to NULL/false for every row, so
--   university_admin sees zero applications — including the ones their
--   own students submitted.
--
--   The same bug affects department_coordinator (`i.department_id` is
--   also NULL on company-published internships).
--
-- FIX
--   Add a SECOND university-scoping path to `app_select` that keys off
--   the APPLICANT's profile, not the internship:
--
--     university_admin  -> applicant's profile.university_id matches
--     department_coord  -> applicant's profile.department_id matches
--
--   This is semantically correct: a university admin should be able to
--   see every application their own students submit, regardless of
--   whether the internship was published globally or scoped to their
--   university. It also matches the dashboard's existing "pending
--   applications submitted by THIS university's students" semantic.
--
--   The old internship-keyed path is kept (additive OR) so that
--   university-scoped internships still work as before.
--
-- SAFETY
--   - `profiles` is in the same `public` schema and is already RLS-
--     protected; the EXISTS subquery runs as the caller, but it only
--     reads `user_id`/`university_id`/`department_id` (all columns the
--     caller can already see via their own profile).
--   - No INSERT/UPDATE/DELETE policy is changed — only SELECT.
--   - The additional EXISTS is a strict equality on a uuid column; it
--     cannot leak data across tenants.
-- ============================================================================

-- Drop and recreate the app_select policy with the new additive paths.
DROP POLICY IF EXISTS app_select ON internship_applications;

CREATE POLICY app_select ON internship_applications
  FOR SELECT TO authenticated
  USING (
    internhub.current_role() = 'super_admin'
    -- student sees own applications
    OR (internhub.current_role() = 'student' AND student_user_id = (select auth.uid()))
    -- company_hr sees applications to their company's internships
    OR (internhub.current_role() = 'company_hr' AND company_id = internhub.current_company_id())
    -- university admin sees applications to their university's internships
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.internships i
            WHERE i.id = internship_applications.internship_id
              AND i.university_id = internhub.current_university_id()
        ))
    -- university admin ALSO sees applications submitted by their own
    -- students (covers the case where the internship is company-published
    -- with university_id = NULL — open to all universities).
    OR (internhub.current_role() = 'university_admin'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = internship_applications.student_user_id
              AND p.university_id = internhub.current_university_id()
        ))
    -- department coordinator: internship is scoped to their department
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.internships i
            WHERE i.id = internship_applications.internship_id
              AND i.department_id = internhub.current_department_id()
        ))
    -- department coordinator ALSO sees applications submitted by their
    -- own department's students (covers company-published internships
    -- with department_id = NULL).
    OR (internhub.current_role() = 'department_coordinator'
        AND EXISTS (
          SELECT 1 FROM public.profiles p
            WHERE p.user_id = internship_applications.student_user_id
              AND p.department_id = internhub.current_department_id()
        ))
    -- faculty supervisor / site supervisor: only if student is assigned to them
    OR (internhub.current_role() IN ('faculty_supervisor','site_supervisor')
        AND internhub.is_assigned_supervisor(student_user_id))
  );
