-- ============================================================================
-- InternHub.pk — 0045: internship_applications.additional_answers
-- ----------------------------------------------------------------------------
-- Adds a JSONB column to `internship_applications` so the marketplace apply
-- modal can store structured answers to additional questions (availability,
-- work authorization, etc.) alongside the cover letter and resume.
--
-- Before this migration, the marketplace apply form captured availability
-- and work-authorization answers in client state but had nowhere to persist
-- them — they were silently dropped on submit. With this column, the
-- submit handler stores the full answers object as JSON.
--
-- Idempotent: uses ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE public.internship_applications
  ADD COLUMN IF NOT EXISTS additional_answers jsonb DEFAULT NULL;

COMMENT ON COLUMN public.internship_applications.additional_answers IS
  'Structured answers to additional application questions (availability, work authorization, etc.) captured by the marketplace apply modal. JSON object. NULL when no additional questions were answered.';
