-- 0052_fix_task_attachments_recursion.sql
-- =============================================================================
-- Follow-up to migration 0051. Updates task_attachments policies to use the
-- SECURITY DEFINER helper functions instead of inline EXISTS subqueries on
-- tasks/task_assignments. While 0051 broke the recursion cycle (because the
-- inner queries now go through can_select_task / can_select_task_assignment
-- which bypass RLS), this migration makes the task_attachments policies
-- consistent and eliminates any remaining inline subquery on RLS-enabled
-- tables.
-- =============================================================================

-- tatt_select: a user can see an attachment if they can see the task it
-- belongs to. Uses can_select_task (SECURITY DEFINER — no recursion).
DROP POLICY IF EXISTS tatt_select ON public.task_attachments;
CREATE POLICY tatt_select ON public.task_attachments
  FOR SELECT TO authenticated
  USING (internhub.can_select_task(task_id));

-- tatt_insert: only the task creator (or super_admin) can upload attachments.
-- We still inline-check created_by here because the check is a simple
-- equality on a column — no EXISTS subquery, no recursion risk.
DROP POLICY IF EXISTS tatt_insert ON public.task_attachments;
CREATE POLICY tatt_insert ON public.task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND internhub.can_select_task(task_id)
  );

-- tatt_delete: same as insert — only the task creator (or super_admin) can
-- delete attachments.
DROP POLICY IF EXISTS tatt_delete ON public.task_attachments;
CREATE POLICY tatt_delete ON public.task_attachments
  FOR DELETE TO authenticated
  USING (
    internhub.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_attachments.task_id
        AND t.created_by = (SELECT auth.uid())
    )
  );

-- Re-confirm RLS enabled.
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments FORCE ROW LEVEL SECURITY;

-- Grant EXECUTE on helper functions to authenticated (idempotent — these
-- were already granted in 0051, but re-granting is a no-op).
GRANT EXECUTE ON FUNCTION internhub.can_select_task(uuid) TO authenticated;
