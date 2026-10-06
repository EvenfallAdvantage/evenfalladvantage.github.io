-- Live-safe version of intake_tokens_rls_test.sql (run 2026-10-06 against OverwatchDB).
-- Creates throwaway fixtures inside one DO block and ends with RAISE EXCEPTION, so
-- everything rolls back; the 28 results are in the error message. Read-only in effect.
DO $t$
DECLARE
  sfx text := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  ca uuid := gen_random_uuid(); cb uuid := gen_random_uuid();
  a1 uuid := gen_random_uuid(); a3 uuid := gen_random_uuid(); a6 uuid := gen_random_uuid(); b1 uuid := gen_random_uuid();
  r record; q text; v text; ok boolean; detail text;
  out text := ''; npass int := 0; nfail int := 0;
BEGIN
  INSERT INTO public.companies (id, name, slug, join_code, updated_at) VALUES
    (ca, 'ZZ Intake Test Acme', 'zz-intake-a-' || sfx, 'ZZA' || sfx, now()),
    (cb, 'ZZ Intake Test Beta', 'zz-intake-b-' || sfx, 'ZZB' || sfx, now());
  INSERT INTO public.users (id, email, first_name, last_name, supabase_id, updated_at)
  SELECT gen_random_uuid(), 'zz-intake-' || sfx || '-' || x.tag || '@example.invalid', 'ZZ', x.tag, x.uid::text, now()
  FROM (VALUES ('a1', a1), ('a3', a3), ('a6', a6), ('b1', b1)) AS x(tag, uid);
  INSERT INTO public.company_memberships (id, user_id, company_id, role, status, updated_at)
  SELECT gen_random_uuid(), u.id, x.cid, x.role::public."CompanyRole", 'active', now()
  FROM (VALUES (a1, ca, 'owner'), (a3, ca, 'manager'), (a6, ca, 'staff'), (b1, cb, 'owner')) AS x(uid, cid, role)
  JOIN public.users u ON u.supabase_id = x.uid::text;
  INSERT INTO public.client_intake_tokens (id, company_id, token, status, source, client_name, client_email, expires_at) VALUES
    (gen_random_uuid(), ca, 'zzhosta' || sfx || '01', 'active', 'hosted', NULL, NULL, NULL),
    (gen_random_uuid(), ca, 'zzapilead' || sfx || '000000000000000', 'active', 'api', 'Lead Person', 'lead@example.invalid', NULL),
    (gen_random_uuid(), ca, 'zzexpir' || sfx || '01', 'active', 'hosted', NULL, NULL, now() - interval '1 day'),
    (gen_random_uuid(), ca, 'zzrevok' || sfx || '01', 'revoked', 'hosted', NULL, NULL, NULL),
    (gen_random_uuid(), cb, 'zzhostb' || sfx || '01', 'active', 'hosted', NULL, NULL, NULL);

  FOR r IN SELECT * FROM (VALUES
    (1,  'I.01 anon lists intake rows (permission denied)', 'error', 'anon', $q$SELECT count(*)::text FROM public.client_intake_tokens$q$),
    (2,  'I.02 anon edits a lead row (permission denied)', 'error', 'anon', $q$UPDATE public.client_intake_tokens SET client_email = 'evil@x.co' WHERE token = '{API}'$q$),
    (3,  'I.03 anon inserts a fake intake row', 'error', 'anon', $q$INSERT INTO public.client_intake_tokens (company_id, token) VALUES ('{A}', 'zzanonins{S}1')$q$),
    (4,  'I.04 anon loads a hosted intake by token [legit]', 'ZZ Intake Test Acme', 'anon', $q$SELECT public.get_intake_by_token('{HA}') -> 'companies' ->> 'name'$q$),
    (5,  'I.05 RPC returns only page fields', 'false', 'anon', $q$SELECT (public.get_intake_by_token('{HA}') ? 'raw_payload' OR public.get_intake_by_token('{HA}') ? 'created_by')::text$q$),
    (6,  'I.06 anon cannot read an API lead via the RPC', 'NULL', 'anon', $q$SELECT public.get_intake_by_token('{API}')::text$q$),
    (7,  'I.07 unknown token returns NULL', 'NULL', 'anon', $q$SELECT public.get_intake_by_token('zzdoesnotexist{S}')::text$q$),
    (8,  'I.08 expired hosted row reports expired', 'expired', 'anon', $q$SELECT public.get_intake_by_token('{EXP}') ->> 'status'$q$),
    (9,  'I.09 anon submits a hosted intake [legit]', 'submitted', 'anon', $q$SELECT public.submit_intake_by_token('{HA}', 'Pat Client', 'pat@example.invalid', '{"venue":"Hall"}'::jsonb) ->> 'status'$q$),
    (10, 'I.10 resubmit while submitted [legit]', 'submitted', 'anon', $q$SELECT public.submit_intake_by_token('{HA}', 'Pat Client', 'pat@example.invalid', '{"venue":"Hall 2"}'::jsonb) ->> 'status'$q$),
    (11, 'I.11 submit to an expired link returns NULL', 'NULL', 'anon', $q$SELECT public.submit_intake_by_token('{EXP}', 'X', 'x@example.invalid', '{}'::jsonb)::text$q$),
    (12, 'I.12 submit to a revoked link returns NULL', 'NULL', 'anon', $q$SELECT public.submit_intake_by_token('{REV}', 'X', 'x@example.invalid', '{}'::jsonb)::text$q$),
    (13, 'I.13 submit cannot overwrite an API lead', 'NULL', 'anon', $q$SELECT public.submit_intake_by_token('{API}', 'X', 'x@example.invalid', '{}'::jsonb)::text$q$),
    (14, 'I.14 submit rejects a bad email', 'error', 'anon', $q$SELECT public.submit_intake_by_token('{HB}', 'X', 'not-an-email', '{}'::jsonb)::text$q$),
    (15, 'I.15 submit rejects non-object data', 'error', 'anon', $q$SELECT public.submit_intake_by_token('{HB}', 'X', 'x@example.invalid', '[1,2]'::jsonb)::text$q$),
    (16, 'I.16 submit rejects > 64 KiB data', 'error', 'anon', $q$SELECT public.submit_intake_by_token('{HB}', 'X', 'x@example.invalid', jsonb_build_object('a', repeat('x', 70000)))::text$q$),
    (17, 'I.20 staff in Acme reads intake rows (0)', '0', 'a6', $q$SELECT count(*)::text FROM public.client_intake_tokens$q$),
    (18, 'I.21 staff deletes intake rows (0)', '0', 'a6', $q$WITH d AS (DELETE FROM public.client_intake_tokens RETURNING 1) SELECT count(*)::text FROM d$q$),
    (19, 'I.22 staff creates an intake link', 'error', 'a6', $q$INSERT INTO public.client_intake_tokens (company_id, token) VALUES ('{A}', 'zzstaffcr{S}01')$q$),
    (20, 'I.23 Beta owner reads only Beta rows', '1', 'b1', $q$SELECT count(*)::text FROM public.client_intake_tokens$q$),
    (21, 'I.24 Beta owner inserts into Acme', 'error', 'b1', $q$INSERT INTO public.client_intake_tokens (company_id, token) VALUES ('{A}', 'zzbetaacm{S}01')$q$),
    (22, 'I.25 Beta owner deletes Acme rows (0)', '0', 'b1', $q$WITH d AS (DELETE FROM public.client_intake_tokens WHERE company_id = '{A}' RETURNING 1) SELECT count(*)::text FROM d$q$),
    (23, 'I.30 Acme manager sees Acme rows incl. API leads [legit]', '4', 'a3', $q$SELECT count(*)::text FROM public.client_intake_tokens$q$),
    (24, 'I.31 Acme manager creates a link [legit]', 'ok', 'a3', $q$INSERT INTO public.client_intake_tokens (company_id, token) VALUES ('{A}', '{MGR}')$q$),
    (25, 'I.32 Acme manager revokes a link [legit]', '1', 'a3', $q$WITH u AS (UPDATE public.client_intake_tokens SET status = 'revoked' WHERE token = '{MGR}' RETURNING 1) SELECT count(*)::text FROM u$q$),
    (26, 'I.33 Acme manager moves a row to Beta', 'error', 'a3', $q$UPDATE public.client_intake_tokens SET company_id = '{B}' WHERE token = '{MGR}'$q$),
    (27, 'I.34 Acme owner deletes a link [legit]', '1', 'a1', $q$WITH d AS (DELETE FROM public.client_intake_tokens WHERE token = '{MGR}' RETURNING 1) SELECT count(*)::text FROM d$q$),
    (28, 'I.40 submitted row has the client data', 'Hall 2|pat@example.invalid', 'postgres', $q$SELECT (data ->> 'venue') || '|' || client_email FROM public.client_intake_tokens WHERE token = '{HA}'$q$)
  ) AS t(n, label, expect, who, sql) ORDER BY n LOOP
    q := r.sql;
    q := replace(q, '{A}', ca::text); q := replace(q, '{B}', cb::text); q := replace(q, '{S}', sfx);
    q := replace(q, '{HA}', 'zzhosta' || sfx || '01'); q := replace(q, '{HB}', 'zzhostb' || sfx || '01');
    q := replace(q, '{API}', 'zzapilead' || sfx || '000000000000000');
    q := replace(q, '{EXP}', 'zzexpir' || sfx || '01'); q := replace(q, '{REV}', 'zzrevok' || sfx || '01');
    q := replace(q, '{MGR}', 'zzmgrcr' || sfx || '01');
    v := NULL;
    BEGIN
      IF r.who = 'anon' THEN
        PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
        PERFORM set_config('role', 'anon', true);
      ELSIF r.who <> 'postgres' THEN
        PERFORM set_config('request.jwt.claims', json_build_object('sub',
          CASE r.who WHEN 'a1' THEN a1 WHEN 'a3' THEN a3 WHEN 'a6' THEN a6 ELSE b1 END, 'role', 'authenticated')::text, true);
        PERFORM set_config('role', 'authenticated', true);
      END IF;
      IF q ~* '^\s*(insert|update|delete)\M' AND q !~* '\mreturning\M' THEN
        EXECUTE q; v := 'done';
      ELSE
        EXECUTE q INTO v;
      END IF;
      PERFORM set_config('role', 'none', true);
      PERFORM set_config('request.jwt.claims', '', true);
      IF r.expect = 'error' THEN ok := false; detail := 'expected error, got ' || coalesce(v, 'NULL');
      ELSIF r.expect = 'ok' THEN ok := true; detail := coalesce(v, 'NULL');
      ELSE ok := coalesce(v, 'NULL') = r.expect; detail := 'got ' || coalesce(v, 'NULL');
      END IF;
    EXCEPTION WHEN others THEN
      ok := r.expect = 'error'; detail := SQLERRM;
    END;
    IF ok THEN npass := npass + 1; ELSE nfail := nfail + 1; END IF;
    out := out || E'\n' || CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END || r.label || ' | ' || left(detail, 90);
  END LOOP;
  PERFORM set_config('role', 'none', true);
  RAISE EXCEPTION 'INTAKE_LIVE_CHECKS (rolled back) passed=% failed=% %', npass, nfail, out;
END
$t$;
