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

BEGIN;

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

COMMIT;
