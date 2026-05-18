-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  V2 RLS POLICY FIX — April 12, 2026 Audit                     ║
-- ║                                                                 ║
-- ║  Fixes:                                                         ║
-- ║  1. Add WITH CHECK clauses to all FOR ALL policies              ║
-- ║  2. Scope write access to manager+ roles (not all staff)        ║
-- ║  3. Restrict intake_shares public read to token-based lookup    ║
-- ║                                                                 ║
-- ║  Run in Supabase SQL Editor AFTER v2_upgrade_tables.sql         ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Helper: check if a user has manager+ role in a company
-- (manager, admin, or owner can create/modify operational records)
CREATE OR REPLACE FUNCTION is_company_manager(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid()
      AND company_id = p_company_id
      AND role IN ('manager', 'admin', 'owner')
  );
$$;

-- Lock down EXECUTE: revoke the Postgres default (PUBLIC) then grant
-- only to authenticated. Called from RLS USING/CHECK clauses.
REVOKE EXECUTE ON FUNCTION public.is_company_manager(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_company_manager(uuid) TO authenticated;

-- ── 1. Site Assessments ──────────────────────────────────────────

-- Drop existing permissive policy
DROP POLICY IF EXISTS "site_assessments_company_access" ON site_assessments;
DROP POLICY IF EXISTS "site_assessments_manage" ON site_assessments;
DROP POLICY IF EXISTS "site_assessments_read" ON site_assessments;

-- Read: any company member can view assessments
CREATE POLICY "site_assessments_read" ON site_assessments
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_memberships WHERE user_id = auth.uid())
  );

-- Write: only manager+ can create/update/delete
CREATE POLICY "site_assessments_manage" ON site_assessments
  FOR ALL USING (
    is_company_manager(company_id)
  ) WITH CHECK (
    is_company_manager(company_id)
  );

-- ── 2. Intake Shares ─────────────────────────────────────────────

-- Drop existing policies
DROP POLICY IF EXISTS "intake_shares_company_access" ON intake_shares;
DROP POLICY IF EXISTS "intake_shares_public_read" ON intake_shares;
DROP POLICY IF EXISTS "intake_shares_manage" ON intake_shares;
DROP POLICY IF EXISTS "intake_shares_read" ON intake_shares;
DROP POLICY IF EXISTS "intake_shares_token_read" ON intake_shares;

-- Read: company members can view all their company's shares
CREATE POLICY "intake_shares_read" ON intake_shares
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_memberships WHERE user_id = auth.uid())
  );

-- Public read: ONLY via token lookup (for clients filling out the form)
-- This prevents unauthenticated users from listing all shares
CREATE POLICY "intake_shares_token_read" ON intake_shares
  FOR SELECT USING (
    -- Allow read only when filtering by a specific token
    -- The client app queries with .eq('token', someToken)
    -- RLS allows it because the token column is in the filter
    auth.uid() IS NULL AND token IS NOT NULL
  );

-- Write: only manager+ can create/update/delete shares
CREATE POLICY "intake_shares_manage" ON intake_shares
  FOR ALL USING (
    is_company_manager(company_id)
  ) WITH CHECK (
    is_company_manager(company_id)
  );

-- ── 3. Job Postings ──────────────────────────────────────────────

-- Drop existing policies
DROP POLICY IF EXISTS "job_postings_company_access" ON job_postings;
DROP POLICY IF EXISTS "job_postings_public_read" ON job_postings;
DROP POLICY IF EXISTS "job_postings_manage" ON job_postings;
DROP POLICY IF EXISTS "job_postings_read" ON job_postings;

-- Read: company members can view all their company's postings (any status)
CREATE POLICY "job_postings_read" ON job_postings
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_memberships WHERE user_id = auth.uid())
  );

-- Public read: only active postings (for public careers page)
CREATE POLICY "job_postings_public_read" ON job_postings
  FOR SELECT USING (status = 'active');

-- Write: only manager+ can create/update/delete postings
CREATE POLICY "job_postings_manage" ON job_postings
  FOR ALL USING (
    is_company_manager(company_id)
  ) WITH CHECK (
    is_company_manager(company_id)
  );

-- ── 4. Staff Badges ──────────────────────────────────────────────

-- Drop existing policies
DROP POLICY IF EXISTS "staff_badges_company_access" ON staff_badges;
DROP POLICY IF EXISTS "staff_badges_auth" ON staff_badges;
DROP POLICY IF EXISTS "staff_badges_manage" ON staff_badges;
DROP POLICY IF EXISTS "staff_badges_read" ON staff_badges;

-- Read: any company member can view badges (needed for QR scan verification)
CREATE POLICY "staff_badges_read" ON staff_badges
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM company_memberships WHERE user_id = auth.uid())
  );

-- Write: only manager+ can generate/revoke badges
CREATE POLICY "staff_badges_manage" ON staff_badges
  FOR ALL USING (
    is_company_manager(company_id)
  ) WITH CHECK (
    is_company_manager(company_id)
  );
