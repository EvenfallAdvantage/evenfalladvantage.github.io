-- Rollback for 20261010170000_companies_errorlogs_radio_rls.sql
-- Restores the exact live state read 2026-10-10. get_public_company is kept
-- (harmless, branding only) so the new frontend keeps working; drop it only
-- after reverting the frontend:  DROP FUNCTION public.get_public_company(uuid, text);
BEGIN;

DROP POLICY IF EXISTS companies_select ON public.companies;
CREATE POLICY companies_select ON public.companies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Company admins can view error logs" ON public.error_logs;
CREATE POLICY "Company admins can view error logs" ON public.error_logs
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Authenticated users can log errors" ON public.error_logs;
CREATE POLICY "Authenticated users can log errors" ON public.error_logs
  FOR INSERT TO authenticated
  WITH CHECK ((user_id IS NULL) OR (user_id IN (
    SELECT users.id FROM public.users
    WHERE users.supabase_id = ((SELECT (SELECT auth.uid() AS uid) AS uid))::text)));

CREATE OR REPLACE FUNCTION public.set_company_radio_state(p_company_id uuid, p_state text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF public.my_company_role(p_company_id) IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_state IS NOT NULL AND length(p_state) > 20000 THEN
    RAISE EXCEPTION 'radio state too large' USING ERRCODE = '22023';
  END IF;
  UPDATE public.companies SET radio_state = p_state WHERE id = p_company_id;
END
$$;

COMMIT;
