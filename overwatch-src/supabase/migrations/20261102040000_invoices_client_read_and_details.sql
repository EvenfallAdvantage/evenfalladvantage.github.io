-- Invoices: persist builder header fields + let client-role members read
-- issued invoices for their own company. NOT yet applied to OverwatchDB.
-- Existing invoices_select/insert/update/delete and the RESTRICTIVE
-- mfa_required_all policy are left untouched.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP POLICY IF EXISTS invoices_select_client ON public.invoices;
CREATE POLICY invoices_select_client ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    status IN ('sent', 'viewed', 'paid', 'overdue')
    AND EXISTS (
      SELECT 1
      FROM public.company_memberships cm
      JOIN public.users u ON u.id = cm.user_id
      WHERE cm.company_id = invoices.company_id
        AND u.supabase_id = ((SELECT auth.uid()))::text
        AND cm.role = 'client'::"CompanyRole"
    )
  );
