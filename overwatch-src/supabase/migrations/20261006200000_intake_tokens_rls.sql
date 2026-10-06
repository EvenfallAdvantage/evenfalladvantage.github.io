-- =============================================================================
-- 20261006200000_intake_tokens_rls.sql
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY.
-- Status: DRAFT. Not applied. Apply BEFORE putting an intake key on the
--         public website (see PR "feat/intake-leads" go-live checklist).
-- Rollback: supabase/migrations/rollback/20261006200000_intake_tokens_rls.rollback.sql
-- Depends on: 20261006175319_rls_hardening.sql (role_rank, my_company_role).
--
-- Problem (live policies read 2026-10-06):
--   "Public read by token"   SELECT  TO public USING (true)
--   "Public update by token" UPDATE  TO public USING (status IN ('active','submitted'))
--   "Authenticated insert"   INSERT  TO public WITH CHECK (auth.uid() IS NOT NULL)
--   "Authenticated delete"   DELETE  TO public USING (auth.uid() IS NOT NULL)
-- Despite the names, nothing checks the token or the company: anyone with the
-- public anon key can list, read and edit every intake row of every company,
-- and any signed-in user can insert into / delete from any company. Website
-- leads (names, emails, phone numbers, messages) would land in this table.
--
-- Fix:
--   * Company managers and above (role_rank >= manager) can read and manage
--     their own company's rows. Nobody else reads the table directly.
--   * The public client-intake page uses two SECURITY DEFINER RPCs that work
--     on exactly one row identified by its token, only for hosted (shared
--     link) rows, and only return the fields the page needs.
--   * intake-ingest (service_role) is unaffected.
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.client_intake_tokens') IS NULL
     OR to_regclass('public.company_memberships') IS NULL
     OR to_regprocedure('public.my_company_role(uuid)') IS NULL
     OR to_regprocedure('public.role_rank(text)') IS NULL THEN
    RAISE EXCEPTION 'Wrong database or missing rls_hardening helpers: this migration is for OverwatchDB after 20261006175319';
  END IF;
END
$guard$;

DROP POLICY IF EXISTS "Public read by token" ON public.client_intake_tokens;
DROP POLICY IF EXISTS "Public update by token" ON public.client_intake_tokens;
DROP POLICY IF EXISTS "Authenticated insert" ON public.client_intake_tokens;
DROP POLICY IF EXISTS "Authenticated delete" ON public.client_intake_tokens;

ALTER TABLE public.client_intake_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY intake_tokens_manager_select ON public.client_intake_tokens
  FOR SELECT TO authenticated
  USING (public.role_rank(public.my_company_role(company_id)) >= public.role_rank('manager'));

CREATE POLICY intake_tokens_manager_insert ON public.client_intake_tokens
  FOR INSERT TO authenticated
  WITH CHECK (public.role_rank(public.my_company_role(company_id)) >= public.role_rank('manager'));

CREATE POLICY intake_tokens_manager_update ON public.client_intake_tokens
  FOR UPDATE TO authenticated
  USING (public.role_rank(public.my_company_role(company_id)) >= public.role_rank('manager'))
  WITH CHECK (public.role_rank(public.my_company_role(company_id)) >= public.role_rank('manager'));

CREATE POLICY intake_tokens_manager_delete ON public.client_intake_tokens
  FOR DELETE TO authenticated
  USING (public.role_rank(public.my_company_role(company_id)) >= public.role_rank('manager'));

-- Defence in depth: the browser's anon role has no direct table access at all.
REVOKE ALL ON public.client_intake_tokens FROM anon;

-- ── Public token RPCs (client-intake page) ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_intake_by_token(p_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', t.id,
    'token', t.token,
    'status', CASE
                WHEN t.status IN ('active', 'submitted') AND t.expires_at IS NOT NULL AND t.expires_at < now()
                THEN 'expired' ELSE t.status END,
    'client_name', t.client_name,
    'client_email', t.client_email,
    'data', COALESCE(t.data, '{}'::jsonb),
    'expires_at', t.expires_at,
    'source', t.source,
    'companies', jsonb_build_object(
      'name', c.name, 'logo_url', c.logo_url, 'brand_color', c.brand_color, 'website_url', c.website_url)
  )
  FROM public.client_intake_tokens t
  JOIN public.companies c ON c.id = t.company_id
  WHERE p_token IS NOT NULL
    AND length(p_token) BETWEEN 16 AND 64
    AND t.token = p_token
    AND t.source = 'hosted'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.submit_intake_by_token(
  p_token text, p_client_name text, p_client_email text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.client_intake_tokens%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) NOT BETWEEN 16 AND 64 THEN
    RETURN NULL;
  END IF;
  IF p_client_name IS NULL OR length(btrim(p_client_name)) = 0 OR length(p_client_name) > 200 THEN
    RAISE EXCEPTION 'invalid client name' USING ERRCODE = '22023';
  END IF;
  IF p_client_email IS NULL OR length(p_client_email) > 254 OR p_client_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'invalid client email' USING ERRCODE = '22023';
  END IF;
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' OR octet_length(p_data::text) > 65536 THEN
    RAISE EXCEPTION 'invalid intake data' USING ERRCODE = '22023';
  END IF;

  UPDATE public.client_intake_tokens t
     SET client_name = btrim(p_client_name),
         client_email = btrim(p_client_email),
         data = p_data,
         status = 'submitted',
         submitted_at = now(),
         updated_at = now()
   WHERE t.token = p_token
     AND t.source = 'hosted'
     AND t.status IN ('active', 'submitted')
     AND (t.expires_at IS NULL OR t.expires_at > now())
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'submitted_at', v_row.submitted_at);
END
$$;

REVOKE ALL ON FUNCTION public.get_intake_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_intake_by_token(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_intake_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_intake_by_token(text, text, text, jsonb) TO anon, authenticated;

COMMIT;
