-- Rolled-back test (always RAISEs → nothing persists): #68 + 20261010180000 + 20261013120000 inlined.
-- Run with execute_sql on EADB vaagvairvwmgyzsmymhs. Result table is in the ROLLED_BACK error message.
DO $t$
DECLARE
  adm uuid := 'f3aec261-501c-4857-99c2-273bf14cda23';
  i1 uuid := 'eb364e98-326f-44f0-9f05-9100b0e05d5e';
  i2 uuid := '22ce9c38-94bd-4e91-a367-1ee9c79c6459';
  sa uuid := 'ad3db11a-50b0-4a24-847c-a168c834a69f';
  sb uuid := '005f7ab5-a952-463c-8d0c-eeb5e0214e22';
  cx uuid; cy uuid; aid uuid; good jsonb; bad jsonb; ph text; i int;
BEGIN
  CREATE TEMP TABLE _r(seq serial, ph text, tst text, res text) ON COMMIT DROP;
  GRANT ALL ON _r TO anon, authenticated; GRANT ALL ON SEQUENCE _r_seq_seq TO anon, authenticated;
  CREATE FUNCTION pg_temp.act(p_role text, p_uid uuid) RETURNS void LANGUAGE plpgsql AS $f$
  BEGIN
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims', CASE WHEN p_uid IS NULL THEN '{"role":"anon"}' ELSE json_build_object('sub', p_uid, 'role', p_role)::text END, true);
    EXECUTE format('SET LOCAL ROLE %I', p_role);
  END $f$;
  GRANT EXECUTE ON FUNCTION pg_temp.act(text,uuid) TO anon, authenticated;
  CREATE FUNCTION pg_temp.q(sql text) RETURNS text LANGUAGE plpgsql AS $f$
  DECLARE v text; BEGIN EXECUTE sql INTO v; RETURN coalesce(v,'null'); EXCEPTION WHEN others THEN RETURN 'ERR '||SQLSTATE; END $f$;
  GRANT EXECUTE ON FUNCTION pg_temp.q(text) TO anon, authenticated;

  -- fixtures
  INSERT INTO public.scheduled_classes(instructor_id,class_name,class_type,scheduled_date,start_time,end_time) VALUES (i1,'Q-X','training','2026-12-01','09:00','10:00') RETURNING id INTO cx;
  INSERT INTO public.scheduled_classes(instructor_id,class_name,class_type,scheduled_date,start_time,end_time) VALUES (i2,'Q-Y','training','2026-12-01','09:00','10:00') RETURNING id INTO cy;
  INSERT INTO public.class_enrollments(class_id,student_id) VALUES (cx,sa),(cy,sb);
  INSERT INTO public.certificates(student_id,issued_by,certificate_type,certificate_name,issue_date,status,verification_code,certificate_number)
    VALUES (sa,i1,'course','Quiz Test Cert',current_date,'active','VERIFYTEST456','CERT-QTEST-1');
  SELECT q.assessment_id INTO aid FROM public.assessment_questions q GROUP BY 1 ORDER BY count(*) LIMIT 1;
  SELECT jsonb_object_agg(id::text, correct_answer), jsonb_object_agg(id::text, CASE upper(correct_answer) WHEN 'A' THEN 'B' ELSE 'A' END)
    INTO good, bad FROM public.assessment_questions WHERE assessment_id = aid;

  FOR i IN 1..2 LOOP
    ph := CASE i WHEN 1 THEN 'BEFORE' ELSE 'AFTER' END;
    IF i = 2 THEN
      EXECUTE 'RESET ROLE';
      EXECUTE $m1$
