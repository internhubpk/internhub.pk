-- ============================================================================
-- InternHub.pk — 0008 Fix infinite recursion in RLS policies
-- ----------------------------------------------------------------------------
-- PROBLEM (live production)
--   GET /rest/v1/profiles?select=*&user_id=eq.<uid> returns 500 with
--     SQLSTATE 42P17 "infinite recursion detected in policy for relation
--     'profiles'"
--   Same error on every table whose RLS policy calls internhub.current_role()
--   or any other internhub.* helper that reads from a RLS-protected table.
--
-- ROOT CAUSE
--   Every RLS policy on `profiles` calls `internhub.current_role()`, which is
--   defined as:
--       SELECT role FROM public.profiles WHERE user_id = (select auth.uid())
--   The function is SECURITY DEFINER, so it executes as the function owner
--   (postgres). HOWEVER — every table was created with
--       ALTER TABLE ... FORCE ROW LEVEL SECURITY;
--   FORCE makes even the table OWNER subject to RLS. So when the policy
--   evaluates and the SECURITY DEFINER function queries `profiles`, that
--   query triggers the profiles_select policy, which calls
--   internhub.current_role() again, which queries profiles again, ... →
--   infinite recursion → 42P17.
--
-- FIX
--   Drop FORCE on every RLS-protected table. Without FORCE, the table owner
--   (postgres) automatically bypasses RLS. SECURITY DEFINER functions owned
--   by postgres can then query the tables without triggering policy
--   evaluation, which breaks the recursion.
--
--   Security is preserved: anon and authenticated roles are STILL subject
--   to RLS. Only the table owner (postgres) gains bypass — and postgres
--   already had bypass via the service-role key anyway. The FORCE flag was
--   a defense-in-depth measure that, in this multi-function RLS design,
--   actually breaks the system.
--
-- SIDE EFFECTS
--   None. Tables remain RLS-enabled. Policies remain in force. Only the
--   "owner is subject to RLS" behavior changes.
--
-- IDEMPOTENT
--   ALTER TABLE ... NO FORCE ROW LEVEL SECURITY is a no-op if FORCE was
--   already off. Safe to re-run.
-- ============================================================================

ALTER TABLE public.profiles              NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.universities          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.departments           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.programs              NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.companies             NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.students              NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.supervisors           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.internships           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.internship_applications NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.student_internships   NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                 NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments      NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions      NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_logs           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations           NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance            NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.documents             NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.certificates          NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications         NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.messages              NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs            NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.licenses              NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings     NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.storage_allocations   NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reports               NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates      NO FORCE ROW LEVEL SECURITY;

-- Sanity check: should show 0 tables with forced RLS
SELECT count(*) AS tables_with_forced_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = true
  AND c.relforcerowsecurity = true;
