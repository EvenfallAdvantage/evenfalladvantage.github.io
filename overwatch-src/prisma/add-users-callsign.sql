-- ============================================================
-- MIGRATION: add users.callsign
-- Displays across Overwatch use the callsign + last name when a
-- callsign is set (e.g. "Eagle Jones"), falling back to first + last.
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Add the column if it's not present (idempotent).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS callsign TEXT;

-- Backfill value from the existing per-company alias where a user has
-- exactly one active membership with a nickname (best-effort, non-blocking).
UPDATE public.users u
SET callsign = cm.nickname
FROM public.company_memberships cm
WHERE u.callsign IS NULL
  AND cm.user_id = u.id
  AND cm.status = 'active'
  AND cm.nickname IS NOT NULL
  AND (SELECT COUNT(*) FROM public.company_memberships x
        WHERE x.user_id = u.id AND x.nickname IS NOT NULL) = 1;

NOTIFY pgrst, 'reload schema';