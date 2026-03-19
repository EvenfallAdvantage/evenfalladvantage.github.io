-- ============================================================
-- FIX: Supabase Database Linter WARN-level findings
-- Run in: Overwatch Supabase Dashboard → SQL Editor → New Query
-- Instance: nneueuvyeohwnspbwfub.supabase.co
--
-- Resolves:
--   1. function_search_path_mutable on get_partner_companies
--   2. rls_policy_always_true on applicants (anon INSERT)
--   3. rls_policy_always_true on audit_logs (authenticated INSERT)
--   4. rls_policy_always_true on companies (authenticated INSERT) — KEPT, documented
--   5. rls_policy_always_true on time_off_policies (DELETE + INSERT)
--   6. rls_policy_always_true on time_off_requests (UPDATE)
-- ============================================================

-- ─── 1. Fix get_partner_companies search_path ────────────────
CREATE OR REPLACE FUNCTION public.get_partner_companies()
RETURNS TABLE (name TEXT, logo_url TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT c.name, c.logo_url
  FROM public.companies c
  ORDER BY c.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_companies() TO anon, authenticated;

-- ─── 2. Scope applicants anon INSERT to required fields ──────
-- Public application form: require company_id + name + email
DROP POLICY IF EXISTS applicants_public_insert ON public.applicants;
CREATE POLICY applicants_public_insert ON public.applicants
  FOR INSERT TO anon
  WITH CHECK (
    company_id IS NOT NULL
    AND first_name IS NOT NULL
    AND last_name IS NOT NULL
    AND email IS NOT NULL
  );

-- ─── 3. Scope audit_logs INSERT to own user ──────────────────
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert own audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Allow logs without user_id (system events) or logs for own user
    user_id IS NULL
    OR user_id IN (
      SELECT id FROM public.users WHERE supabase_id = auth.uid()::text
    )
  );

-- ─── 4. companies INSERT — INTENTIONALLY permissive ──────────
-- Any authenticated user can create a company (core registration flow).
-- Keeping WITH CHECK (true) by design. No change needed.
-- The linter warning is acknowledged and accepted.

-- ─── 5. Scope time_off_policies DELETE + INSERT to admin ─────
DROP POLICY IF EXISTS time_off_policies_delete ON public.time_off_policies;
CREATE POLICY time_off_policies_delete ON public.time_off_policies
  FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));

DROP POLICY IF EXISTS time_off_policies_insert ON public.time_off_policies;
CREATE POLICY time_off_policies_insert ON public.time_off_policies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));

-- ─── 6. Scope time_off_requests UPDATE to own + admin ────────
DROP POLICY IF EXISTS time_off_requests_update ON public.time_off_requests;
CREATE POLICY time_off_requests_update ON public.time_off_requests
  FOR UPDATE TO authenticated
  USING (
    -- Own requests
    user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()::text)
    OR
    -- Manager/admin/owner in the same company (via policy → company)
    EXISTS (
      SELECT 1
      FROM public.time_off_policies tp
      JOIN public.company_memberships cm ON cm.company_id = tp.company_id
      JOIN public.users u ON u.id = cm.user_id AND u.supabase_id = auth.uid()::text
      WHERE tp.id = time_off_requests.policy_id
        AND cm.role IN ('owner', 'admin', 'manager')
    )
  );

-- ─── Reload PostgREST schema cache ──────────────────────────
NOTIFY pgrst, 'reload schema';