-- =============================================================================
-- 20261006120500_eadb_remove_anon_writes.sql
-- Target: LEGACY EADB (project vaagvairvwmgyzsmymhs) ONLY. Not OverwatchDB.
-- Kept in migrations/eadb/ so `supabase db push` for overwatch-src never
-- picks it up. Status: DRAFT. Not applied.
-- Rollback: migrations/rollback/20261006120500_eadb_remove_anon_writes.rollback.sql
--
-- Removes every anon INSERT/UPDATE/DELETE policy on the 10 legacy tables
-- (+ student_profiles and activity_log) and fixes is_admin(uuid).
-- With the publishable (anon) key shipped in the static portals and the
-- Overwatch bundle, these let anyone on the internet create/alter courses,
-- modules, slides, classes, enrollments, attendance, assessments,
-- certificates, instructors and students.
--
-- !! BREAKING until the Overwatch legacy bridge uses the server path:
-- src/lib/legacy/* and src/lib/account-linker.ts used to write to EADB with
-- the anon key. PR "fix/eadb-instructor-hq-server-link" moves every one of
-- those writes to the `legacy-bridge-write` edge function (deployed on EADB,
-- service role, verifies the Overwatch session + company role). Apply this
-- migration ONLY after:
--   1. legacy-bridge-write is deployed to EADB with its secrets, and
--   2. the Overwatch frontend from that PR is live and Instructor HQ writes
--      were checked to go through the function (Network tab: POST
--      /functions/v1/legacy-bridge-write -> 200), and
--   3. ideally NEXT_PUBLIC_LEGACY_BRIDGE_MODE=server is set so nothing falls
--      back to anon writes.
-- Updated 2026-10-06: also closes anon inserts on student_profiles (two
-- policies) and revokes anon writes on it; adds student_profiles_self_insert.
--
-- Re-checked against the live EADB 2026-10-10 (all 26 dropped policies still
-- exist as listed). Also now:
--   * activity_log: drops anon_insert_activity_log (anon INSERT WITH CHECK
--     true; every writer signs in - student portal - and keeps
--     authenticated_insert_activity_log) and revokes anon writes on it.
--   * is_admin(uuid): live body reads administrators.auth_user_id / is_active,
--     which don't exist (columns are id, user_id, ...), so every policy that
--     calls is_admin(auth.uid()) errors 42703 (administrators "Admins can
--     create new admins", state_laws insert/update/delete, skills insert).
--     Rewritten to the same test as is_admin(): a row with user_id = p_user_id.
--     SECURITY INVOKER on purpose: administrators RLS shows a user only their
--     own row, so is_admin(<someone else>) can't be used to probe who is admin.
--
-- Not changed here (follow-ups): anon SELECT USING (true) policies on these
-- tables (students/instructors expose names and emails to the anon key).
-- =============================================================================


DO $guard$
BEGIN
  IF to_regclass('public.module_slides') IS NULL
     OR to_regclass('public.administrators') IS NULL
     OR to_regclass('public.company_memberships') IS NOT NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for the legacy EADB (vaagvairvwmgyzsmymhs)';
  END IF;
END
$guard$;

-- assessments
DROP POLICY IF EXISTS anon_insert_assessments ON public.assessments;
DROP POLICY IF EXISTS anon_update_assessments ON public.assessments;
-- certificates
DROP POLICY IF EXISTS anon_insert_certificates ON public.certificates;
-- class_attendance
DROP POLICY IF EXISTS anon_insert_class_attendance ON public.class_attendance;
DROP POLICY IF EXISTS anon_update_class_attendance ON public.class_attendance;
-- class_enrollments
DROP POLICY IF EXISTS anon_insert_class_enrollments ON public.class_enrollments;
DROP POLICY IF EXISTS anon_delete_class_enrollments ON public.class_enrollments;
-- courses
DROP POLICY IF EXISTS anon_insert_courses ON public.courses;
DROP POLICY IF EXISTS anon_update_courses ON public.courses;
-- instructors
DROP POLICY IF EXISTS anon_insert_instructors ON public.instructors;
DROP POLICY IF EXISTS anon_update_instructors ON public.instructors;
-- module_slides
DROP POLICY IF EXISTS anon_insert_module_slides ON public.module_slides;
DROP POLICY IF EXISTS anon_update_module_slides ON public.module_slides;
DROP POLICY IF EXISTS anon_delete_module_slides ON public.module_slides;
-- scheduled_classes
DROP POLICY IF EXISTS anon_insert_scheduled_classes ON public.scheduled_classes;
DROP POLICY IF EXISTS anon_update_scheduled_classes ON public.scheduled_classes;
-- training_modules
DROP POLICY IF EXISTS anon_insert_training_modules ON public.training_modules;
DROP POLICY IF EXISTS anon_update_training_modules ON public.training_modules;
-- students
DROP POLICY IF EXISTS students_anon_insert ON public.students;
DROP POLICY IF EXISTS students_anon_update ON public.students;
DROP POLICY IF EXISTS "Enable insert for anon and authenticated" ON public.students;

-- Student portal signup (student-portal/js/supabase-config.js) inserts its own
-- students row right after auth.signUp(). Keep that working for a signed-in
-- user, but only for their own id and sign-in email.
CREATE POLICY students_self_insert ON public.students
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND lower(email) = lower(auth.jwt() ->> 'email'));

-- student_profiles: the student portal inserts its own profile row right
-- after signUp (and handle_new_student already creates it server-side).
-- "Enable insert for anon and authenticated" also let any signed-in user
-- create a profile for any student_id.
DROP POLICY IF EXISTS student_profiles_anon_insert ON public.student_profiles;
DROP POLICY IF EXISTS "Enable insert for anon and authenticated" ON public.student_profiles;
CREATE POLICY student_profiles_self_insert ON public.student_profiles
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- activity_log: signed-in writers only (authenticated_insert_activity_log stays).
DROP POLICY IF EXISTS anon_insert_activity_log ON public.activity_log;

-- is_admin(uuid): fix the broken column references (see header).
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $function$
  SELECT p_user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.administrators a WHERE a.user_id = p_user_id)
$function$;

-- Defence in depth: anon keeps SELECT (out of scope) but loses write grants.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.assessments, public.certificates, public.class_attendance,
  public.class_enrollments, public.courses, public.instructors,
  public.module_slides, public.scheduled_classes, public.students,
  public.training_modules, public.student_profiles, public.activity_log
FROM anon;

-- OPTIONAL (not enabled): if EADB requires email confirmation, signUp()
-- returns no session and the portal's students insert above runs as anon and
-- now fails. Creating the row in the existing auth trigger fixes that:
--
-- CREATE OR REPLACE FUNCTION public.handle_new_student()
--  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
-- AS $function$
-- BEGIN
--   INSERT INTO student_profiles (student_id) VALUES (NEW.id);
--   INSERT INTO students (id, email, first_name, last_name)
--   VALUES (NEW.id, NEW.email,
--           COALESCE(NULLIF(NEW.raw_user_meta_data->>'first_name', ''), 'Student'),
--           COALESCE(NEW.raw_user_meta_data->>'last_name', ''))
--   ON CONFLICT DO NOTHING;
--   RETURN NEW;
-- END;
-- $function$;
      $m1$;
      EXECUTE $m2$
-- =============================================================================
-- 20261010180000_eadb_pii_read_lockdown.sql
-- Target: LEGACY EADB (project vaagvairvwmgyzsmymhs) ONLY. Not OverwatchDB.
-- Status: DRAFT. Not applied.
-- Rollback: migrations/rollback/20261010180000_eadb_pii_read_lockdown.rollback.sql
--
-- ORDER: apply AFTER 20261006120500_eadb_remove_anon_writes.sql (it fixes
-- is_admin(uuid), which these policies use; the guard below refuses to run on
-- the broken version) AND after Overwatch runs with
-- NEXT_PUBLIC_LEGACY_BRIDGE_MODE=server plus the bridge read ops of this PR
-- (Overwatch reads EADB with the anon key; after this migration anon reads of
-- per-person tables return nothing).
--
-- Problem: anon (publishable key, shipped in every page) and any signed-in
-- user can read every row of students (email, phone, date_of_birth),
-- student_profiles (address, phone), instructors, course enrolments, module
-- progress, assessment results, certificates, attendance, activity_log,
-- clients, certifications, work_experience, student_skills.
--
-- Rule after this migration (SELECT only; writes unchanged):
--   * anon: catalog only (courses, course_modules, training_modules,
--     module_slides, assessments, state_laws, crime data, skills, active
--     job_postings). Nothing per-person. Certificate check via
--     public.verify_certificate(code) (non-sensitive fields).
--   * a user: own rows (existing "own" policies, plus certifications own).
--   * EADB admins (is_admin(auth.uid())): everything below.
--   * active instructors (static instructor portal = staff directory: lists
--     all students to enrol them, checks prerequisites): students, module
--     progress, assessment results. Classes, rosters (class_enrollments) and
--     attendance: their OWN classes only. Address/phone/bio in student_profiles only
--     for students enrolled in one of THEIR classes.
--   * messaging partners (shared message_threads row): each other's
--     students / clients name + email (student-portal/js/messages.js).
--   * clients (employers): student_profiles, certifications, work_experience,
--     student_skills of students who set profile_visible = true.
--   * Overwatch: through legacy-bridge-write (service role) read ops.
-- =============================================================================


DO $guard$
BEGIN
  IF to_regclass('public.module_slides') IS NULL
     OR to_regclass('public.administrators') IS NULL
     OR to_regclass('public.company_memberships') IS NOT NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for the legacy EADB (vaagvairvwmgyzsmymhs)';
  END IF;
  IF (SELECT prosrc FROM pg_proc WHERE oid = 'public.is_admin(uuid)'::regprocedure) ILIKE '%auth_user_id%' THEN
    RAISE EXCEPTION 'Apply 20261006120500_eadb_remove_anon_writes.sql first (is_admin(uuid) is still broken)';
  END IF;
END
$guard$;

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so policies don't recurse through other tables'
-- RLS; each only answers a question about the CALLER (auth.uid()).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eadb_is_active_instructor()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = auth.uid() AND i.is_active) $$;

CREATE OR REPLACE FUNCTION public.eadb_is_client()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.eadb_instructor_has_student(p_student_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_enrollments e
    JOIN public.scheduled_classes c ON c.id = e.class_id
    WHERE e.student_id = p_student_id AND c.instructor_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.eadb_instructor_owns_class(p_class_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.scheduled_classes c WHERE c.id = p_class_id AND c.instructor_id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.eadb_shares_thread(p_other uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE (t.participant_1 = auth.uid() AND t.participant_2 = p_other)
       OR (t.participant_2 = auth.uid() AND t.participant_1 = p_other))
$$;

CREATE OR REPLACE FUNCTION public.eadb_profile_visible(p_student_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.student_profiles p WHERE p.student_id = p_student_id AND p.profile_visible) $$;

REVOKE ALL ON FUNCTION public.eadb_is_active_instructor(), public.eadb_is_client(),
  public.eadb_instructor_has_student(uuid), public.eadb_instructor_owns_class(uuid), public.eadb_shares_thread(uuid),
  public.eadb_profile_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eadb_is_active_instructor(), public.eadb_is_client(),
  public.eadb_instructor_has_student(uuid), public.eadb_instructor_owns_class(uuid), public.eadb_shares_thread(uuid),
  public.eadb_profile_visible(uuid) TO authenticated, service_role;

-- Public certificate verification: by verification code or certificate
-- number: certificate details + the holder's full name (decision 2026-10-10);
-- no email, no student id, no notes/pdf.
CREATE OR REPLACE FUNCTION public.verify_certificate(p_code text)
  RETURNS TABLE (certificate_number text, certificate_name text, certificate_type text,
                 holder_name text, state_issued text, issue_date date, expiration_date date, status text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT c.certificate_number::text, c.certificate_name::text, c.certificate_type::text,
         trim(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, '')),
         c.state_issued::text, c.issue_date::date, c.expiration_date::date,
         CASE WHEN c.status = 'active' AND c.expiration_date IS NOT NULL AND c.expiration_date::date < current_date
              THEN 'expired' ELSE c.status::text END
  FROM public.certificates c
  LEFT JOIN public.students s ON s.id = c.student_id
  WHERE p_code IS NOT NULL AND length(p_code) BETWEEN 6 AND 64
    AND (c.verification_code = p_code OR c.certificate_number = p_code)
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS anon_select_students ON public.students;
DROP POLICY IF EXISTS "Allow authenticated to view students" ON public.students;
DROP POLICY IF EXISTS "Allow authenticated users to view students" ON public.students;
CREATE POLICY students_staff_select ON public.students FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.eadb_is_active_instructor());
CREATE POLICY students_thread_partner_select ON public.students FOR SELECT TO authenticated
  USING (public.eadb_shares_thread(id));
-- kept: "Users can view own data" (auth.uid() = id)

-- student_profiles (address, phone, bio, resume)
DROP POLICY IF EXISTS "Allow authenticated to view profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to view profiles" ON public.student_profiles;
CREATE POLICY student_profiles_scoped_select ON public.student_profiles FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid())
         OR public.eadb_instructor_has_student(student_id)
         OR (profile_visible AND public.eadb_is_client()));
-- kept: "Users can view own profile"

-- instructors (email, phone)
DROP POLICY IF EXISTS anon_select_instructors ON public.instructors;
DROP POLICY IF EXISTS "View active instructors" ON public.instructors;
CREATE POLICY instructors_admin_select ON public.instructors FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
-- kept: "Instructors can view own profile"

-- learning records
DROP POLICY IF EXISTS anon_select_student_course_enrollments ON public.student_course_enrollments;
CREATE POLICY student_course_enrollments_admin_select ON public.student_course_enrollments FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS anon_select_student_module_progress ON public.student_module_progress;
CREATE POLICY student_module_progress_staff_select ON public.student_module_progress FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.eadb_is_active_instructor());

DROP POLICY IF EXISTS anon_select_assessment_results ON public.assessment_results;
CREATE POLICY assessment_results_staff_select ON public.assessment_results FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.eadb_is_active_instructor());

DROP POLICY IF EXISTS anon_select_certificates ON public.certificates;
CREATE POLICY certificates_admin_select ON public.certificates FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
-- kept: "Students can view own certificates", "Instructors can view all certificates"

-- classes
DROP POLICY IF EXISTS anon_select_class_attendance ON public.class_attendance;
DROP POLICY IF EXISTS anon_select_class_enrollments ON public.class_enrollments;
DROP POLICY IF EXISTS anon_select_scheduled_classes ON public.scheduled_classes;
-- Rosters: an instructor sees enrolments of THEIR OWN classes only (decision
-- 2026-10-10). Replaces "Instructors can view all enrollments" (any active
-- instructor saw every roster). Attendance ("Instructors can manage
-- attendance") and classes ("Instructors can view their classes") are already
-- scoped to the instructor's own classes. Write policies unchanged.
DROP POLICY IF EXISTS "Instructors can view all enrollments" ON public.class_enrollments;
CREATE POLICY class_enrollments_own_class_select ON public.class_enrollments FOR SELECT TO authenticated
  USING (public.eadb_instructor_owns_class(class_id));
CREATE POLICY class_attendance_admin_select ON public.class_attendance FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY class_enrollments_admin_select ON public.class_enrollments FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY scheduled_classes_admin_select ON public.scheduled_classes FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- activity_log
DROP POLICY IF EXISTS anon_select_activity_log ON public.activity_log;
DROP POLICY IF EXISTS authenticated_select_activity_log ON public.activity_log;
CREATE POLICY activity_log_scoped_select ON public.activity_log FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_admin(auth.uid()));

-- clients (employer contact details)
DROP POLICY IF EXISTS "Allow authenticated to view clients" ON public.clients;
DROP POLICY IF EXISTS "Allow authenticated users to view clients" ON public.clients;
CREATE POLICY clients_scoped_select ON public.clients FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.eadb_shares_thread(id));
-- kept: "Enable read access for own profile"

-- talent profile pieces: own, admin, clients for visible profiles
DROP POLICY IF EXISTS "Allow authenticated to view certifications" ON public.certifications;
DROP POLICY IF EXISTS "Clients can view certifications of visible profiles" ON public.certifications;
CREATE POLICY certifications_scoped_select ON public.certifications FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_admin(auth.uid())
         OR (public.eadb_is_client() AND public.eadb_profile_visible(student_id)));

DROP POLICY IF EXISTS "Allow authenticated users to view work experience" ON public.work_experience;
CREATE POLICY work_experience_scoped_select ON public.work_experience FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.eadb_is_client() AND public.eadb_profile_visible(student_id)));
-- kept: "Users can view own experience"

DROP POLICY IF EXISTS anon_select_student_skills ON public.student_skills;
DROP POLICY IF EXISTS authenticated_select_student_skills ON public.student_skills;
CREATE POLICY student_skills_scoped_select ON public.student_skills FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_admin(auth.uid())
         OR (public.eadb_is_client() AND public.eadb_profile_visible(student_id)));

CREATE POLICY scenario_results_admin_select ON public.scenario_results FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
      $m2$;
      EXECUTE $m3$
-- =============================================================================
-- 20261013120000_eadb_quiz_answers_lockdown.sql
-- Target: LEGACY EADB (project vaagvairvwmgyzsmymhs) ONLY. Status: DRAFT, not applied.
-- Rollback: migrations/rollback/20261013120000_eadb_quiz_answers_lockdown.rollback.sql
-- ORDER: after 20261006120500 (is_admin fix) and 20261010180000.
--
-- Problem: every signed-in student can read assessment_questions.correct_answer
-- (+ explanation), anyone with the anon key can read assessments.questions_json
-- (answers for 8 of 15 assessments), and the student portal grades in the
-- browser and inserts its own score into assessment_results.
--
-- After:
--   * assessment_questions: SELECT for EADB admins only. Students get
--     answer-free questions from get_assessment_quiz(id).
--   * assessments.questions_json: column SELECT revoked from anon and
--     authenticated (every other column stays readable); admins read it via
--     admin_get_assessment_questions_json(id). Overwatch reads questions
--     through legacy-bridge-write (service role).
--   * grading: grade_assessment(id, answers, state_code) grades on the server,
--     records the result for the caller, and returns per-question correctness
--     plus the correct answer/explanation AFTER submission (the portal's
--     existing review screen).
--   * assessment_results: students lose direct INSERT (no self-reported
--     scores). Reads unchanged.
-- =============================================================================


DO $guard$
BEGIN
  IF to_regclass('public.module_slides') IS NULL OR to_regclass('public.company_memberships') IS NOT NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for the legacy EADB (vaagvairvwmgyzsmymhs)';
  END IF;
  IF (SELECT prosrc FROM pg_proc WHERE oid = 'public.is_admin(uuid)'::regprocedure) ILIKE '%auth_user_id%' THEN
    RAISE EXCEPTION 'Apply 20261006120500_eadb_remove_anon_writes.sql first (is_admin(uuid) is still broken)';
  END IF;
END
$guard$;

-- 1. Questions without answers (signed-in users).
CREATE OR REPLACE FUNCTION public.get_assessment_quiz(p_assessment_id uuid)
  RETURNS TABLE (id uuid, question_number integer, question_text text,
                 option_a text, option_b text, option_c text, option_d text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT q.id, q.question_number, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d
  FROM public.assessment_questions q
  WHERE q.assessment_id = p_assessment_id AND auth.uid() IS NOT NULL
  ORDER BY q.question_number
$$;

-- 2. Server-side grading. p_answers: {"<question id>": "A"|"B"|"C"|"D", ...}.
CREATE OR REPLACE FUNCTION public.grade_assessment(p_assessment_id uuid, p_answers jsonb, p_state_code text DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pass numeric;
  v_total int;
  v_correct int;
  v_score numeric;
  v_detail jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = v_uid) THEN
    RAISE EXCEPTION 'not a student' USING ERRCODE = '42501';
  END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'answers must be an object' USING ERRCODE = '22023';
  END IF;
  IF p_state_code IS NOT NULL AND length(p_state_code) > 10 THEN
    RAISE EXCEPTION 'bad state code' USING ERRCODE = '22023';
  END IF;
  SELECT a.passing_score INTO v_pass FROM public.assessments a WHERE a.id = p_assessment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'assessment not found' USING ERRCODE = 'P0002'; END IF;

  SELECT count(*),
         count(*) FILTER (WHERE upper(p_answers ->> q.id::text) = upper(q.correct_answer)),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'is_correct', upper(p_answers ->> q.id::text) = upper(q.correct_answer),
           'correct_answer', upper(q.correct_answer), 'explanation', q.explanation) ORDER BY q.question_number), '[]'::jsonb)
    INTO v_total, v_correct, v_detail
  FROM public.assessment_questions q WHERE q.assessment_id = p_assessment_id;
  IF v_total = 0 THEN RAISE EXCEPTION 'assessment has no questions' USING ERRCODE = 'P0002'; END IF;

  v_score := round(100.0 * v_correct / v_total);
  INSERT INTO public.assessment_results (student_id, assessment_id, score, passed, completed_at, answers_json, state_code)
  VALUES (v_uid, p_assessment_id, v_score, v_score >= coalesce(v_pass, 70), now(),
          jsonb_build_object('answers', p_answers, 'graded_by', 'server'), p_state_code);

  RETURN jsonb_build_object('correct', v_correct, 'total', v_total, 'score', v_score,
                            'passed', v_score >= coalesce(v_pass, 70), 'questions', v_detail);
END
$$;

-- 3. Admin-only read of the editor's questions_json.
CREATE OR REPLACE FUNCTION public.admin_get_assessment_questions_json(p_assessment_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admins only' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT a.questions_json FROM public.assessments a WHERE a.id = p_assessment_id);
END
$$;

REVOKE ALL ON FUNCTION public.get_assessment_quiz(uuid), public.grade_assessment(uuid, jsonb, text),
  public.admin_get_assessment_questions_json(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assessment_quiz(uuid), public.grade_assessment(uuid, jsonb, text),
  public.admin_get_assessment_questions_json(uuid) TO authenticated, service_role;

-- 4. assessment_questions: admins only.
DROP POLICY IF EXISTS "Authenticated users can view questions" ON public.assessment_questions;
CREATE POLICY assessment_questions_admin_select ON public.assessment_questions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
REVOKE SELECT ON public.assessment_questions FROM anon;

-- 5. assessments.questions_json: hidden from anon + authenticated (column privilege).
REVOKE SELECT ON public.assessments FROM anon, authenticated;
GRANT SELECT (id, module_id, assessment_name, total_questions, passing_score, time_limit_minutes,
              category, icon, updated_at) ON public.assessments TO anon, authenticated;

-- 6. No self-reported scores.
DROP POLICY IF EXISTS "Users can insert own results" ON public.assessment_results;
      $m3$;
    END IF;
    PERFORM pg_temp.act('authenticated', i1);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'I1 roster: own class X / other class Y', pg_temp.q(format('SELECT (SELECT count(*) FROM public.class_enrollments WHERE class_id=%L)||'' / ''||(SELECT count(*) FROM public.class_enrollments WHERE class_id=%L)', cx, cy)));
    PERFORM pg_temp.act('authenticated', i2);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'I2 roster: other class X / own class Y', pg_temp.q(format('SELECT (SELECT count(*) FROM public.class_enrollments WHERE class_id=%L)||'' / ''||(SELECT count(*) FROM public.class_enrollments WHERE class_id=%L)', cx, cy)));
    PERFORM pg_temp.act('authenticated', i1);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'I1 classes visible: own / other', pg_temp.q(format('SELECT (SELECT count(*) FROM public.scheduled_classes WHERE id=%L)||'' / ''||(SELECT count(*) FROM public.scheduled_classes WHERE id=%L)', cx, cy)));
    PERFORM pg_temp.act('authenticated', adm);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'admin roster X / Y', pg_temp.q(format('SELECT (SELECT count(*) FROM public.class_enrollments WHERE class_id=%L)||'' / ''||(SELECT count(*) FROM public.class_enrollments WHERE class_id=%L)', cx, cy)));
    PERFORM pg_temp.act('authenticated', sa);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'student A: own class enrolment', pg_temp.q(format('SELECT count(*)::text FROM public.class_enrollments WHERE student_id=%L', sa)));
    PERFORM pg_temp.act('anon', NULL);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'anon verify_certificate(VERIFYTEST456) holder', pg_temp.q('SELECT holder_name FROM public.verify_certificate(''VERIFYTEST456'')'));
    -- quiz
    PERFORM pg_temp.act('authenticated', sa);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'student reads assessment_questions.correct_answer (rows)', pg_temp.q('SELECT count(correct_answer)::text FROM public.assessment_questions'));
    PERFORM pg_temp.act('anon', NULL);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'anon reads assessments.questions_json', pg_temp.q('SELECT count(questions_json)::text FROM public.assessments'));
    PERFORM pg_temp.act('authenticated', sa);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'student reads assessments.questions_json', pg_temp.q('SELECT count(questions_json)::text FROM public.assessments'));
    PERFORM pg_temp.act('anon', NULL);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'anon catalog: assessments (no json cols)', pg_temp.q('SELECT count(*)::text FROM (SELECT id, assessment_name, passing_score FROM public.assessments) x'));
    PERFORM pg_temp.act('authenticated', sa);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'student get_assessment_quiz: rows / has answer key?', pg_temp.q(format('SELECT count(*)||'' / ''||bool_or((to_jsonb(x) ? ''correct_answer'') OR (to_jsonb(x) ? ''explanation''))::text FROM public.get_assessment_quiz(%L) x', aid)));
    PERFORM pg_temp.act('anon', NULL);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'anon get_assessment_quiz', pg_temp.q(format('SELECT count(*)::text FROM public.get_assessment_quiz(%L)', aid)));
    PERFORM pg_temp.act('authenticated', sa);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'student grade_assessment (all right): score/passed', pg_temp.q(format('SELECT (r->>''score'')||'' / ''||(r->>''passed'') FROM public.grade_assessment(%L, %L::jsonb, NULL) r', aid, good)));
    PERFORM pg_temp.act('authenticated', sa);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'student grade_assessment (all wrong): score/passed', pg_temp.q(format('SELECT (r->>''score'')||'' / ''||(r->>''passed'') FROM public.grade_assessment(%L, %L::jsonb, NULL) r', aid, bad)));
    PERFORM pg_temp.act('authenticated', sa);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'student: server-graded result rows recorded', pg_temp.q(format('SELECT count(*)::text FROM public.assessment_results WHERE student_id=%L AND answers_json->>''graded_by''=''server''', sa)));
    PERFORM pg_temp.act('authenticated', sa);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'student self-inserts a 100% result', pg_temp.q(format('WITH x AS (INSERT INTO public.assessment_results(student_id,assessment_id,score,passed) VALUES (%L,%L,100,true) RETURNING 1) SELECT ''ALLOWED''||count(*) FROM x', sa, aid)));
    PERFORM pg_temp.act('authenticated', sa);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'student admin_get_assessment_questions_json', pg_temp.q(format('SELECT jsonb_typeof(public.admin_get_assessment_questions_json(%L))', aid)));
    PERFORM pg_temp.act('authenticated', adm);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'admin: questions (with answers) / editor json', pg_temp.q(format('SELECT (SELECT count(correct_answer) FROM public.assessment_questions WHERE assessment_id=%L)||'' / ''||coalesce(jsonb_typeof(public.admin_get_assessment_questions_json(%L)),''null'')', aid, aid)));
    PERFORM pg_temp.act('authenticated', i1);
    INSERT INTO _r(ph,tst,res) VALUES (ph,'instructor reads results (prereq check)', pg_temp.q(format('SELECT count(*)::text FROM public.assessment_results WHERE student_id=%L', sa)));
    EXECUTE 'RESET ROLE';
  END LOOP;
  RAISE EXCEPTION E'ROLLED_BACK\n%', (SELECT string_agg(format('%-6s | %-58s | %s', _r.ph, _r.tst, _r.res), E'\n' ORDER BY _r.seq) FROM _r);
END
$t$;
