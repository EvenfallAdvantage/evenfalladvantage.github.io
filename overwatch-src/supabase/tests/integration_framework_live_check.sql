-- =============================================================================
-- Live, ALWAYS-ROLLED-BACK check for 20261011000000_integration_framework.sql.
-- Build the runnable script with:
--   scripts: (sed '/^BEGIN;$/d;/^COMMIT;$/d' migration) wrapped as below.
-- It runs BEGIN; <migration>; <seed + role checks>; then RAISEs an exception
-- whose message is the JSON result table, so the whole transaction (tables,
-- seed rows, Vault untouched) is rolled back no matter what.
-- Personas are real OverwatchDB members (ids only; JWT claims are faked with
-- set_config, no logins happen):
--   A = 0f03bc15… owner 3ad2a814 (also LEAD in 4b9c9385), admin c18bba8f,
--       manager 6d44cf9e, staff 3689872f
--   B = 23b3a4e9… owner 0cb40a02
-- =============================================================================
-- @@MIGRATION@@
CREATE TEMP TABLE _r (n serial, label text, ok boolean, detail text);
GRANT ALL ON _r TO authenticated, anon;
GRANT USAGE ON SEQUENCE _r_n_seq TO authenticated, anon;

-- seed (as postgres)
INSERT INTO public.integration_connections (id, company_id, provider, status, auth_type, vault_secret_id, settings)
VALUES ('aaaaaaaa-0000-0000-0000-00000000000a', '0f03bc15-aa8d-4bd3-956f-90bdd7904091', 'gusto', 'connected', 'oauth_code', gen_random_uuid(), '{}'),
       ('bbbbbbbb-0000-0000-0000-00000000000b', '23b3a4e9-9d01-44a5-a24f-0ff1d541e625', 'checkr', 'connected', 'api_key', gen_random_uuid(), '{}');
INSERT INTO public.integration_events (provider, company_id, external_event_id, type, signature_ok)
VALUES ('gusto', '0f03bc15-aa8d-4bd3-956f-90bdd7904091', 'evt-1', 'employee.updated', true);
INSERT INTO public.integration_jobs (company_id, provider, kind, idempotency_key)
VALUES ('0f03bc15-aa8d-4bd3-956f-90bdd7904091', 'gusto', 'test', 'k1');
INSERT INTO public.integration_oauth_states (state, company_id, provider)
VALUES (repeat('s', 43), '0f03bc15-aa8d-4bd3-956f-90bdd7904091', 'gusto');

