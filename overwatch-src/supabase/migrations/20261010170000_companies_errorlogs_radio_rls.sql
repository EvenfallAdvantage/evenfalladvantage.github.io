-- =============================================================================
-- 20261010170000_companies_errorlogs_radio_rls.sql
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY.
-- Status: NOT APPLIED (draft). Apply AFTER the matching frontend is live
--         (careers / apply / intake-share pages call get_public_company).
-- Rollback: rollback/20261010170000_companies_errorlogs_radio_rls.rollback.sql
--
-- Live state read 2026-10-10:
--   companies_select   SELECT TO authenticated USING true        <- every company, incl. settings/pay rates
--   companies_update   UPDATE TO authenticated is_company_owner_admin(id)
--   error_logs "Company admins can view error logs"  SELECT USING is_company_member(company_id)
--   error_logs "Authenticated users can log errors"  INSERT CHECK user_id is NULL or mine
--   set_company_radio_state(uuid,text): any member (my_company_role IS NOT NULL)
--
-- Change:
--   1. companies SELECT: members of that company only (is_company_member).
--      Cross-company / anon needs go through narrow SECURITY DEFINER functions:
--        get_public_company(p_company_id, p_slug) -> id, name, slug, logo_url,
--          brand_color, accent_color, website_url (branding only) for the
--          public careers / apply / intake-share pages.
--      Already narrow and unchanged: join_company_by_code, get_intake_by_token,
--      get_partner_companies, company_exists, create_company_with_owner.
--   2. error_logs SELECT: owner/admin of that company only.
--      INSERT still allowed for signed-in users; company_id must now be NULL or
--      a company you belong to (no planting logs in another company's viewer).
--   3. set_company_radio_state: owner/admin only (the only UI is
--      /admin/settings, which is owner/admin-only).
-- =============================================================================

BEGIN;

-- 1. companies ---------------------------------------------------------------
DROP POLICY IF EXISTS companies_select ON public.companies;
CREATE POLICY companies_select ON public.companies
  FOR SELECT TO authenticated
  USING (public.is_company_member(id));

CREATE OR REPLACE FUNCTION public.get_public_company(
  p_company_id uuid DEFAULT NULL,
  p_slug text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, name text, slug text, logo_url text,
  brand_color text, accent_color text, website_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT c.id, c.name::text, c.slug::text, c.logo_url::text,
         c.brand_color::text, c.accent_color::text, c.website_url::text
  FROM public.companies c
  WHERE (p_company_id IS NOT NULL AND c.id = p_company_id)
     OR (p_company_id IS NULL AND p_slug IS NOT NULL
         AND length(p_slug) <= 200 AND c.slug = p_slug)
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_public_company(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_company(uuid, text) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.get_public_company(uuid, text) IS
  'Branding-only company lookup (by id or slug) for public pages: careers, apply, intake share.';

-- 2. error_logs --------------------------------------------------------------
DROP POLICY IF EXISTS "Company admins can view error logs" ON public.error_logs;
CREATE POLICY "Company admins can view error logs" ON public.error_logs
  FOR SELECT TO authenticated
  USING (public.is_company_owner_admin(company_id));

DROP POLICY IF EXISTS "Authenticated users can log errors" ON public.error_logs;
CREATE POLICY "Authenticated users can log errors" ON public.error_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IS NULL OR user_id IN (
      SELECT u.id FROM public.users u
      WHERE u.supabase_id = (SELECT auth.uid())::text))
    AND (company_id IS NULL OR public.is_company_member(company_id))
  );

-- 3. radio state -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_company_radio_state(p_company_id uuid, p_state text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NOT public.is_company_owner_admin(p_company_id) THEN
    RAISE EXCEPTION 'Only a company owner or admin can change the radio state'
      USING ERRCODE = '42501';
  END IF;
  IF p_state IS NOT NULL AND length(p_state) > 20000 THEN
    RAISE EXCEPTION 'radio state too large' USING ERRCODE = '22023';
  END IF;
  UPDATE public.companies SET radio_state = p_state WHERE id = p_company_id;
END
$$;

COMMIT;
