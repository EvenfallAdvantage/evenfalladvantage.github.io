-- EADB retirement phase 6 (code cutover), OverwatchDB. Applied 2026-10-17 13:23 PT as version 20261017202341
-- (MCP apply_migration; applied body = this file without the BEGIN/COMMIT lines).
--
-- What it does
--   1. Quizzes: every quiz becomes server-graded. Inline `quizzes.questions` (which carried
--      `correctIndex`, readable by every member) are moved into training_quiz_questions +
--      training_quiz_answer_keys, then emptied, and a CHECK keeps them empty. New quizzes
--      default to question_source = 'server'.
--   2. Quiz attempts can only be written by grade_training_quiz (no client insert/update/delete),
--      so scores and max_attempts can't be faked from the browser.
--   3. grade_training_quiz: a missing/inactive quiz now returns HTTP 404 (PostgREST custom
--      error), not 500. A quiz with no questions records an "acknowledged" pass (the
--      Drills page used to do this in the browser).
--   4. Training content writes (courses, quizzes, training_modules, module_slides) move to
--      training_can_manage (owner/admin/manager/instructor). Before: courses and quizzes
--      were writable by ANY member, and instructors couldn't edit modules/slides at all.
--   5. Question bank (assessment_questions has correct_answer): readable by managers only.
--   6. Instructor/manager read access to learner progress, attempts and enrolments for
--      their company's content.
--   7. Instructor HQ RPCs (SECURITY DEFINER, all check training_can_manage):
--      training_list_learners, training_learner_progress, training_class_roster,
--      training_issue_certificate, admin_save_training_quiz_questions,
--      training_delete_quiz, training_delete_course.
--   8. Class scoping: instructors (and managers) see and manage only the classes they teach
--      (training_classes.instructor_user_id) and those classes' rosters/attendance. Owners and
--      admins see all of the company's classes. Learners see only classes they're enrolled in.
--      Before: every member could list every class, and any manager+ could read every roster.
--
-- Requires 20261017184312_training_eadb_consolidation (applied).
-- Test (rolled back): tests/training_cutover_rolledback_test.sql
-- Rollback: migrations/rollback/20261017202341_training_cutover.rollback.sql

BEGIN;

-- ── 1. Quizzes → server-only answers ──────────────────────────────────────
-- Inline shape (Drills page): [{id, text, options: string[], correctIndex: int}]
WITH src AS (
  SELECT z.id AS quiz_id, z.company_id, e, n
  FROM public.quizzes z, jsonb_array_elements(z.questions) WITH ORDINALITY t(e, n)
  WHERE z.question_source = 'inline' AND jsonb_typeof(z.questions) = 'array'
), ins AS (
  INSERT INTO public.training_quiz_questions (company_id, quiz_id, question_number, question_text, options)
  SELECT s.company_id, s.quiz_id, s.n,
         coalesce(nullif(s.e->>'text', ''), nullif(s.e->>'question', ''), 'Question ' || s.n),
         coalesce((SELECT jsonb_object_agg(chr(64 + i::int), o) FROM jsonb_array_elements_text(s.e->'options') WITH ORDINALITY t2(o, i)), '{}'::jsonb)
  FROM src s
  RETURNING id, quiz_id, question_number
)
INSERT INTO public.training_quiz_answer_keys (question_id, correct_answer, explanation)
SELECT ins.id, chr(65 + (s.e->>'correctIndex')::int), s.e->>'explanation'
FROM ins JOIN src s ON s.quiz_id = ins.quiz_id AND s.n = ins.question_number
WHERE (s.e->>'correctIndex') ~ '^[0-9]+$'
  AND (s.e->>'correctIndex')::int < jsonb_array_length(coalesce(s.e->'options', '[]'::jsonb));

UPDATE public.quizzes SET questions = '[]'::jsonb, question_source = 'server', updated_at = now() AT TIME ZONE 'UTC'
WHERE question_source = 'inline' OR questions <> '[]'::jsonb;

ALTER TABLE public.quizzes ALTER COLUMN question_source SET DEFAULT 'server';
ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_no_inline_answers;
ALTER TABLE public.quizzes ADD CONSTRAINT quizzes_no_inline_answers
  CHECK (question_source = 'server' AND questions = '[]'::jsonb);

