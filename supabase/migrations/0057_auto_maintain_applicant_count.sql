-- 0057_auto_maintain_applicant_count.sql
--
-- Problem:
--   The marketplace list page used to show "0 applied" on every card
--   because `internships.current_applicants` was never incremented.
--   The apply flow calls `supabase.rpc('increment_applicant_count', …)`
--   but that function was never defined in any migration, so the call
--   silently 404'd and the column stayed at 0. Withdraw didn't decrement
--   either.
--
-- Fix:
--   1. Define `increment_applicant_count(p_internship_id)` so the existing
--      client call stops erroring.
--   2. Add a trigger `trg_internships_applicant_count` on
--      `internship_applications` that re-counts NON-withdrawn
--      applications for the affected internship and writes the result
--      into `internships.current_applicants`. This keeps the column
--      honest regardless of which code path inserts/updates/deletes
--      application rows (apply, withdraw, re-apply, admin delete, etc.).
--   3. Backfill the column once from the live applications table so
--      pre-existing rows show the right count immediately.
--
-- Notes:
--   * `application_status` enum has 'pending','reviewing','accepted',
--     'rejected','withdrawn' (migration 0001). Withdrawn rows remain
--     in the table for audit but no longer count toward seats taken.
--   * SECURITY DEFINER so the trigger can update `internships` even
--     when the acting user is a student who cannot otherwise UPDATE
--     that table (RLS would block it).
--   * search_path = public to prevent trojan-schema attacks.

-- ----------------------------------------------------------------------------
-- 1. Backfill the current value from real application rows.
--    Do this BEFORE adding the trigger so the trigger's first run
--    doesn't fight a stale baseline.
-- ----------------------------------------------------------------------------
UPDATE internships i
SET current_applicants = COALESCE(
  (
    SELECT COUNT(*)::integer
    FROM internship_applications a
    WHERE a.internship_id = i.id
      AND a.status <> 'withdrawn'
  ),
  0
);

-- ----------------------------------------------------------------------------
-- 2. Helper: recompute current_applicants for a single internship.
--    PUBLIC (EXECUTE to public) so the trigger and the client RPC can
--    both call it. SECURITY DEFINER so it can write to `internships`
--    regardless of the caller's RLS role.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_internship_applicant_count(p_internship_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE internships
  SET current_applicants = COALESCE(
    (
      SELECT COUNT(*)::integer
      FROM internship_applications a
      WHERE a.internship_id = p_internship_id
        AND a.status <> 'withdrawn'
    ),
    0
  )
  WHERE id = p_internship_id;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_internship_applicant_count(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. RPC the client calls from the apply flow.
--    Just a thin wrapper around recompute_internship_applicant_count
--    so existing `supabase.rpc('increment_applicant_count', …)` calls
--    stop erroring with 404. The name is kept for back-compat — the
--    function actually RECOUNTS rather than blindly +1, which is more
--    correct (idempotent under retries, handles concurrent inserts).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_applicant_count(p_internship_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.recompute_internship_applicant_count(p_internship_id);
$$;

GRANT EXECUTE ON FUNCTION public.increment_applicant_count(uuid) TO authenticated;

-- Companion RPC for the withdraw flow — same semantics.
CREATE OR REPLACE FUNCTION public.decrement_applicant_count(p_internship_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.recompute_internship_applicant_count(p_internship_id);
$$;

GRANT EXECUTE ON FUNCTION public.decrement_applicant_count(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Trigger: recompute on every INSERT / UPDATE (status change) / DELETE
--    on internship_applications. We must handle the case where the OLD
--    row's internship_id differs from the NEW one (status changes can't
--    move rows between internships because internship_id is part of the
--    UNIQUE constraint, but defensive UPDATEs via the API could in
--    theory reassign — we recompute BOTH old and new to be safe).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_recompute_applicant_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_id uuid;
  v_new_id uuid;
BEGIN
  v_old_id := COALESCE((CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN OLD.internship_id END), NULL);
  v_new_id := COALESCE((CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN NEW.internship_id END), NULL);

  IF v_old_id IS NOT NULL AND v_old_id IS DISTINCT FROM v_new_id THEN
    PERFORM public.recompute_internship_applicant_count(v_old_id);
  END IF;
  IF v_new_id IS NOT NULL THEN
    PERFORM public.recompute_internship_applicant_count(v_new_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_internships_applicant_count ON internship_applications;
CREATE TRIGGER trg_internships_applicant_count
  AFTER INSERT OR UPDATE OR DELETE ON internship_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_recompute_applicant_count();
