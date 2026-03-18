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

GRANT EXECUTE ON FUNCTION get_partner_companies() TO anon, authenticated;
