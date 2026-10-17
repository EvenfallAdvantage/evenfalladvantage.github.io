DO $t$
DECLARE adm uuid:='f3aec261-501c-4857-99c2-273bf14cda23'; i1 uuid:='eb364e98-326f-44f0-9f05-9100b0e05d5e'; i2 uuid:='22ce9c38-94bd-4e91-a367-1ee9c79c6459';
  sa uuid:='ad3db11a-50b0-4a24-847c-a168c834a69f'; sb uuid:='005f7ab5-a952-463c-8d0c-eeb5e0214e22';
  cx uuid; cy uuid; out text:=''; ph text; i int; r record;
BEGIN
  CREATE FUNCTION pg_temp.act(p_role text, p_uid uuid) RETURNS void LANGUAGE plpgsql AS $f$
  BEGIN EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims', CASE WHEN p_uid IS NULL THEN '{"role":"anon"}' ELSE json_build_object('sub',p_uid,'role',p_role)::text END, true);
    EXECUTE format('SET LOCAL ROLE %I', p_role); END $f$;
  CREATE FUNCTION pg_temp.q(sql text) RETURNS text LANGUAGE plpgsql AS $f$
  DECLARE v text; BEGIN EXECUTE sql INTO v; RETURN coalesce(v,'null'); EXCEPTION WHEN others THEN RETURN 'ERR '||SQLSTATE; END $f$;
  GRANT EXECUTE ON FUNCTION pg_temp.act(text,uuid), pg_temp.q(text) TO anon, authenticated;
  INSERT INTO public.scheduled_classes(instructor_id,class_name,class_type,scheduled_date,start_time,end_time) VALUES (i1,'T-X','training','2026-12-01','09:00','10:00') RETURNING id INTO cx;
  INSERT INTO public.scheduled_classes(instructor_id,class_name,class_type,scheduled_date,start_time,end_time) VALUES (i2,'T-Y','training','2026-12-01','09:00','10:00') RETURNING id INTO cy;
  INSERT INTO public.class_enrollments(class_id,student_id) VALUES (cx,sa),(cy,sb);
  INSERT INTO public.class_attendance(class_id,student_id,attendance_status) VALUES (cx,sa,'present'),(cy,sb,'present');
  INSERT INTO public.certificates(student_id,issued_by,certificate_type,certificate_name,issue_date,status,verification_code,certificate_number)
    VALUES (sa,i1,'course','T Cert',current_date,'active','VERIFYT71A','CERT-T71-1'),(sb,i2,'course','T Cert',current_date,'active','VERIFYT71B','CERT-T71-2');
  CREATE TEMP TABLE _c(seq serial, role text, uid uuid, tst text, sql text) ON COMMIT DROP;
  INSERT INTO _c(role,uid,tst,sql) VALUES
   ('authenticated',i1,'I1 own class / other class (scheduled_classes)',format('SELECT (SELECT count(*) FROM public.scheduled_classes WHERE id=%L)||'' / ''||(SELECT count(*) FROM public.scheduled_classes WHERE id=%L)',cx,cy)),
   ('authenticated',i1,'I1 roster own / other',format('SELECT (SELECT count(*) FROM public.class_enrollments WHERE class_id=%L)||'' / ''||(SELECT count(*) FROM public.class_enrollments WHERE class_id=%L)',cx,cy)),
   ('authenticated',i1,'I1 attendance own / other',format('SELECT (SELECT count(*) FROM public.class_attendance WHERE class_id=%L)||'' / ''||(SELECT count(*) FROM public.class_attendance WHERE class_id=%L)',cx,cy)),
   ('authenticated',i1,'I1 certs issued by me / by I2',format('SELECT (SELECT count(*) FROM public.certificates WHERE issued_by=%L)||'' / ''||(SELECT count(*) FROM public.certificates WHERE issued_by=%L)',i1,i2)),
   ('authenticated',i1,'I1 own instructor row',format('SELECT count(*)::text FROM public.instructors WHERE id=%L',i1)),
   ('authenticated',i1,'I1 own-class student: progress / results',format('SELECT (SELECT count(*) FROM public.student_module_progress WHERE student_id=%L)||'' / ''||(SELECT count(*) FROM public.assessment_results WHERE student_id=%L)',sa,sa)),
   ('authenticated',i1,'I1 own-class student: name+email / profile',format('SELECT (SELECT count(email) FROM public.students WHERE id=%L)||'' / ''||(SELECT count(*) FROM public.student_profiles WHERE student_id=%L)',sa,sa)),
   ('authenticated',adm,'admin: classes / roster / attendance / certs (test rows)',format('SELECT (SELECT count(*) FROM public.scheduled_classes WHERE id IN (%L,%L))||'' / ''||(SELECT count(*) FROM public.class_enrollments WHERE class_id IN (%L,%L))||'' / ''||(SELECT count(*) FROM public.class_attendance WHERE class_id IN (%L,%L))||'' / ''||(SELECT count(*) FROM public.certificates WHERE issued_by IN (%L,%L))',cx,cy,cx,cy,cx,cy,i1,i2)),
   ('authenticated',adm,'admin: all progress / all results',$$SELECT (SELECT count(*) FROM public.student_module_progress)||' / '||(SELECT count(*) FROM public.assessment_results)$$),
   ('authenticated',sa,'student A: own row / own progress / own results',format('SELECT (SELECT count(*) FROM public.students WHERE id=%L)||'' / ''||(SELECT count(*) FROM public.student_module_progress WHERE student_id=%L)||'' / ''||(SELECT count(*) FROM public.assessment_results WHERE student_id=%L)',sa,sa,sa)),
   ('authenticated',sa,'student A: other student progress / results',format('SELECT (SELECT count(*) FROM public.student_module_progress WHERE student_id<>%L)||'' / ''||(SELECT count(*) FROM public.assessment_results WHERE student_id<>%L)',sa,sa)),
   ('authenticated',sa,'student A: own enrolment / own cert',format('SELECT (SELECT count(*) FROM public.class_enrollments WHERE student_id=%L)||'' / ''||(SELECT count(*) FROM public.certificates WHERE student_id=%L)',sa,sa)),
   ('anon',NULL,'anon: progress / results / students / certs',$$SELECT (SELECT count(*) FROM public.student_module_progress)||' / '||(SELECT count(*) FROM public.assessment_results)||' / '||(SELECT count(*) FROM public.students)||' / '||(SELECT count(*) FROM public.certificates)$$),
   ('anon',NULL,'anon: verify_certificate(VERIFYT71A)',$$SELECT holder_name FROM public.verify_certificate('VERIFYT71A')$$),
   ('anon',NULL,'anon: assessments list / courses',$$SELECT (SELECT count(*) FROM (SELECT id, assessment_name FROM public.assessments) x)||' / '||(SELECT count(*) FROM public.courses)$$);
  FOR i IN 1..3 LOOP
    ph := CASE i WHEN 1 THEN 'BEFORE' WHEN 2 THEN 'AFTER' ELSE 'RB' END;
    IF i = 2 THEN
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
-- Instructors: certificates they issued, or held by students in their own classes
-- (was: every instructor sees every certificate).
DROP POLICY IF EXISTS "Instructors can view all certificates" ON public.certificates;
CREATE POLICY certificates_instructor_scoped_select ON public.certificates FOR SELECT TO authenticated
  USING (issued_by = auth.uid() OR public.eadb_instructor_has_student(student_id));
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
    IF i = 3 THEN
      EXECUTE $r3$
