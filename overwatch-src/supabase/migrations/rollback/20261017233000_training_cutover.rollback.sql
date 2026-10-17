-- Rollback for 20261017233000_training_cutover.sql (OverwatchDB).
-- Restores the previous policies and grade_training_quiz, drops the new RPCs and the CHECK.
-- NOT restored: answers moved out of quizzes.questions stay in training_quiz_answer_keys
-- (quizzes stay question_source = 'server' and keep working with the server RPCs). On
-- 2026-10-17 the two pre-existing Overwatch quizzes had 0 inline questions, so nothing moved.
-- Revert the app (cutover PR) BEFORE running this: the new UI calls the dropped RPCs.
BEGIN;

DROP FUNCTION IF EXISTS public.training_delete_course(uuid);
DROP FUNCTION IF EXISTS public.training_delete_quiz(uuid);
DROP FUNCTION IF EXISTS public.admin_save_training_quiz_questions(uuid, jsonb);
DROP FUNCTION IF EXISTS public.training_issue_certificate(uuid, uuid, text, text, text, date);
DROP FUNCTION IF EXISTS public.training_class_roster(uuid);
DROP FUNCTION IF EXISTS public.training_learner_progress(uuid, uuid);
DROP FUNCTION IF EXISTS public.training_list_learners(uuid);

-- grade_training_quiz as applied in 20261017184312
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
  IF NOT FOUND OR v_quiz.question_source <> 'server' OR NOT v_quiz.is_active THEN
    RAISE EXCEPTION 'quiz not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.training_can_view(v_quiz.company_id) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;

  SELECT count(*) INTO v_attempts FROM public.quiz_attempts a
   WHERE a.quiz_id = p_quiz_id AND a.user_id = v_user AND a.completed_at IS NOT NULL;
  IF v_quiz.max_attempts > 0 AND v_attempts >= v_quiz.max_attempts THEN
    RAISE EXCEPTION 'no attempts left' USING ERRCODE = '42501';
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
  IF v_total = 0 THEN RAISE EXCEPTION 'quiz has no questions' USING ERRCODE = 'P0002'; END IF;

  v_score := round(100.0 * v_correct / v_total);
  INSERT INTO public.quiz_attempts (id, quiz_id, user_id, answers, score, passed, started_at, completed_at, state_code)
  VALUES (gen_random_uuid(), p_quiz_id, v_user, jsonb_build_object('answers', p_answers, 'graded_by', 'server'),
          v_score, v_score >= v_quiz.passing_score, now(), now(), p_state_code);

  RETURN jsonb_build_object('correct', v_correct, 'total', v_total, 'score', v_score,
                            'passed', v_score >= v_quiz.passing_score, 'questions', v_detail);
END $$;

ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_no_inline_answers;
ALTER TABLE public.quizzes ALTER COLUMN question_source SET DEFAULT 'inline';

DROP POLICY IF EXISTS course_enrollments_manage_select ON public.course_enrollments;
DROP POLICY IF EXISTS smp_manage_select ON public.student_module_progress;
DROP POLICY IF EXISTS quiz_attempts_manage_select ON public.quiz_attempts;
GRANT INSERT, UPDATE, DELETE ON public.quiz_attempts TO authenticated;
CREATE POLICY quiz_attempts_insert ON public.quiz_attempts FOR INSERT TO authenticated WITH CHECK (user_id = public.get_my_user_id());
CREATE POLICY quiz_attempts_update ON public.quiz_attempts FOR UPDATE TO authenticated USING (user_id = public.get_my_user_id());
CREATE POLICY quiz_attempts_delete ON public.quiz_attempts FOR DELETE TO authenticated
  USING (user_id IN (SELECT users.id FROM public.users WHERE users.supabase_id = ((SELECT (SELECT auth.uid() AS uid) AS uid))::text));

DROP POLICY IF EXISTS aq_select ON public.assessment_questions;
CREATE POLICY aq_select ON public.assessment_questions FOR SELECT TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS module_slides_insert ON public.module_slides;
DROP POLICY IF EXISTS module_slides_update ON public.module_slides;
DROP POLICY IF EXISTS module_slides_delete ON public.module_slides;
CREATE POLICY module_slides_insert ON public.module_slides FOR INSERT TO authenticated
  WITH CHECK (module_id IN (SELECT training_modules.id FROM public.training_modules WHERE public.is_company_admin(training_modules.company_id)));
CREATE POLICY module_slides_update ON public.module_slides FOR UPDATE TO authenticated
  USING (module_id IN (SELECT training_modules.id FROM public.training_modules WHERE public.is_company_admin(training_modules.company_id)));
CREATE POLICY module_slides_delete ON public.module_slides FOR DELETE TO authenticated
  USING (module_id IN (SELECT training_modules.id FROM public.training_modules WHERE public.is_company_admin(training_modules.company_id)));