-- ── 2/4/5/6. Policies ──────────────────────────────────────────────────────
-- courses
DROP POLICY IF EXISTS courses_insert ON public.courses;
DROP POLICY IF EXISTS courses_update ON public.courses;
DROP POLICY IF EXISTS courses_delete ON public.courses;
CREATE POLICY courses_insert ON public.courses FOR INSERT TO authenticated WITH CHECK (public.training_can_manage(company_id));
CREATE POLICY courses_update ON public.courses FOR UPDATE TO authenticated
  USING (public.training_can_manage(company_id)) WITH CHECK (public.training_can_manage(company_id));
CREATE POLICY courses_delete ON public.courses FOR DELETE TO authenticated USING (public.training_can_manage(company_id));

-- quizzes
DROP POLICY IF EXISTS quizzes_insert ON public.quizzes;
DROP POLICY IF EXISTS quizzes_update ON public.quizzes;
DROP POLICY IF EXISTS quizzes_delete ON public.quizzes;
CREATE POLICY quizzes_insert ON public.quizzes FOR INSERT TO authenticated WITH CHECK (public.training_can_manage(company_id));
CREATE POLICY quizzes_update ON public.quizzes FOR UPDATE TO authenticated
  USING (public.training_can_manage(company_id)) WITH CHECK (public.training_can_manage(company_id));
CREATE POLICY quizzes_delete ON public.quizzes FOR DELETE TO authenticated USING (public.training_can_manage(company_id));

-- training_modules
DROP POLICY IF EXISTS training_modules_insert ON public.training_modules;
DROP POLICY IF EXISTS training_modules_update ON public.training_modules;
DROP POLICY IF EXISTS training_modules_delete ON public.training_modules;
CREATE POLICY training_modules_insert ON public.training_modules FOR INSERT TO authenticated WITH CHECK (public.training_can_manage(company_id));
CREATE POLICY training_modules_update ON public.training_modules FOR UPDATE TO authenticated
  USING (public.training_can_manage(company_id)) WITH CHECK (public.training_can_manage(company_id));
CREATE POLICY training_modules_delete ON public.training_modules FOR DELETE TO authenticated USING (public.training_can_manage(company_id));

-- module_slides (company via the module)
DROP POLICY IF EXISTS module_slides_insert ON public.module_slides;
DROP POLICY IF EXISTS module_slides_update ON public.module_slides;
DROP POLICY IF EXISTS module_slides_delete ON public.module_slides;
CREATE POLICY module_slides_insert ON public.module_slides FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.training_modules m WHERE m.id = module_id AND public.training_can_manage(m.company_id)));
CREATE POLICY module_slides_update ON public.module_slides FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.training_modules m WHERE m.id = module_id AND public.training_can_manage(m.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.training_modules m WHERE m.id = module_id AND public.training_can_manage(m.company_id)));
CREATE POLICY module_slides_delete ON public.module_slides FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.training_modules m WHERE m.id = module_id AND public.training_can_manage(m.company_id)));

-- question bank: answers inside, managers only
DROP POLICY IF EXISTS aq_select ON public.assessment_questions;
CREATE POLICY aq_select ON public.assessment_questions FOR SELECT TO authenticated USING (public.training_can_manage(company_id));

-- quiz attempts: written only by grade_training_quiz; learners read their own, managers their company's
DROP POLICY IF EXISTS quiz_attempts_insert ON public.quiz_attempts;
DROP POLICY IF EXISTS quiz_attempts_update ON public.quiz_attempts;
DROP POLICY IF EXISTS quiz_attempts_delete ON public.quiz_attempts;
DROP POLICY IF EXISTS quiz_attempts_manage_select ON public.quiz_attempts;
CREATE POLICY quiz_attempts_manage_select ON public.quiz_attempts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.quizzes z WHERE z.id = quiz_id AND public.training_can_manage(z.company_id)));
REVOKE INSERT, UPDATE, DELETE ON public.quiz_attempts FROM anon, authenticated;

-- learner progress / enrolments: managers read their company's
DROP POLICY IF EXISTS smp_manage_select ON public.student_module_progress;
CREATE POLICY smp_manage_select ON public.student_module_progress FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.training_modules m WHERE m.id = module_id AND public.training_can_manage(m.company_id)));
DROP POLICY IF EXISTS course_enrollments_manage_select ON public.course_enrollments;
CREATE POLICY course_enrollments_manage_select ON public.course_enrollments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND public.training_can_manage(c.company_id)));

