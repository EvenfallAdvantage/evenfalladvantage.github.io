-- ============================================================
-- FIX: RLS warnings — companies INSERT + join_attempts policies
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── 1. companies INSERT — restrict to registered users ──────
-- Previously: WITH CHECK (true) — flagged as "always true"
-- Now: Only users with a record in the users table can INSERT.
-- In practice, all company creation goes through the
-- create_company_with_owner RPC (SECURITY DEFINER) which
-- bypasses RLS entirely, so this policy is a safety net.

DROP POLICY IF EXISTS "companies_insert" ON public.companies;
CREATE POLICY "companies_insert" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE supabase_id = auth.uid()::text
    )
  );

-- ─── 2. join_attempts — add scoped policies ──────────────────
-- This table is only accessed by the join_company_by_code RPC
-- (SECURITY DEFINER), so these policies are a safety net.
-- Scoped to own supabase_id so users can only see/modify their
-- own rate-limit records.

DROP POLICY IF EXISTS "join_attempts_select" ON public.join_attempts;
CREATE POLICY "join_attempts_select" ON public.join_attempts
  FOR SELECT TO authenticated
  USING (supabase_id = auth.uid()::text);

DROP POLICY IF EXISTS "join_attempts_insert" ON public.join_attempts;
CREATE POLICY "join_attempts_insert" ON public.join_attempts
  FOR INSERT TO authenticated
  WITH CHECK (supabase_id = auth.uid()::text);

DROP POLICY IF EXISTS "join_attempts_delete" ON public.join_attempts;
CREATE POLICY "join_attempts_delete" ON public.join_attempts
  FOR DELETE TO authenticated
  USING (supabase_id = auth.uid()::text);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
