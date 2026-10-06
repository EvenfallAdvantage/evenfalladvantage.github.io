-- Live-safe check for eadb/20261006210000_eadb_assessments_admin_write.sql
-- against the LEGACY EADB (vaagvairvwmgyzsmymhs). One DO block that:
--   phase 1: runs the admin writes with today's policies (expected to fail),
--   then creates the three policies exactly as in the migration,
--   phase 2: runs the full check list,
-- and ends with RAISE EXCEPTION, so the policies, fixtures and every write roll
-- back. Read-only in effect. It impersonates the existing EADB admin's user id
-- (administrators.user_id has an FK to auth.users, so no fake admin is made);
-- the id is never printed. Fixtures are two 'ZZ ...' assessments.
DO $t$
DECLARE
  adm uuid; other uuid := gen_random_uuid();
  a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid();
  real_before text; real_after text;
  r record; q text; v text; ok boolean; detail text;
  out text := ''; npass int := 0; nfail int := 0;
BEGIN
  SELECT user_id INTO adm FROM public.administrators WHERE user_id IS NOT NULL LIMIT 1;
  IF adm IS NULL THEN RAISE EXCEPTION 'no EADB admin to impersonate'; END IF;
  SELECT md5(string_agg(a::text, ',' ORDER BY id)) INTO real_before FROM public.assessments a;
  INSERT INTO public.assessments (id, assessment_name, total_questions, passing_score) VALUES
    (a1, 'ZZ live check one', 10, 80), (a2, 'ZZ live check two', 10, 80);

  FOR r IN SELECT * FROM (VALUES
    (1,  'P1.01 TODAY admin creates an assessment (fails today)', 'error', 'adm', $q$INSERT INTO public.assessments (assessment_name, total_questions, passing_score) VALUES ('ZZ live new', 10, 80)$q$),
    (2,  'P1.02 TODAY admin saves questions (0 rows today)', '0', 'adm', $q$WITH u AS (UPDATE public.assessments SET total_questions = 1 WHERE id = '{A1}' RETURNING 1) SELECT count(*)::text FROM u$q$),
    (3,  '-- create policies --', 'ok', 'postgres', $q$CREATE POLICY "Admins can insert assessments" ON public.assessments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.administrators a WHERE a.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can update assessments" ON public.assessments AS PERMISSIVE FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.administrators a WHERE a.user_id = (SELECT auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.administrators a WHERE a.user_id = (SELECT auth.uid())));
CREATE POLICY "Admins can delete assessments" ON public.assessments AS PERMISSIVE FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.administrators a WHERE a.user_id = (SELECT auth.uid())))$q$),
    (4,  'A.01 admin creates a module assessment [legit]', 'ok', 'adm', $q$INSERT INTO public.assessments (assessment_name, category, icon, total_questions, passing_score, time_limit_minutes) VALUES ('ZZ live new', 'Miscellaneous', 'fa-x', 10, 80, 20)$q$),
    (5,  'A.02 admin saves questions_json [legit]', '1', 'adm', $q$WITH u AS (UPDATE public.assessments SET questions_json = '[{"q":"x"}]', total_questions = 1, updated_at = now() WHERE id = '{A1}' RETURNING 1) SELECT count(*)::text FROM u$q$),
    (6,  'A.03 admin renames [legit]', '1', 'adm', $q$WITH u AS (UPDATE public.assessments SET assessment_name = 'ZZ live check two renamed', category = 'Event Security Core' WHERE id = '{A2}' RETURNING 1) SELECT count(*)::text FROM u$q$),
    (7,  'A.04 admin sets total_questions [legit]', '1', 'adm', $q$WITH u AS (UPDATE public.assessments SET total_questions = 7 WHERE id = '{A2}' RETURNING 1) SELECT count(*)::text FROM u$q$),
    (8,  'A.05 admin deletes an assessment [legit]', '1', 'adm', $q$WITH d AS (DELETE FROM public.assessments WHERE assessment_name = 'ZZ live new' RETURNING 1) SELECT count(*)::text FROM d$q$),
    (9,  'A.10 non-admin user creates an assessment', 'error', 'other', $q$INSERT INTO public.assessments (assessment_name, total_questions, passing_score) VALUES ('ZZ live other', 1, 1)$q$),
    (10, 'A.11 non-admin user updates assessments (0 rows)', '0', 'other', $q$WITH u AS (UPDATE public.assessments SET total_questions = 99 RETURNING 1) SELECT count(*)::text FROM u$q$),
    (11, 'A.12 non-admin user deletes assessments (0 rows)', '0', 'other', $q$WITH d AS (DELETE FROM public.assessments RETURNING 1) SELECT count(*)::text FROM d$q$),
    (12, 'A.13 non-admin user still reads assessments [unchanged]', 'ok', 'other', $q$SELECT count(*)::text FROM public.assessments$q$),
    (13, 'A.14 non-admin user makes self an admin (real policy)', 'error', 'other', $q$INSERT INTO public.administrators (user_id, email, first_name, last_name) VALUES ('{OTHER}', 'zz@example.invalid', 'Z', 'Z')$q$),
    (14, 'A.25 no-uid session creates an assessment', 'error', 'nouid', $q$INSERT INTO public.assessments (assessment_name, total_questions, passing_score) VALUES ('ZZ live nouid', 1, 1)$q$),
    (15, 'A.26 data check: admin edits landed', 'ZZ live check one|1|80 ; ZZ live check two renamed|7|80', 'postgres', $q$SELECT string_agg(assessment_name || '|' || total_questions || '|' || passing_score::int, ' ; ' ORDER BY assessment_name) FROM public.assessments WHERE id IN ('{A1}', '{A2}')$q$),
    (16, 'A.30 anon creates an assessment (still open until 20261006120500)', 'ok', 'anon', $q$INSERT INTO public.assessments (assessment_name, total_questions, passing_score) VALUES ('ZZ live anon', 1, 1)$q$),
    (17, 'A.32 anon deletes assessments (0 rows)', '0', 'anon', $q$WITH d AS (DELETE FROM public.assessments RETURNING 1) SELECT count(*)::text FROM d$q$)
  ) AS t(n, label, expect, who, sql) ORDER BY n LOOP
    q := replace(replace(replace(r.sql, '{A1}', a1::text), '{A2}', a2::text), '{OTHER}', other::text);
    v := NULL;
    BEGIN
      IF r.who = 'anon' THEN
        PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
        PERFORM set_config('role', 'anon', true);
      ELSIF r.who = 'nouid' THEN
        PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
        PERFORM set_config('role', 'authenticated', true);
      ELSIF r.who <> 'postgres' THEN
        PERFORM set_config('request.jwt.claims', json_build_object('sub', CASE r.who WHEN 'adm' THEN adm ELSE other END, 'role', 'authenticated')::text, true);
        PERFORM set_config('role', 'authenticated', true);
      END IF;
      IF r.expect IN ('ok', 'error') THEN EXECUTE q; v := 'done'; ELSE EXECUTE q INTO v; END IF;
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
  DELETE FROM public.assessments WHERE assessment_name LIKE 'ZZ live%';
  SELECT md5(string_agg(a::text, ',' ORDER BY id)) INTO real_after FROM public.assessments a;
  out := out || E'\n' || CASE WHEN real_before IS NOT DISTINCT FROM real_after THEN 'PASS' ELSE 'FAIL' END || ' A.40 real assessment rows unchanged inside the test';
  IF real_before IS NOT DISTINCT FROM real_after THEN npass := npass + 1; ELSE nfail := nfail + 1; END IF;
  RAISE EXCEPTION 'EADB_ASSESSMENTS_LIVE_CHECKS (rolled back) passed=% failed=% %', npass, nfail, out;
END
$t$;