-- ── 3. grade_training_quiz: 404 for a missing quiz; acknowledged pass for 0 questions ──
CREATE OR REPLACE FUNCTION public.grade_training_quiz(p_quiz_id uuid, p_answers jsonb, p_state_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := public.get_my_user_id();
  v_quiz public.quizzes%ROWTYPE;
  v_total int; v_correct int; v_score int; v_detail jsonb; v_attempts int;
BEGIN
  IF auth.uid() IS NULL OR v_user IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'answers must be an object' USING ERRCODE = '22023';
  END IF;
  IF p_state_code IS NOT NULL AND length(p_state_code) > 10 THEN RAISE EXCEPTION 'bad state code' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_quiz FROM public.quizzes WHERE id = p_quiz_id;
  -- Same answer for "doesn't exist" and "not yours to see", so ids can't be probed.
  IF NOT FOUND OR v_quiz.question_source <> 'server' OR NOT v_quiz.is_active
     OR NOT public.training_can_view(v_quiz.company_id) THEN
    RAISE SQLSTATE 'PGRST' USING
      MESSAGE = '{"code":"quiz_not_found","message":"Quiz not found"}',
      DETAIL  = '{"status":404,"headers":{}}';
  END IF;

  SELECT count(*) INTO v_attempts FROM public.quiz_attempts a
   WHERE a.quiz_id = p_quiz_id AND a.user_id = v_user AND a.completed_at IS NOT NULL;
  IF v_quiz.max_attempts > 0 AND v_attempts >= v_quiz.max_attempts THEN
    RAISE SQLSTATE 'PGRST' USING
      MESSAGE = '{"code":"no_attempts_left","message":"No attempts left"}',
      DETAIL  = '{"status":403,"headers":{}}';
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE upper(p_answers ->> q.id::text) = upper(k.correct_answer)),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'is_correct', upper(p_answers ->> q.id::text) IS NOT DISTINCT FROM upper(k.correct_answer),
           'correct_answer', upper(k.correct_answer), 'explanation', k.explanation) ORDER BY q.question_number), '[]'::jsonb)
    INTO v_total, v_correct, v_detail
  FROM public.training_quiz_questions q
  JOIN public.training_quiz_answer_keys k ON k.question_id = q.id
  WHERE q.quiz_id = p_quiz_id;

  IF v_total = 0 THEN
    -- Read-and-acknowledge drill (no questions): record a completion.
    v_correct := 0; v_score := 100;
  ELSE
    v_score := round(100.0 * v_correct / v_total);
  END IF;

  INSERT INTO public.quiz_attempts (id, quiz_id, user_id, answers, score, passed, started_at, completed_at, state_code)
  VALUES (gen_random_uuid(), p_quiz_id, v_user,
          jsonb_build_object('answers', p_answers, 'graded_by', 'server', 'acknowledged', v_total = 0),
          v_score, v_score >= v_quiz.passing_score, now(), now(), p_state_code);

  RETURN jsonb_build_object('correct', v_correct, 'total', v_total, 'score', v_score,
                            'passed', v_score >= v_quiz.passing_score, 'questions', v_detail);
END $$;

