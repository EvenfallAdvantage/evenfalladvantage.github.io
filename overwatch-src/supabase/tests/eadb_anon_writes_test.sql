-- LOCAL-ONLY checks for eadb/20261006120500_eadb_remove_anon_writes.sql.
-- Run after tests/eadb_local_stub.sql (+ the migration to test it). Never run
-- against a Supabase project.
\set ON_ERROR_STOP 1
RESET ROLE;
DROP SCHEMA IF EXISTS eadb_test CASCADE;
CREATE SCHEMA eadb_test;
GRANT USAGE ON SCHEMA eadb_test TO anon, authenticated;
CREATE TABLE eadb_test.results (n serial PRIMARY KEY, label text, ok boolean, detail text);
GRANT ALL ON eadb_test.results TO anon, authenticated;
GRANT USAGE ON SEQUENCE eadb_test.results_n_seq TO anon, authenticated;
CREATE FUNCTION eadb_test.t(p_label text, p_expect text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    INSERT INTO eadb_test.results (label, ok, detail) VALUES (p_label, p_expect = 'ok', 'succeeded');
  EXCEPTION WHEN others THEN
    INSERT INTO eadb_test.results (label, ok, detail) VALUES (p_label, p_expect = 'error', left(SQLERRM, 120));
  END;
END $$;
GRANT EXECUTE ON FUNCTION eadb_test.t(text, text, text) TO anon, authenticated;

-- anon (the publishable key shipped in the static portals / Overwatch bundle)
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;
SELECT eadb_test.t('E.01 anon inserts a course', 'error', $q$INSERT INTO courses (title) VALUES ('x')$q$);
SELECT eadb_test.t('E.02 anon updates courses', 'error', $q$UPDATE courses SET title = 'x'$q$);
SELECT eadb_test.t('E.03 anon inserts a slide', 'error', $q$INSERT INTO module_slides (title) VALUES ('x')$q$);
SELECT eadb_test.t('E.04 anon deletes slides', 'error', $q$DELETE FROM module_slides$q$);
SELECT eadb_test.t('E.05 anon issues a certificate', 'error', $q$INSERT INTO certificates (issued_by) VALUES (gen_random_uuid())$q$);
SELECT eadb_test.t('E.06 anon creates an instructor', 'error', $q$INSERT INTO instructors (id) VALUES (gen_random_uuid())$q$);
SELECT eadb_test.t('E.07 anon creates a student', 'error', $q$INSERT INTO students (id, email, first_name, last_name) VALUES (gen_random_uuid(), 'a@x.co', 'a', 'b')$q$);
SELECT eadb_test.t('E.08 anon creates a student profile', 'error', $q$INSERT INTO student_profiles (student_id) VALUES (gen_random_uuid())$q$);
SELECT eadb_test.t('E.09 anon marks attendance', 'error', $q$INSERT INTO class_attendance (class_id) VALUES (gen_random_uuid())$q$);
SELECT eadb_test.t('E.10 anon still reads courses [unchanged]', 'ok', $q$SELECT count(*) FROM courses$q$);

-- signed-in EADB student (student portal signup)
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","email":"stu@x.co","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT eadb_test.t('E.20 student inserts own students row [legit]', 'ok', $q$INSERT INTO students (id, email, first_name, last_name) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'stu@x.co', 'S', 'T')$q$);
SELECT eadb_test.t('E.21 student inserts a students row for someone else', 'error', $q$INSERT INTO students (id, email, first_name, last_name) VALUES (gen_random_uuid(), 'other@x.co', 'O', 'T')$q$);
SELECT eadb_test.t('E.22 student inserts own profile [legit]', 'ok', $q$INSERT INTO student_profiles (student_id) VALUES ('aaaaaaaa-0000-4000-8000-000000000001')$q$);
SELECT eadb_test.t('E.23 student inserts a profile for someone else', 'error', $q$INSERT INTO student_profiles (student_id) VALUES (gen_random_uuid())$q$);
SELECT eadb_test.t('E.24 student inserts a course', 'error', $q$INSERT INTO courses (title) VALUES ('x')$q$);

RESET ROLE;
\pset pager off
SELECT n, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, label, detail FROM eadb_test.results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS passed, count(*) FILTER (WHERE NOT ok) AS failed FROM eadb_test.results;
