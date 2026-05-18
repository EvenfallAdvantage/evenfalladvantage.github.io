-- Public RPC function to return company names + logos for the landing page partners section.
-- Uses SECURITY DEFINER so anonymous (unauthenticated) visitors can call it
-- without exposing sensitive columns like join_code or settings.

CREATE OR REPLACE FUNCTION get_partner_companies()
RETURNS TABLE (name TEXT, logo_url TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT c.name, c.logo_url
  FROM companies c
  ORDER BY c.created_at ASC;
$$;

-- Revoke the Postgres default (PUBLIC) then explicitly grant to
-- anon + authenticated. The explicit grants document that public
-- (unauthenticated) access is intentional: this powers the landing
-- page partner-logo carousel and exposes only marketing data.
REVOKE EXECUTE ON FUNCTION public.get_partner_companies() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_partner_companies() TO anon, authenticated;
