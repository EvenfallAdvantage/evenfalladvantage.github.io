-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  V2 RLS AUTH UID FIX — April 14, 2026                         ║
-- ║                                                                 ║
-- ║  Bug: V2 RLS policies used `user_id = auth.uid()` directly,    ║
-- ║  but company_memberships.user_id stores the internal user ID    ║
-- ║  (users.id), NOT the Supabase auth UID. This caused 403s on    ║
-- ║  all V2 table writes (staff_badges, site_assessments, etc.)    ║
-- ║                                                                 ║
-- ║  Fix: Join through users.supabase_id to resolve auth.uid()      ║
-- ║  to the internal user ID, matching the pattern used by the      ║
-- ║  older tactical map tables.                                     ║
-- ║                                                                 ║
-- ║  Run in Supabase SQL Editor AFTER v2_fix_rls_policies.sql       ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ── Fix is_company_manager() helper ──────────────────────────────

CREATE OR REPLACE FUNCTION is_company_manager(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
      AND cm.company_id = p_company_id
      AND cm.role IN ('manager', 'admin', 'owner')
  );
$$;

-- Lock down EXECUTE: revoke the Postgres default (PUBLIC) then grant
-- only to authenticated. Called from RLS USING/CHECK clauses.
REVOKE EXECUTE ON FUNCTION public.is_company_manager(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_company_manager(uuid) TO authenticated;

-- ── Fix READ policies (SELECT) ───────────────────────────────────
-- These all used: company_id IN (SELECT company_id FROM company_memberships WHERE user_id = auth.uid())
-- Fixed to:       company_id IN (SELECT cm.company_id FROM company_memberships cm JOIN users u ON u.id = cm.user_id WHERE u.supabase_id = auth.uid()::text)

-- 1. Site Assessments
DROP POLICY IF EXISTS "site_assessments_read" ON site_assessments;
CREATE POLICY "site_assessments_read" ON site_assessments
  FOR SELECT USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_memberships cm
      JOIN public.users u ON u.id = cm.user_id
      WHERE u.supabase_id = auth.uid()::text
    )
  );

-- 2. Intake Shares (authenticated read — token-based public read is separate)
DROP POLICY IF EXISTS "intake_shares_read" ON intake_shares;
CREATE POLICY "intake_shares_read" ON intake_shares
  FOR SELECT USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_memberships cm
      JOIN public.users u ON u.id = cm.user_id
      WHERE u.supabase_id = auth.uid()::text
    )
  );

-- 3. Job Postings (authenticated read — public active read is separate)
DROP POLICY IF EXISTS "job_postings_read" ON job_postings;
CREATE POLICY "job_postings_read" ON job_postings
  FOR SELECT USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_memberships cm
      JOIN public.users u ON u.id = cm.user_id
      WHERE u.supabase_id = auth.uid()::text
    )
  );

-- 4. Staff Badges
DROP POLICY IF EXISTS "staff_badges_read" ON staff_badges;
CREATE POLICY "staff_badges_read" ON staff_badges
  FOR SELECT USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_memberships cm
      JOIN public.users u ON u.id = cm.user_id
      WHERE u.supabase_id = auth.uid()::text
    )
  );

-- ── Verify ───────────────────────────────────────────────────────
-- After running, test badge generation as a manager:
--   1. Navigate to Personnel > Roster
--   2. Click the QR icon on any member
--   3. Should generate without 403 error
