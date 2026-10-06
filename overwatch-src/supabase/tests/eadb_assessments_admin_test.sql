-- LOCAL-ONLY checks for eadb/20261006210000_eadb_assessments_admin_write.sql.
-- Run after tests/eadb_local_stub.sql + the migration. Never run against a
-- Supabase project (see eadb_assessments_admin_live_check.sql for the live-safe,
-- rolled-back version).
--   psql -d eadb_test -f tests/eadb_assessments_admin_test.sql                    # anon still open (20261006120500 not applied)
--   psql -d eadb_test -v anon_closed=1 -f tests/eadb_assessments_admin_test.sql   # after 20261006120500 too
\set ON_ERROR_STOP 1
\if :{?anon_closed}
  \set anon_ins 'error'
  \set anon_upd 'error'
\else
  \set anon_ins 'ok'
  \set anon_upd 'ok'
\endif
RESET ROLE;
DROP SCHEMA IF EXISTS eadb_atest CASCADE;
CREATE SCHEMA eadb_atest;
GRANT USAGE ON SCHEMA eadb_atest TO anon, authenticated;
CREATE TABLE eadb_atest.results (n serial PRIMARY KEY, label text, ok boolean, detail text);
GRANT ALL ON eadb_atest.results TO anon, authenticated;
GRANT USAGE ON SEQUENCE eadb_atest.results_n_seq TO anon, authenticated;
-- p_expect: 'ok' (no error), 'error' (must raise), or an exact scalar result.
CREATE FUNCTION eadb_atest.t(p_label text, p_expect text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  BEGIN
    IF p_expect IN ('ok', 'error') THEN EXECUTE p_sql; v := 'succeeded'; ELSE EXECUTE p_sql INTO v; END IF;
    INSERT INTO eadb_atest.results (label, ok, detail)
    VALUES (p_label, CASE p_expect WHEN 'ok' THEN true WHEN 'error' THEN false ELSE coalesce(v, 'NULL') = p_expect END, 'got ' || coalesce(v, 'NULL'));
  EXCEPTION WHEN others THEN
    INSERT INTO eadb_atest.results (label, ok, detail) VALUES (p_label, p_expect = 'error', left(SQLERRM, 120));
  END;
END $$;
GRANT EXECUTE ON FUNCTION eadb_atest.t(text, text, text) TO anon, authenticated;

-- Fixtures (as the table owner): one admin, one instructor, two assessments.
DELETE FROM public.assessments WHERE assessment_name LIKE 'ZZ %';
DELETE FROM public.administrators WHERE user_id = 'bbbbbbbb-0000-4000-8000-00000000000a';
INSERT INTO public.administrators (user_id) VALUES ('bbbbbbbb-0000-4000-8000-00000000000a');
INSERT INTO public.instructors (id) VALUES ('bbbbbbbb-0000-4000-8000-00000000000b') ON CONFLICT DO NOTHING;
INSERT INTO public.assessments (id, assessment_name, total_questions, passing_score) VALUES
  ('cccccccc-0000-4000-8000-000000000001', 'ZZ One', 10, 80),
  ('cccccccc-0000-4000-8000-000000000002', 'ZZ Two', 10, 80);

-- EADB admin (row in administrators)
SELECT set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-00000000000a","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT eadb_atest.t('A.01 admin creates a module assessment (course-editor) [legit]', 'ok', $q$INSERT INTO assessments (assessment_name, category, icon, total_questions, passing_score, time_limit_minutes) VALUES ('ZZ New', 'Miscellaneous', 'fa-x', 10, 80, 20)$q$);
SELECT eadb_atest.t('A.02 admin saves questions (assessment-editor) [legit]', '1', $q$WITH u AS (UPDATE assessments SET questions_json = '[{"q":"x"}]', total_questions = 1, updated_at = now() WHERE id = 'cccccccc-0000-4000-8000-000000000001' RETURNING 1) SELECT count(*)::text FROM u$q$);
SELECT eadb_atest.t('A.03 admin renames (course-editor) [legit]', '1', $q$WITH u AS (UPDATE assessments SET assessment_name = 'ZZ Two renamed', category = 'Event Security Core' WHERE id = 'cccccccc-0000-4000-8000-000000000002' RETURNING 1) SELECT count(*)::text FROM u$q$);
SELECT eadb_atest.t('A.04 admin sets total_questions (AI generator) [legit]', '1', $q$WITH u AS (UPDATE assessments SET total_questions = 7 WHERE id = 'cccccccc-0000-4000-8000-000000000002' RETURNING 1) SELECT count(*)::text FROM u$q$);
SELECT eadb_atest.t('A.05 admin deletes an assessment [legit]', '1', $q$WITH d AS (DELETE FROM assessments WHERE assessment_name = 'ZZ New' RETURNING 1) SELECT count(*)::text FROM d$q$);

-- Signed-in instructor (not an admin)
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-00000000000b","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT eadb_atest.t('A.10 instructor creates an assessment', 'error', $q$INSERT INTO assessments (assessment_name, total_questions, passing_score) VALUES ('ZZ Inst', 1, 1)$q$);
SELECT eadb_atest.t('A.11 instructor updates assessments (0 rows)', '0', $q$WITH u AS (UPDATE assessments SET total_questions = 99 RETURNING 1) SELECT count(*)::text FROM u$q$);
SELECT eadb_atest.t('A.12 instructor deletes assessments (0 rows)', '0', $q$WITH d AS (DELETE FROM assessments RETURNING 1) SELECT count(*)::text FROM d$q$);
SELECT eadb_atest.t('A.13 instructor still reads assessments [unchanged]', 'ok', $q$SELECT count(*) FROM assessments$q$);

-- Signed-in student
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000000ff","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT eadb_atest.t('A.20 student creates an assessment', 'error', $q$INSERT INTO assessments (assessment_name, total_questions, passing_score) VALUES ('ZZ Stu', 1, 1)$q$);
SELECT eadb_atest.t('A.21 student updates assessments (0 rows)', '0', $q$WITH u AS (UPDATE assessments SET passing_score = 0 RETURNING 1) SELECT count(*)::text FROM u$q$);
SELECT eadb_atest.t('A.22 student deletes assessments (0 rows)', '0', $q$WITH d AS (DELETE FROM assessments RETURNING 1) SELECT count(*)::text FROM d$q$);

-- authenticated role with no user id
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', false);
SET ROLE authenticated;
SELECT eadb_atest.t('A.25 no-uid session creates an assessment', 'error', $q$INSERT INTO assessments (assessment_name, total_questions, passing_score) VALUES ('ZZ Nouid', 1, 1)$q$);

RESET ROLE;
SELECT eadb_atest.t('A.26 data check: admin edits landed, nothing else changed', 'ZZ One|1|80 ; ZZ Two renamed|7|80', $q$SELECT string_agg(assessment_name || '|' || total_questions || '|' || passing_score::int, ' ; ' ORDER BY assessment_name) FROM assessments WHERE id IN ('cccccccc-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000002')$q$);

-- anon: owned by 20261006120500 (expectation depends on whether it was applied)
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;
SELECT eadb_atest.t('A.30 anon creates an assessment (' || :'anon_ins' || ' expected)', :'anon_ins', $q$INSERT INTO assessments (assessment_name, total_questions, passing_score) VALUES ('ZZ Anon', 1, 1)$q$);
SELECT eadb_atest.t('A.31 anon updates an assessment (' || :'anon_upd' || ' expected)', :'anon_upd', $q$UPDATE assessments SET total_questions = 3 WHERE id = 'cccccccc-0000-4000-8000-000000000001'$q$);
SELECT eadb_atest.t('A.32 anon deletes assessments (0 rows while open, denied once closed)', CASE WHEN :'anon_ins' = 'ok' THEN '0' ELSE 'error' END, $q$WITH d AS (DELETE FROM assessments RETURNING 1) SELECT count(*)::text FROM d$q$);

\pset pager off
SELECT n, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, label, detail FROM eadb_atest.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS passed, count(*) FILTER (WHERE NOT ok) AS failed FROM eadb_atest.results;