CREATE FUNCTION pg_temp.as_user(p_sub text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
$$;

-- ── owner A ──
SELECT pg_temp.as_user('3ad2a814-fc25-49d5-bcb4-8ff49de447ec');
SET LOCAL ROLE authenticated;
INSERT INTO _r(label, ok, detail) SELECT 'owner A sees only A connections', count(*) = 1 AND bool_and(company_id = '0f03bc15-aa8d-4bd3-956f-90bdd7904091'), count(*)::text FROM public.integration_connections;
DO $$ BEGIN PERFORM vault_secret_id FROM public.integration_connections; INSERT INTO _r(label, ok, detail) VALUES ('owner cannot read vault_secret_id', false, 'readable');
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r(label, ok, detail) VALUES ('owner cannot read vault_secret_id', true, '42501'); END $$;
DO $$ BEGIN PERFORM 1 FROM public.integration_oauth_states; INSERT INTO _r(label, ok, detail) VALUES ('owner cannot read oauth_states', false, 'readable');
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r(label, ok, detail) VALUES ('owner cannot read oauth_states', true, '42501'); END $$;
INSERT INTO _r(label, ok, detail) SELECT 'owner A sees A webhook events', count(*) = 1, count(*)::text FROM public.integration_events;
DO $$ BEGIN PERFORM public.integration_acquire_refresh_lock('aaaaaaaa-0000-0000-0000-00000000000a', 60); INSERT INTO _r(label, ok, detail) VALUES ('client cannot call refresh-lock RPC', false, 'callable');
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r(label, ok, detail) VALUES ('client cannot call refresh-lock RPC', true, '42501'); END $$;
DO $$ BEGIN PERFORM * FROM public.integration_claim_jobs(5); INSERT INTO _r(label, ok, detail) VALUES ('client cannot claim jobs', false, 'callable');
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r(label, ok, detail) VALUES ('client cannot claim jobs', true, '42501'); END $$;
RESET ROLE;

-- ── admin A ──
SELECT pg_temp.as_user('c18bba8f-d8de-4ff6-858c-5d66ffedfe67');
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN UPDATE public.integration_connections SET settings = '{"x":1}' WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a'; GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO _r(label, ok, detail) VALUES ('admin A can edit settings', n = 1, n::text); END $$;
DO $$ BEGIN UPDATE public.integration_connections SET status = 'connected', last_test_ok = true WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a'; INSERT INTO _r(label, ok, detail) VALUES ('admin cannot set status/test result directly', false, 'updated');
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r(label, ok, detail) VALUES ('admin cannot set status/test result directly', true, '42501'); END $$;
DO $$ BEGIN INSERT INTO public.integration_connections (company_id, provider, auth_type) VALUES ('0f03bc15-aa8d-4bd3-956f-90bdd7904091', 'docusign', 'oauth_code'); INSERT INTO _r(label, ok, detail) VALUES ('admin cannot insert connection directly', false, 'inserted');
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r(label, ok, detail) VALUES ('admin cannot insert connection directly', true, '42501'); END $$;
DO $$ BEGIN DELETE FROM public.integration_connections WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a'; INSERT INTO _r(label, ok, detail) VALUES ('admin cannot delete connection directly', false, 'deleted');
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r(label, ok, detail) VALUES ('admin cannot delete connection directly', true, '42501'); END $$;
DO $$ BEGIN INSERT INTO public.employee_external_ids (company_id, user_id, provider, external_employee_id) VALUES ('0f03bc15-aa8d-4bd3-956f-90bdd7904091', '400e77e2-a090-44d9-84d8-0fe378ca3eee', 'gusto', 'emp-1');
  INSERT INTO _r(label, ok, detail) VALUES ('admin maps an A member to a vendor id', true, 'inserted');
EXCEPTION WHEN OTHERS THEN INSERT INTO _r(label, ok, detail) VALUES ('admin maps an A member to a vendor id', false, SQLSTATE); END $$;
DO $$ BEGIN INSERT INTO public.employee_external_ids (company_id, user_id, provider, external_employee_id) VALUES ('0f03bc15-aa8d-4bd3-956f-90bdd7904091', '1eaabf79-acbe-4d8c-a199-9c461378c219', 'gusto', 'emp-2');
  INSERT INTO _r(label, ok, detail) VALUES ('admin cannot map a non-member', false, 'inserted');
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r(label, ok, detail) VALUES ('admin cannot map a non-member', true, '42501 (RLS)'); END $$;
RESET ROLE;

-- ── manager A ──
SELECT pg_temp.as_user('6d44cf9e-2ed3-4453-b5c6-ef5fa6dfc37d');
SET LOCAL ROLE authenticated;
INSERT INTO _r(label, ok, detail) SELECT 'manager A reads A connection status', count(*) = 1, count(*)::text FROM public.integration_connections;
INSERT INTO _r(label, ok, detail) SELECT 'manager A reads A jobs', count(*) = 1, count(*)::text FROM public.integration_jobs;
INSERT INTO _r(label, ok, detail) SELECT 'manager A reads A external ids', count(*) = 1, count(*)::text FROM public.employee_external_ids;
INSERT INTO _r(label, ok, detail) SELECT 'manager A cannot read webhook payloads', count(*) = 0, count(*)::text FROM public.integration_events;
DO $$ DECLARE n int; BEGIN UPDATE public.integration_connections SET settings = '{"y":1}' WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a'; GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO _r(label, ok, detail) VALUES ('manager cannot edit settings', n = 0, n::text || ' rows'); END $$;
DO $$ BEGIN INSERT INTO public.employee_external_ids (company_id, user_id, provider, external_employee_id) VALUES ('0f03bc15-aa8d-4bd3-956f-90bdd7904091', '400e77e2-a090-44d9-84d8-0fe378ca3eee', 'quickbooks', 'q-1');
  INSERT INTO _r(label, ok, detail) VALUES ('manager cannot write external ids', false, 'inserted');
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r(label, ok, detail) VALUES ('manager cannot write external ids', true, '42501 (RLS)'); END $$;
RESET ROLE;

-- ── staff A ──
SELECT pg_temp.as_user('3689872f-7a38-455c-8d15-4087ed77ffe0');
SET LOCAL ROLE authenticated;
INSERT INTO _r(label, ok, detail) SELECT 'staff A sees no connections/jobs/ids/events',
  (SELECT count(*) FROM public.integration_connections) + (SELECT count(*) FROM public.integration_jobs)
  + (SELECT count(*) FROM public.employee_external_ids) + (SELECT count(*) FROM public.integration_events) = 0, 'total rows';
RESET ROLE;

-- ── owner B (cross-company) ──
SELECT pg_temp.as_user('0cb40a02-897f-40da-9d98-4f9fa9a16a3b');
SET LOCAL ROLE authenticated;
INSERT INTO _r(label, ok, detail) SELECT 'owner B sees only B connection', count(*) = 1 AND bool_and(company_id = '23b3a4e9-9d01-44a5-a24f-0ff1d541e625'), count(*)::text FROM public.integration_connections;
DO $$ DECLARE n int; BEGIN UPDATE public.integration_connections SET settings = '{"z":1}' WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a'; GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO _r(label, ok, detail) VALUES ('owner B cannot edit A settings', n = 0, n::text || ' rows'); END $$;
INSERT INTO _r(label, ok, detail) SELECT 'owner B sees no A events/jobs/ids',
  (SELECT count(*) FROM public.integration_events) + (SELECT count(*) FROM public.integration_jobs) + (SELECT count(*) FROM public.employee_external_ids) = 0, 'total rows';
RESET ROLE;

-- ── lead (owner-of-A user acting in 4b9c9385 where they are LEAD) ──
SELECT pg_temp.as_user('3ad2a814-fc25-49d5-bcb4-8ff49de447ec');
SET LOCAL ROLE authenticated;
INSERT INTO _r(label, ok, detail) SELECT 'lead role grants nothing in its company', count(*) = 0, count(*)::text FROM public.integration_connections WHERE company_id = '4b9c9385-98c9-4e0e-895c-7f40c3c5ab71';
RESET ROLE;

-- ── anon ──
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$ BEGIN PERFORM 1 FROM public.integration_connections; INSERT INTO _r(label, ok, detail) VALUES ('anon has no access', false, 'readable');
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r(label, ok, detail) VALUES ('anon has no access', true, '42501'); END $$;
RESET ROLE;

-- ── service_role RPCs / constraints (as postgres) ──
DO $$ DECLARE t1 uuid; t2 uuid; t3 uuid; ok boolean;
BEGIN
  t1 := public.integration_acquire_refresh_lock('aaaaaaaa-0000-0000-0000-00000000000a', 60);
  t2 := public.integration_acquire_refresh_lock('aaaaaaaa-0000-0000-0000-00000000000a', 60);
  ok := public.integration_release_refresh_lock('aaaaaaaa-0000-0000-0000-00000000000a', t1);
  t3 := public.integration_acquire_refresh_lock('aaaaaaaa-0000-0000-0000-00000000000a', 60);
  INSERT INTO _r(label, ok, detail) VALUES ('refresh lock: one holder at a time, release frees it', t1 IS NOT NULL AND t2 IS NULL AND ok AND t3 IS NOT NULL, 'acquire/second/release/reacquire');
END $$;
DO $$ DECLARE a int; b int;
BEGIN
  SELECT count(*) INTO a FROM public.integration_claim_jobs(10);
  SELECT count(*) INTO b FROM public.integration_claim_jobs(10);
  INSERT INTO _r(label, ok, detail) VALUES ('job claim: due job claimed once', a = 1 AND b = 0, a || ' then ' || b);
END $$;
DO $$ BEGIN INSERT INTO public.integration_events (provider, company_id, external_event_id, signature_ok) VALUES ('gusto', '0f03bc15-aa8d-4bd3-956f-90bdd7904091', 'evt-1', true);
  INSERT INTO _r(label, ok, detail) VALUES ('webhook dedupe on (provider, event id)', false, 'duplicate accepted');
EXCEPTION WHEN unique_violation THEN INSERT INTO _r(label, ok, detail) VALUES ('webhook dedupe on (provider, event id)', true, '23505'); END $$;
DO $$ BEGIN INSERT INTO public.integration_connections (company_id, provider, status, auth_type) VALUES ('0f03bc15-aa8d-4bd3-956f-90bdd7904091', 'quickbooks', 'connected', 'oauth_code');
  INSERT INTO _r(label, ok, detail) VALUES ('one active payroll provider per company', false, 'second accepted');
EXCEPTION WHEN unique_violation THEN INSERT INTO _r(label, ok, detail) VALUES ('one active payroll provider per company', true, '23505'); END $$;
DO $$ BEGIN INSERT INTO public.integration_connections (company_id, provider, status, auth_type) VALUES ('0f03bc15-aa8d-4bd3-956f-90bdd7904091', 'adp', 'disconnected', 'partner_link');
  INSERT INTO _r(label, ok, detail) VALUES ('disconnected payroll row allowed alongside', true, 'inserted');
EXCEPTION WHEN OTHERS THEN INSERT INTO _r(label, ok, detail) VALUES ('disconnected payroll row allowed alongside', false, SQLSTATE); END $$;

DO $$ BEGIN
  RAISE EXCEPTION 'ROLLBACK_RESULTS %', (SELECT json_agg(json_build_object('n', n, 'ok', ok, 'label', label, 'detail', detail) ORDER BY n) FROM _r);
END $$;