DROP POLICY IF EXISTS training_modules_insert ON public.training_modules;
DROP POLICY IF EXISTS training_modules_update ON public.training_modules;
DROP POLICY IF EXISTS training_modules_delete ON public.training_modules;
CREATE POLICY training_modules_insert ON public.training_modules FOR INSERT TO authenticated WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY training_modules_update ON public.training_modules FOR UPDATE TO authenticated USING (public.is_company_admin(company_id));
CREATE POLICY training_modules_delete ON public.training_modules FOR DELETE TO authenticated USING (public.is_company_admin(company_id));

DROP POLICY IF EXISTS quizzes_insert ON public.quizzes;
DROP POLICY IF EXISTS quizzes_update ON public.quizzes;
DROP POLICY IF EXISTS quizzes_delete ON public.quizzes;
CREATE POLICY quizzes_insert ON public.quizzes FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY quizzes_update ON public.quizzes FOR UPDATE TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY quizzes_delete ON public.quizzes FOR DELETE TO authenticated USING (public.is_company_admin(company_id));

DROP POLICY IF EXISTS courses_insert ON public.courses;
DROP POLICY IF EXISTS courses_update ON public.courses;
DROP POLICY IF EXISTS courses_delete ON public.courses;
CREATE POLICY courses_insert ON public.courses FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY courses_update ON public.courses FOR UPDATE TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY courses_delete ON public.courses FOR DELETE TO authenticated USING (public.is_company_admin(company_id));


-- Section 8 (class scoping): restore the pre-cutover class policies.
DROP POLICY IF EXISTS training_classes_select ON public.training_classes;
DROP POLICY IF EXISTS training_classes_insert ON public.training_classes;
DROP POLICY IF EXISTS training_classes_update ON public.training_classes;
DROP POLICY IF EXISTS training_classes_delete ON public.training_classes;
CREATE POLICY training_classes_select ON public.training_classes FOR SELECT TO authenticated USING (public.training_can_view(company_id));
CREATE POLICY training_classes_insert ON public.training_classes FOR INSERT TO authenticated WITH CHECK (public.training_can_manage(company_id));
CREATE POLICY training_classes_update ON public.training_classes FOR UPDATE TO authenticated USING (public.training_can_manage(company_id)) WITH CHECK (public.training_can_manage(company_id));
CREATE POLICY training_classes_delete ON public.training_classes FOR DELETE TO authenticated USING (public.training_can_manage(company_id));
DROP POLICY IF EXISTS training_class_enrollments_select ON public.training_class_enrollments;
DROP POLICY IF EXISTS training_class_enrollments_insert ON public.training_class_enrollments;
DROP POLICY IF EXISTS training_class_enrollments_update ON public.training_class_enrollments;
DROP POLICY IF EXISTS training_class_enrollments_delete ON public.training_class_enrollments;
CREATE POLICY training_class_enrollments_select ON public.training_class_enrollments FOR SELECT TO authenticated USING (public.training_can_manage(company_id) OR ((user_id = (SELECT public.get_my_user_id())) AND public.training_can_view(company_id)));
CREATE POLICY training_class_enrollments_insert ON public.training_class_enrollments FOR INSERT TO authenticated WITH CHECK (public.training_can_manage(company_id));
CREATE POLICY training_class_enrollments_update ON public.training_class_enrollments FOR UPDATE TO authenticated USING (public.training_can_manage(company_id)) WITH CHECK (public.training_can_manage(company_id));
CREATE POLICY training_class_enrollments_delete ON public.training_class_enrollments FOR DELETE TO authenticated USING (public.training_can_manage(company_id));
DROP POLICY IF EXISTS training_class_attendance_select ON public.training_class_attendance;
DROP POLICY IF EXISTS training_class_attendance_insert ON public.training_class_attendance;
DROP POLICY IF EXISTS training_class_attendance_update ON public.training_class_attendance;
DROP POLICY IF EXISTS training_class_attendance_delete ON public.training_class_attendance;
CREATE POLICY training_class_attendance_select ON public.training_class_attendance FOR SELECT TO authenticated USING (public.training_can_manage(company_id) OR ((user_id = (SELECT public.get_my_user_id())) AND public.training_can_view(company_id)));
CREATE POLICY training_class_attendance_insert ON public.training_class_attendance FOR INSERT TO authenticated WITH CHECK (public.training_can_manage(company_id));
CREATE POLICY training_class_attendance_update ON public.training_class_attendance FOR UPDATE TO authenticated USING (public.training_can_manage(company_id)) WITH CHECK (public.training_can_manage(company_id));
CREATE POLICY training_class_attendance_delete ON public.training_class_attendance FOR DELETE TO authenticated USING (public.training_can_manage(company_id));
DROP FUNCTION IF EXISTS public.training_can_manage_class(uuid, uuid);
DROP FUNCTION IF EXISTS public.training_is_enrolled_in_class(uuid);
DROP FUNCTION IF EXISTS public.training_sees_all_classes(uuid);

COMMIT;
