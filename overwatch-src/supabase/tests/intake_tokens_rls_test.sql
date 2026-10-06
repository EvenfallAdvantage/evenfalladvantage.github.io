-- =============================================================================
-- LOCAL-ONLY stub + test plan for 20261006200000_intake_tokens_rls.sql.
-- Run on a throwaway Postgres AFTER local_stub_schema.sql, rls_hardening_seed.sql
-- and the rls_hardening migration. Two phases:
--   psql -d ow_rls_test -v phase=stub -f tests/intake_tokens_rls_test.sql     # table + live policies + rows
--   psql -d ow_rls_test -v phase=test -f tests/intake_tokens_rls_test.sql     # checks
-- (apply the intake migration between the two to test it, or skip it to see
-- today's behaviour). Never run against a Supabase project.
-- =============================================================================
\set ON_ERROR_STOP 1
\if :{?phase}
\else
  \set phase test
\endif
SELECT :'phase' = 'stub' AS is_stub \gset
\if :is_stub
RESET ROLE;
CREATE TABLE IF NOT EXISTS public.events (id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.api_keys (id uuid PRIMARY KEY);
CREATE TABLE public.client_intake_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  client_name text, client_email text, data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status = ANY (ARRAY['active','submitted','expired','revoked'])),
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), expires_at timestamptz,
  source text NOT NULL DEFAULT 'hosted' CHECK (source = ANY (ARRAY['hosted','api','webhook'])),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  raw_payload jsonb, submitted_at timestamptz
);
ALTER TABLE public.client_intake_tokens ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.client_intake_tokens TO anon, authenticated, service_role;
-- live policies (pg_policies, 2026-10-06)
CREATE POLICY "Public read by token" ON public.client_intake_tokens FOR SELECT TO public USING (true);
CREATE POLICY "Public update by token" ON public.client_intake_tokens FOR UPDATE TO public USING (status = ANY (ARRAY['active'::text, 'submitted'::text]));
CREATE POLICY "Authenticated insert" ON public.client_intake_tokens FOR INSERT TO public WITH CHECK (( SELECT ( SELECT auth.uid() AS uid) AS uid) IS NOT NULL);
CREATE POLICY "Authenticated delete" ON public.client_intake_tokens FOR DELETE TO public USING (( SELECT ( SELECT auth.uid() AS uid) AS uid) IS NOT NULL);
INSERT INTO public.client_intake_tokens (id, company_id, token, status, source, client_name, client_email, expires_at) VALUES
  ('70000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-00000000000a', 'hostedtokenacme01', 'active', 'hosted', NULL, NULL, NULL),
  ('70000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-00000000000a', 'apileadtokenacme0000000000000001', 'active', 'api', 'Lead Person', 'lead@example.com', NULL),
  ('70000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-00000000000a', 'expiredtokenacme1', 'active', 'hosted', NULL, NULL, now() - interval '1 day'),
  ('70000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-00000000000a', 'revokedtokenacme1', 'revoked', 'hosted', NULL, NULL, NULL),
  ('70000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-00000000000b', 'hostedtokenbeta01', 'active', 'hosted', NULL, NULL, NULL);
\else
RESET ROLE;
DROP SCHEMA IF EXISTS rls_test CASCADE;
CREATE SCHEMA rls_test;
GRANT USAGE ON SCHEMA rls_test TO anon, authenticated;
CREATE TABLE rls_test.results (n serial PRIMARY KEY, label text, ok boolean, detail text);
CREATE TABLE rls_test.vars (k text PRIMARY KEY, v text);
GRANT ALL ON rls_test.results, rls_test.vars TO anon, authenticated;
GRANT USAGE ON SEQUENCE rls_test.results_n_seq TO anon, authenticated;
CREATE FUNCTION rls_test.login(p text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_uid text := '00000000-0000-0000-0000-0000000000' || p; v_email text;
BEGIN
  RESET ROLE;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid::uuid;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'email', v_email, 'role', 'authenticated')::text, false);
  SET ROLE authenticated;
END $$;
CREATE FUNCTION rls_test.anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', false);
  SET ROLE anon;