-- ROLLBACK for eadb/20261013120000_eadb_quiz_answers_lockdown.sql (LEGACY EADB only).
-- Restores the policies/grants read on 2026-10-13. Re-exposes quiz answers.
DROP POLICY IF EXISTS assessment_questions_admin_select ON public.assessment_questions;
CREATE POLICY "Authenticated users can view questions" ON public.assessment_questions AS PERMISSIVE FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.assessment_questions TO anon;
GRANT SELECT ON public.assessments TO anon, authenticated;
CREATE POLICY "Users can insert own results" ON public.assessment_results AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = student_id));
DROP FUNCTION IF EXISTS public.get_assessment_quiz(uuid);
DROP FUNCTION IF EXISTS public.grade_assessment(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.admin_get_assessment_questions_json(uuid);
      $r3$;
      EXECUTE $r2$
-- =============================================================================
-- ROLLBACK for eadb/20261010180000_eadb_pii_read_lockdown.sql
-- Target: LEGACY EADB (project vaagvairvwmgyzsmymhs) ONLY.
-- Recreates the 24 SELECT policies exactly as read from pg_policies on
-- 2026-10-10. NOTE: this re-exposes every per-person table to anon.
-- verify_certificate() is kept (harmless, read-only, non-sensitive fields).
-- =============================================================================

DROP POLICY IF EXISTS students_staff_select ON public.students;
DROP POLICY IF EXISTS students_thread_partner_select ON public.students;
DROP POLICY IF EXISTS student_profiles_scoped_select ON public.student_profiles;
DROP POLICY IF EXISTS instructors_admin_select ON public.instructors;
DROP POLICY IF EXISTS student_course_enrollments_admin_select ON public.student_course_enrollments;
DROP POLICY IF EXISTS student_module_progress_staff_select ON public.student_module_progress;
DROP POLICY IF EXISTS assessment_results_staff_select ON public.assessment_results;
DROP POLICY IF EXISTS certificates_admin_select ON public.certificates;
DROP POLICY IF EXISTS class_attendance_admin_select ON public.class_attendance;
DROP POLICY IF EXISTS class_enrollments_admin_select ON public.class_enrollments;
DROP POLICY IF EXISTS class_enrollments_own_class_select ON public.class_enrollments;
DROP POLICY IF EXISTS scheduled_classes_admin_select ON public.scheduled_classes;
DROP POLICY IF EXISTS activity_log_scoped_select ON public.activity_log;
DROP POLICY IF EXISTS clients_scoped_select ON public.clients;
DROP POLICY IF EXISTS certifications_scoped_select ON public.certifications;
DROP POLICY IF EXISTS work_experience_scoped_select ON public.work_experience;
DROP POLICY IF EXISTS student_skills_scoped_select ON public.student_skills;
DROP POLICY IF EXISTS scenario_results_admin_select ON public.scenario_results;

CREATE POLICY anon_select_activity_log ON public.activity_log AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY authenticated_select_activity_log ON public.activity_log AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY anon_select_assessment_results ON public.assessment_results AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY anon_select_certificates ON public.certificates AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "Allow authenticated to view certifications" ON public.certifications AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Clients can view certifications of visible profiles" ON public.certifications AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM student_profiles sp
  WHERE ((sp.student_id = certifications.student_id) AND (sp.profile_visible = true)))));
