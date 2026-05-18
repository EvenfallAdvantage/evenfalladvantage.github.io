-- ============================================================
-- Add website_url column to companies + update partner RPC
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Add website_url column
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS website_url TEXT DEFAULT NULL;

-- 2. Update get_partner_companies to return website_url
-- Must drop first because return type changed (added website_url column)
DROP FUNCTION IF EXISTS public.get_partner_companies();
CREATE OR REPLACE FUNCTION public.get_partner_companies()
RETURNS TABLE (name TEXT, logo_url TEXT, website_url TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT c.name, c.logo_url, c.website_url
  FROM public.companies c
  WHERE c.logo_url IS NOT NULL AND c.logo_url <> ''
  ORDER BY c.created_at ASC;
$$;

-- Revoke the Postgres default (PUBLIC) then explicitly grant to
-- anon + authenticated. The explicit grants document that public
-- (unauthenticated) access is intentional: this powers the landing
-- page partner-logo carousel and exposes only marketing data.
REVOKE EXECUTE ON FUNCTION public.get_partner_companies() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_partner_companies() TO anon, authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
