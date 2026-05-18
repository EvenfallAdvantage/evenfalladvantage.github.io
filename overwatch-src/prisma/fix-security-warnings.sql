-- ============================================================
-- OVERWATCH — Fix Supabase Linter Security Warnings
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── 1. Fix search_path on is_company_member ────────────────
CREATE OR REPLACE FUNCTION public.is_company_member(comp_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
    AND cm.company_id = comp_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- ─── 2. Fix search_path on get_my_user_id ───────────────────
CREATE OR REPLACE FUNCTION public.get_my_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE supabase_id = auth.uid()::text LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- ─── 3. Fix search_path on is_company_admin ─────────────────
CREATE OR REPLACE FUNCTION public.is_company_admin(comp_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE u.supabase_id = auth.uid()::text
    AND cm.company_id = comp_id
    AND cm.role IN ('owner', 'admin', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- ─── 3a. Lock down EXECUTE on the RLS helpers ──────────────
-- Revoke the Postgres default (PUBLIC, which lets anon inherit
-- EXECUTE) and grant only to authenticated. The helpers are called
-- from inside RLS policy USING/CHECK clauses, which always run in
-- the authenticated role context.
REVOKE EXECUTE ON FUNCTION public.is_company_member(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_company_member(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_user_id() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_user_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_company_admin(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_company_admin(UUID) TO authenticated;

-- ─── 4. Tighten incident_updates INSERT policy ─────────────
-- Only allow inserts if user belongs to the same company as the incident
DROP POLICY IF EXISTS incident_updates_insert ON public.incident_updates;
CREATE POLICY incident_updates_insert ON public.incident_updates
  FOR INSERT TO authenticated
  WITH CHECK (
    incident_id IN (
      SELECT i.id FROM public.incidents i
      WHERE public.is_company_member(i.company_id)
    )
  );

-- ─── Done ───────────────────────────────────────────────────
-- After running this, also go to:
--   Supabase Dashboard → Authentication → Settings → Password Protection
--   Toggle ON "Enable Leaked Password Protection"
-- That fixes the last warning (no SQL needed).