CREATE POLICY anon_select_class_attendance ON public.class_attendance AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY anon_select_class_enrollments ON public.class_enrollments AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "Allow authenticated to view clients" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view clients" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "View active instructors" ON public.instructors AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));
CREATE POLICY anon_select_instructors ON public.instructors AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY anon_select_scheduled_classes ON public.scheduled_classes AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY anon_select_student_course_enrollments ON public.student_course_enrollments AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY anon_select_student_module_progress ON public.student_module_progress AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "Allow authenticated to view profiles" ON public.student_profiles AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view profiles" ON public.student_profiles AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY anon_select_student_skills ON public.student_skills AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY authenticated_select_student_skills ON public.student_skills AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated to view students" ON public.students AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view students" ON public.students AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY anon_select_students ON public.students AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "Allow authenticated users to view work experience" ON public.work_experience AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Instructors can view all enrollments" ON public.class_enrollments AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM instructors
  WHERE ((instructors.id = auth.uid()) AND (instructors.is_active = true)))));

DROP POLICY IF EXISTS certificates_instructor_scoped_select ON public.certificates;
CREATE POLICY "Instructors can view all certificates" ON public.certificates AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() IN ( SELECT instructors.id FROM instructors)));

DROP FUNCTION IF EXISTS public.eadb_is_active_instructor();
DROP FUNCTION IF EXISTS public.eadb_is_client();
DROP FUNCTION IF EXISTS public.eadb_instructor_has_student(uuid);
DROP FUNCTION IF EXISTS public.eadb_shares_thread(uuid);
DROP FUNCTION IF EXISTS public.eadb_instructor_owns_class(uuid);
DROP FUNCTION IF EXISTS public.eadb_profile_visible(uuid);
      $r2$;
    END IF;
    FOR r IN SELECT * FROM _c ORDER BY seq LOOP
      PERFORM pg_temp.act(r.role, r.uid);
      out := out || format(E'%-6s | %-56s | %s\n', ph, r.tst, pg_temp.q(r.sql));
      EXECUTE 'RESET ROLE';
    END LOOP;
  END LOOP;
  RAISE EXCEPTION E'ROLLED_BACK\n%', out;
END $t$;