-- ── 8. Class scoping (defined before the RPCs that use it) ─────────────────
-- Owners/admins: all classes of the company. Instructors/managers: classes they teach.
-- Learners: classes they're enrolled in (read only). Managers follow the same "own only"
-- rule as instructors: nothing in Overwatch gives managers company-wide class access
-- (Instructor HQ itself is instructor/admin/owner only).
CREATE OR REPLACE FUNCTION public.training_sees_all_classes(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce(public.role_rank(public.my_company_role(p_company_id)) >= public.role_rank('admin'), false)
$$;

-- Can the caller manage this class (edit it, see/edit its roster and attendance)?
-- p_company_id, when given, must be the class's company (stops cross-company rows).
CREATE OR REPLACE FUNCTION public.training_can_manage_class(p_class_id uuid, p_company_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.training_classes c
    WHERE c.id = p_class_id
      AND c.company_id = coalesce(p_company_id, c.company_id)
      AND public.training_can_manage(c.company_id)
      AND (public.training_sees_all_classes(c.company_id) OR c.instructor_user_id = public.get_my_user_id())
  )
$$;

CREATE OR REPLACE FUNCTION public.training_is_enrolled_in_class(p_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.training_class_enrollments e
                 WHERE e.class_id = p_class_id AND e.user_id = public.get_my_user_id())
$$;

REVOKE ALL ON FUNCTION public.training_sees_all_classes(uuid), public.training_can_manage_class(uuid, uuid),
  public.training_is_enrolled_in_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_sees_all_classes(uuid), public.training_can_manage_class(uuid, uuid),
  public.training_is_enrolled_in_class(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS training_classes_select ON public.training_classes;
DROP POLICY IF EXISTS training_classes_insert ON public.training_classes;
DROP POLICY IF EXISTS training_classes_update ON public.training_classes;
DROP POLICY IF EXISTS training_classes_delete ON public.training_classes;
CREATE POLICY training_classes_select ON public.training_classes FOR SELECT TO authenticated USING (
  public.training_sees_all_classes(company_id)
  OR (public.training_can_manage(company_id) AND instructor_user_id = (SELECT public.get_my_user_id()))
  OR (public.training_can_view(company_id) AND public.training_is_enrolled_in_class(id)));
-- Instructors/managers can only create, edit or delete classes they teach (and can't hand
-- a class to someone else); owners/admins can do it for anyone.
CREATE POLICY training_classes_insert ON public.training_classes FOR INSERT TO authenticated WITH CHECK (
  public.training_can_manage(company_id)
  AND (public.training_sees_all_classes(company_id) OR instructor_user_id = (SELECT public.get_my_user_id())));
CREATE POLICY training_classes_update ON public.training_classes FOR UPDATE TO authenticated
  USING (public.training_can_manage(company_id)
    AND (public.training_sees_all_classes(company_id) OR instructor_user_id = (SELECT public.get_my_user_id())))
  WITH CHECK (public.training_can_manage(company_id)
    AND (public.training_sees_all_classes(company_id) OR instructor_user_id = (SELECT public.get_my_user_id())));
CREATE POLICY training_classes_delete ON public.training_classes FOR DELETE TO authenticated USING (
  public.training_can_manage(company_id)
  AND (public.training_sees_all_classes(company_id) OR instructor_user_id = (SELECT public.get_my_user_id())));

DROP POLICY IF EXISTS training_class_enrollments_select ON public.training_class_enrollments;
DROP POLICY IF EXISTS training_class_enrollments_insert ON public.training_class_enrollments;
DROP POLICY IF EXISTS training_class_enrollments_update ON public.training_class_enrollments;
DROP POLICY IF EXISTS training_class_enrollments_delete ON public.training_class_enrollments;
CREATE POLICY training_class_enrollments_select ON public.training_class_enrollments FOR SELECT TO authenticated USING (
  public.training_can_manage_class(class_id)
  OR (user_id = (SELECT public.get_my_user_id()) AND public.training_can_view(company_id)));
CREATE POLICY training_class_enrollments_insert ON public.training_class_enrollments FOR INSERT TO authenticated
  WITH CHECK (public.training_can_manage_class(class_id, company_id));
CREATE POLICY training_class_enrollments_update ON public.training_class_enrollments FOR UPDATE TO authenticated
  USING (public.training_can_manage_class(class_id)) WITH CHECK (public.training_can_manage_class(class_id, company_id));
CREATE POLICY training_class_enrollments_delete ON public.training_class_enrollments FOR DELETE TO authenticated
  USING (public.training_can_manage_class(class_id));

DROP POLICY IF EXISTS training_class_attendance_select ON public.training_class_attendance;
DROP POLICY IF EXISTS training_class_attendance_insert ON public.training_class_attendance;
DROP POLICY IF EXISTS training_class_attendance_update ON public.training_class_attendance;
DROP POLICY IF EXISTS training_class_attendance_delete ON public.training_class_attendance;
CREATE POLICY training_class_attendance_select ON public.training_class_attendance FOR SELECT TO authenticated USING (
  public.training_can_manage_class(class_id)
  OR (user_id = (SELECT public.get_my_user_id()) AND public.training_can_view(company_id)));
CREATE POLICY training_class_attendance_insert ON public.training_class_attendance FOR INSERT TO authenticated
  WITH CHECK (public.training_can_manage_class(class_id, company_id));
CREATE POLICY training_class_attendance_update ON public.training_class_attendance FOR UPDATE TO authenticated
  USING (public.training_can_manage_class(class_id)) WITH CHECK (public.training_can_manage_class(class_id, company_id));
CREATE POLICY training_class_attendance_delete ON public.training_class_attendance FOR DELETE TO authenticated
  USING (public.training_can_manage_class(class_id));

-- ── 7. Instructor HQ RPCs ──────────────────────────────────────────────────
-- Learners of a company: active members, plus anyone with training history on its content
-- (EADB learners without a membership yet, phase 4).
CREATE OR REPLACE FUNCTION public.training_list_learners(p_company_id uuid)
RETURNS TABLE (user_id uuid, email text, first_name text, last_name text, created_at timestamp,
               last_login_at timestamp, has_login boolean, member_role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.training_can_manage(p_company_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH ids AS (
    SELECT cm.user_id AS uid FROM public.company_memberships cm WHERE cm.company_id = p_company_id AND cm.status = 'active'
    UNION SELECT p.user_id FROM public.student_module_progress p JOIN public.training_modules m ON m.id = p.module_id WHERE m.company_id = p_company_id
    UNION SELECT a.user_id FROM public.quiz_attempts a JOIN public.quizzes z ON z.id = a.quiz_id WHERE z.company_id = p_company_id
    UNION SELECT e.user_id FROM public.course_enrollments e JOIN public.courses c ON c.id = e.course_id WHERE c.company_id = p_company_id
  )
  SELECT u.id, u.email, u.first_name, u.last_name, u.created_at, u.last_login_at, u.supabase_id IS NOT NULL,
         (SELECT cm.role::text FROM public.company_memberships cm
           WHERE cm.user_id = u.id AND cm.company_id = p_company_id AND cm.status = 'active' LIMIT 1)
  FROM ids JOIN public.users u ON u.id = ids.uid
  ORDER BY u.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.training_learner_progress(p_company_id uuid, p_user_id uuid)
RETURNS TABLE (id uuid, module_id uuid, module_name text, module_code text, status text,
               progress_percentage integer, current_slide integer, completed_at timestamptz, last_accessed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.training_can_manage(p_company_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT p.id, p.module_id, m.module_name, m.module_code, p.status, p.progress_percentage, p.current_slide,
         p.completed_at, p.last_accessed_at
  FROM public.student_module_progress p JOIN public.training_modules m ON m.id = p.module_id
  WHERE p.user_id = p_user_id AND m.company_id = p_company_id
  ORDER BY m.display_order, m.module_name;
END $$;

CREATE OR REPLACE FUNCTION public.training_class_roster(p_class_id uuid)
RETURNS TABLE (user_id uuid, first_name text, last_name text, email text, enrollment_status text,
               attendance_status text, attendance_notes text, marked_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Own classes only, unless owner/admin (section 8).
  IF NOT public.training_can_manage_class(p_class_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT u.id, u.first_name, u.last_name, u.email, e.enrollment_status, a.attendance_status, a.notes, a.created_at
  FROM public.training_class_enrollments e
  JOIN public.users u ON u.id = e.user_id
  LEFT JOIN public.training_class_attendance a ON a.class_id = e.class_id AND a.user_id = e.user_id
  WHERE e.class_id = p_class_id
  ORDER BY u.last_name, u.first_name;
END $$;

CREATE OR REPLACE FUNCTION public.training_issue_certificate(p_company_id uuid, p_user_id uuid, p_name text,
  p_category text DEFAULT 'course_completion', p_state text DEFAULT NULL, p_expiry date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid := gen_random_uuid(); v_issuer text;
BEGIN
  IF NOT public.training_can_manage(p_company_id) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 OR length(p_name) > 200 THEN RAISE EXCEPTION 'missing:name' USING ERRCODE = '22023'; END IF;
  IF p_state IS NOT NULL AND length(p_state) > 10 THEN RAISE EXCEPTION 'invalid_value:state' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.training_list_learners(p_company_id) l WHERE l.user_id = p_user_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '22023';
  END IF;
  SELECT trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) INTO v_issuer
  FROM public.users u WHERE u.id = public.get_my_user_id();
  INSERT INTO public.certifications (id, user_id, cert_type, issue_date, expiry_date, status, created_at,
    certificate_number, issued_by, verification_code, category, company_id, state_issued)
  VALUES (v_id, p_user_id, trim(p_name), (now() AT TIME ZONE 'UTC')::date, p_expiry, 'active', now() AT TIME ZONE 'UTC',
    'EA-' || upper(to_hex((extract(epoch from now()) * 1000)::bigint)) || '-' || upper(substr(md5(random()::text), 1, 4)),
    nullif(v_issuer, ''), 'V-' || upper(substr(md5(random()::text || v_id::text), 1, 8)),
    coalesce(nullif(p_category, ''), 'course_completion'), p_company_id, nullif(trim(p_state), ''));
  RETURN v_id;
END $$;

-- Replace a quiz's questions and answers in one transaction. Keeps question ids by
-- position so past attempts still line up. p_questions: [{question, options:[..], correct: "A", explanation?}]
CREATE OR REPLACE FUNCTION public.admin_save_training_quiz_questions(p_quiz_id uuid, p_questions jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_company uuid; v_n int; e jsonb; i int := 0; v_qid uuid; v_opts jsonb; v_correct text;
BEGIN
  SELECT company_id INTO v_company FROM public.quizzes WHERE id = p_quiz_id;
  IF v_company IS NULL OR NOT public.training_can_manage(v_company) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN RAISE EXCEPTION 'invalid_value:questions' USING ERRCODE = '22023'; END IF;
  v_n := jsonb_array_length(p_questions);
  IF v_n > 500 THEN RAISE EXCEPTION 'invalid_value:questions' USING ERRCODE = '22023'; END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(p_questions) x LOOP
    i := i + 1;
    IF coalesce(trim(e->>'question'), '') = '' THEN RAISE EXCEPTION 'missing:question' USING ERRCODE = '22023'; END IF;
    IF jsonb_typeof(e->'options') <> 'array' OR jsonb_array_length(e->'options') NOT BETWEEN 2 AND 8 THEN
      RAISE EXCEPTION 'invalid_value:options' USING ERRCODE = '22023';
    END IF;
    SELECT jsonb_object_agg(chr(64 + k::int), trim(o)) INTO v_opts FROM jsonb_array_elements_text(e->'options') WITH ORDINALITY t(o, k);
    v_correct := upper(trim(coalesce(e->>'correct', '')));
    IF NOT (v_opts ? v_correct) THEN RAISE EXCEPTION 'invalid_value:correct_answer' USING ERRCODE = '22023'; END IF;

    SELECT q.id INTO v_qid FROM public.training_quiz_questions q WHERE q.quiz_id = p_quiz_id AND q.question_number = i
      ORDER BY q.created_at LIMIT 1;
    IF v_qid IS NULL THEN
      INSERT INTO public.training_quiz_questions (company_id, quiz_id, question_number, question_text, options)
      VALUES (v_company, p_quiz_id, i, trim(e->>'question'), v_opts) RETURNING id INTO v_qid;
    ELSE
      UPDATE public.training_quiz_questions SET question_text = trim(e->>'question'), options = v_opts WHERE id = v_qid;
    END IF;
    INSERT INTO public.training_quiz_answer_keys (question_id, correct_answer, explanation)
    VALUES (v_qid, v_correct, nullif(trim(e->>'explanation'), ''))
    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer, explanation = EXCLUDED.explanation;
    v_qid := NULL;
  END LOOP;
  DELETE FROM public.training_quiz_questions WHERE quiz_id = p_quiz_id AND question_number > v_n;
  UPDATE public.quizzes SET updated_at = now() AT TIME ZONE 'UTC' WHERE id = p_quiz_id;
  RETURN v_n;
END $$;

CREATE OR REPLACE FUNCTION public.training_delete_quiz(p_quiz_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.quizzes WHERE id = p_quiz_id;
  IF v_company IS NULL OR NOT public.training_can_manage(v_company) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_attempts WHERE quiz_id = p_quiz_id) THEN
    RAISE EXCEPTION 'assessment_in_use' USING ERRCODE = '23503';
  END IF;
  DELETE FROM public.quizzes WHERE id = p_quiz_id;
END $$;

CREATE OR REPLACE FUNCTION public.training_delete_course(p_course_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_company uuid;
BEGIN
  SELECT company_id INTO v_company FROM public.courses WHERE id = p_course_id;
  IF v_company IS NULL OR NOT public.training_can_manage(v_company) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.course_enrollments WHERE course_id = p_course_id)
     OR EXISTS (SELECT 1 FROM public.payment_transactions WHERE course_id = p_course_id) THEN
    RAISE EXCEPTION 'course_in_use' USING ERRCODE = '23503';
  END IF;
  DELETE FROM public.courses WHERE id = p_course_id;
END $$;

REVOKE ALL ON FUNCTION public.training_list_learners(uuid), public.training_learner_progress(uuid, uuid),
  public.training_class_roster(uuid), public.training_issue_certificate(uuid, uuid, text, text, text, date),
  public.admin_save_training_quiz_questions(uuid, jsonb), public.training_delete_quiz(uuid),
  public.training_delete_course(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_list_learners(uuid), public.training_learner_progress(uuid, uuid),
  public.training_class_roster(uuid), public.training_issue_certificate(uuid, uuid, text, text, text, date),
  public.admin_save_training_quiz_questions(uuid, jsonb), public.training_delete_quiz(uuid),
  public.training_delete_course(uuid) TO authenticated, service_role;

COMMIT;