END $$;
CREATE FUNCTION rls_test.superuser() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', false);
END $$;
CREATE FUNCTION rls_test.t(p_label text, p_expect text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v text; v_ok boolean; v_detail text;
BEGIN
  BEGIN
    IF p_sql ~* '^\s*(insert|update|delete)\M' AND p_sql !~* '\mreturning\M' THEN
      EXECUTE p_sql;           -- plain DML: no result column
      v := 'done';
    ELSE
      EXECUTE p_sql INTO v;
    END IF;
    IF p_expect = 'error' THEN v_ok := false; v_detail := 'expected an error, got: ' || COALESCE(v, 'NULL');
    ELSIF p_expect = 'ok' THEN v_ok := true; v_detail := COALESCE(v, 'NULL');
    ELSE v_ok := COALESCE(v, 'NULL') = p_expect; v_detail := 'got: ' || COALESCE(v, 'NULL');
    END IF;
  EXCEPTION WHEN others THEN
    v_ok := p_expect = 'error'; v_detail := SQLERRM;
  END;
  INSERT INTO rls_test.results (label, ok, detail) VALUES (p_label, v_ok, left(v_detail, 160));
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA rls_test TO anon, authenticated;

-- anon (public website / client-intake page)
SELECT rls_test.anon();
SELECT rls_test.t('I.01 anon lists all intake rows (permission denied)', 'error',
  $q$SELECT count(*)::text FROM client_intake_tokens$q$);
SELECT rls_test.t('I.02 anon edits a lead row it found by id (permission denied)', 'error',
  $q$UPDATE client_intake_tokens SET client_email = 'evil@x.co' WHERE id = '70000000-0000-0000-0000-0000000000a2'$q$);
SELECT rls_test.t('I.03 anon inserts a fake intake row', 'error',
  $q$INSERT INTO client_intake_tokens (company_id, token) VALUES ('20000000-0000-0000-0000-00000000000a', 'anoninsertedtoken1')$q$);
SELECT rls_test.t('I.04 anon loads a hosted intake by token [legit]', 'Acme Security',
  $q$SELECT get_intake_by_token('hostedtokenacme01') -> 'companies' ->> 'name'$q$);
SELECT rls_test.t('I.05 RPC returns only page fields (no created_by / raw_payload)', 'false',
  $q$SELECT (get_intake_by_token('hostedtokenacme01') ? 'raw_payload' OR get_intake_by_token('hostedtokenacme01') ? 'created_by')::text$q$);
SELECT rls_test.t('I.06 anon cannot read an API lead via the RPC', 'NULL',
  $q$SELECT get_intake_by_token('apileadtokenacme0000000000000001')::text$q$);
SELECT rls_test.t('I.07 unknown token returns NULL', 'NULL',
  $q$SELECT get_intake_by_token('doesnotexist00000')::text$q$);
SELECT rls_test.t('I.08 expired hosted row reports status expired', 'expired',
  $q$SELECT get_intake_by_token('expiredtokenacme1') ->> 'status'$q$);
SELECT rls_test.t('I.09 anon submits a hosted intake [legit]', 'submitted',
  $q$SELECT submit_intake_by_token('hostedtokenacme01', 'Pat Client', 'pat@example.com', '{"venue":"Hall"}'::jsonb) ->> 'status'$q$);
SELECT rls_test.t('I.10 resubmit while submitted is allowed [legit]', 'submitted',
  $q$SELECT submit_intake_by_token('hostedtokenacme01', 'Pat Client', 'pat@example.com', '{"venue":"Hall 2"}'::jsonb) ->> 'status'$q$);
SELECT rls_test.t('I.11 submit to an expired link returns NULL', 'NULL',
  $q$SELECT submit_intake_by_token('expiredtokenacme1', 'X', 'x@example.com', '{}'::jsonb)::text$q$);
SELECT rls_test.t('I.12 submit to a revoked link returns NULL', 'NULL',
  $q$SELECT submit_intake_by_token('revokedtokenacme1', 'X', 'x@example.com', '{}'::jsonb)::text$q$);
SELECT rls_test.t('I.13 submit cannot overwrite an API lead', 'NULL',
  $q$SELECT submit_intake_by_token('apileadtokenacme0000000000000001', 'X', 'x@example.com', '{}'::jsonb)::text$q$);
SELECT rls_test.t('I.14 submit rejects a bad email', 'error',
  $q$SELECT submit_intake_by_token('hostedtokenbeta01', 'X', 'not-an-email', '{}'::jsonb)::text$q$);
SELECT rls_test.t('I.15 submit rejects non-object data', 'error',
  $q$SELECT submit_intake_by_token('hostedtokenbeta01', 'X', 'x@example.com', '[1,2]'::jsonb)::text$q$);
SELECT rls_test.t('I.16 submit rejects > 64 KiB data', 'error',
  $q$SELECT submit_intake_by_token('hostedtokenbeta01', 'X', 'x@example.com', jsonb_build_object('a', repeat('x', 70000)))::text$q$);

-- authenticated
SELECT rls_test.login('a6');
SELECT rls_test.t('I.20 staff in Acme reads intake rows (0)', '0',
  $q$SELECT count(*)::text FROM client_intake_tokens$q$);
SELECT rls_test.t('I.21 staff deletes intake rows (0)', '0',
  $q$WITH d AS (DELETE FROM client_intake_tokens RETURNING 1) SELECT count(*)::text FROM d$q$);
SELECT rls_test.t('I.22 staff creates an intake link', 'error',
  $q$INSERT INTO client_intake_tokens (company_id, token) VALUES ('20000000-0000-0000-0000-00000000000a', 'staffcreatedtoken1')$q$);

SELECT rls_test.login('b1');
SELECT rls_test.t('I.23 Beta owner reads only Beta rows', '1',
  $q$SELECT count(*)::text FROM client_intake_tokens$q$);
SELECT rls_test.t('I.24 Beta owner inserts into Acme', 'error',
  $q$INSERT INTO client_intake_tokens (company_id, token) VALUES ('20000000-0000-0000-0000-00000000000a', 'betaintoacmetoken')$q$);
SELECT rls_test.t('I.25 Beta owner deletes Acme rows (0)', '0',
  $q$WITH d AS (DELETE FROM client_intake_tokens WHERE company_id = '20000000-0000-0000-0000-00000000000a' RETURNING 1) SELECT count(*)::text FROM d$q$);

SELECT rls_test.login('a3');
SELECT rls_test.t('I.30 Acme manager sees Acme rows incl. API leads [legit]', '4',
  $q$SELECT count(*)::text FROM client_intake_tokens$q$);
SELECT rls_test.t('I.31 Acme manager creates a link [legit]', 'ok',
  $q$INSERT INTO client_intake_tokens (company_id, token) VALUES ('20000000-0000-0000-0000-00000000000a', 'managercreatedtok1')$q$);
SELECT rls_test.t('I.32 Acme manager revokes a link [legit]', '1',
  $q$WITH u AS (UPDATE client_intake_tokens SET status = 'revoked' WHERE token = 'managercreatedtok1' RETURNING 1) SELECT count(*)::text FROM u$q$);
SELECT rls_test.t('I.33 Acme manager moves a row to Beta', 'error',
  $q$UPDATE client_intake_tokens SET company_id = '20000000-0000-0000-0000-00000000000b' WHERE token = 'managercreatedtok1'$q$);

SELECT rls_test.login('a1');
SELECT rls_test.t('I.34 Acme owner deletes a link [legit]', '1',
  $q$WITH d AS (DELETE FROM client_intake_tokens WHERE token = 'managercreatedtok1' RETURNING 1) SELECT count(*)::text FROM d$q$);

SELECT rls_test.superuser();
SELECT rls_test.t('I.40 submitted row has the client data', 'Hall 2|pat@example.com',
  $q$SELECT (data ->> 'venue') || '|' || client_email FROM client_intake_tokens WHERE token = 'hostedtokenacme01'$q$);

\pset pager off
SELECT n, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, label, detail FROM rls_test.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS passed, count(*) FILTER (WHERE NOT ok) AS failed FROM rls_test.results;
\endif
