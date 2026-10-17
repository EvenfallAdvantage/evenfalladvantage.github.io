-- EADB retirement, phase 1: OverwatchDB schema for the training data that lives in
-- the legacy EADB project (vaagvairvwmgyzsmymhs). DRAFT: not applied.
--
-- What this adds
--   * eadb_id (uuid, unique) on every table EADB rows will be copied into, so the
--     copy script can upsert idempotently and be undone with
--     `delete ... where eadb_id is not null`.
--   * Columns EADB has and OverwatchDB lacks (courses, training_modules, module_slides,
--     quizzes, quiz_attempts, course_enrollments, company_memberships).
--   * New tables: course_modules, course_completion_requirements,
--     certificate_prerequisites, state_laws, training_classes,
--     training_class_enrollments, training_class_attendance,
--     training_quiz_questions, training_quiz_answer_keys.
--   * Server-side quizzes (same model as EADB #71): questions are readable by members,
--     answers live in training_quiz_answer_keys, which no client role can read.
--     grade_training_quiz() grades and records the attempt; instructors and above
--     manage answers through admin_* RPCs.
--
-- Access model (company-scoped; EADB content will belong to Evenfall Advantage LLC
-- only, since every copied row carries that company_id):
--   training_can_view(company)   = active member with role >= staff (clients excluded)
--   training_can_manage(company) = active owner / admin / instructor / manager
--   anon: no privileges on any new table.
--
-- Rollback: migrations/rollback/20261017190000_training_eadb_consolidation.rollback.sql
-- (drops only what this file adds; existing rows and policies are untouched).

BEGIN;

-- ── Helpers ────────────────────────────────────────────────────────────────
-- SECURITY INVOKER: they only call my_company_role() (already SECURITY DEFINER) and role_rank().
CREATE OR REPLACE FUNCTION public.training_can_view(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(public.role_rank(public.my_company_role(p_company_id)) >= public.role_rank('staff'), false)
$$;

CREATE OR REPLACE FUNCTION public.training_can_manage(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(public.role_rank(public.my_company_role(p_company_id)) >= public.role_rank('manager'), false)
$$;

REVOKE ALL ON FUNCTION public.training_can_view(uuid), public.training_can_manage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_can_view(uuid), public.training_can_manage(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.training_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

-- ── Columns on existing tables ─────────────────────────────────────────────
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS eadb_id uuid,
  ADD COLUMN IF NOT EXISTS course_code text,
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS prerequisites text[],
  ADD COLUMN IF NOT EXISTS learning_objectives text[],
  ADD COLUMN IF NOT EXISTS target_audience text;

ALTER TABLE public.training_modules
  ADD COLUMN IF NOT EXISTS eadb_id uuid,
  ADD COLUMN IF NOT EXISTS estimated_time text,
  ADD COLUMN IF NOT EXISTS default_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL;

ALTER TABLE public.module_slides
  ADD COLUMN IF NOT EXISTS eadb_id uuid,
  ADD COLUMN IF NOT EXISTS slide_type text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS audio_autoplay boolean NOT NULL DEFAULT false;

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS eadb_id uuid,
  ADD COLUMN IF NOT EXISTS category text,
  -- 'inline' = existing Overwatch quizzes (questions jsonb, unchanged);
  -- 'server' = questions in training_quiz_questions, graded by grade_training_quiz().
  ADD COLUMN IF NOT EXISTS question_source text NOT NULL DEFAULT 'inline';
DO $$ BEGIN
  ALTER TABLE public.quizzes ADD CONSTRAINT quizzes_question_source_check CHECK (question_source IN ('inline','server'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS eadb_id uuid,
  ADD COLUMN IF NOT EXISTS time_taken_minutes integer;

ALTER TABLE public.student_module_progress ADD COLUMN IF NOT EXISTS eadb_id uuid;

ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS eadb_id uuid,
  ADD COLUMN IF NOT EXISTS enrollment_type text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS payment_ref text;

ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS eadb_id uuid;

-- People: EADB students.id / instructors.id are EADB auth uids.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS eadb_user_id uuid;
ALTER TABLE public.company_memberships
  ADD COLUMN IF NOT EXISTS training_profile jsonb;  -- linkedin, resume, DOB, skills, availability, etc.

CREATE UNIQUE INDEX IF NOT EXISTS courses_eadb_id_key                 ON public.courses (eadb_id);
CREATE UNIQUE INDEX IF NOT EXISTS training_modules_eadb_id_key        ON public.training_modules (eadb_id);
CREATE UNIQUE INDEX IF NOT EXISTS module_slides_eadb_id_key           ON public.module_slides (eadb_id);
CREATE UNIQUE INDEX IF NOT EXISTS quizzes_eadb_id_key                 ON public.quizzes (eadb_id);
CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_eadb_id_key           ON public.quiz_attempts (eadb_id);
CREATE UNIQUE INDEX IF NOT EXISTS student_module_progress_eadb_id_key ON public.student_module_progress (eadb_id);
CREATE UNIQUE INDEX IF NOT EXISTS course_enrollments_eadb_id_key      ON public.course_enrollments (eadb_id);
CREATE UNIQUE INDEX IF NOT EXISTS certifications_eadb_id_key          ON public.certifications (eadb_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_eadb_user_id_key              ON public.users (eadb_user_id);
CREATE INDEX IF NOT EXISTS training_modules_default_course_id_idx     ON public.training_modules (default_course_id);

-- ── Course structure ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.course_modules (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  course_id              uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id              uuid NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  module_order           integer NOT NULL DEFAULT 0,
  is_required            boolean NOT NULL DEFAULT true,
  unlock_after_module_id uuid REFERENCES public.training_modules(id) ON DELETE SET NULL,
  eadb_id                uuid UNIQUE,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, module_id)
);
CREATE INDEX IF NOT EXISTS course_modules_company_idx ON public.course_modules (company_id);
CREATE INDEX IF NOT EXISTS course_modules_module_idx  ON public.course_modules (module_id);
CREATE INDEX IF NOT EXISTS course_modules_unlock_idx  ON public.course_modules (unlock_after_module_id);

CREATE TABLE IF NOT EXISTS public.course_completion_requirements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  course_id         uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  requirement_type  text NOT NULL,
  requirement_value jsonb,
  is_required       boolean NOT NULL DEFAULT true,
  eadb_id           uuid UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ccr_company_idx ON public.course_completion_requirements (company_id);
CREATE INDEX IF NOT EXISTS ccr_course_idx  ON public.course_completion_requirements (course_id);

CREATE TABLE IF NOT EXISTS public.certificate_prerequisites (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  certificate_type   text NOT NULL,
  prerequisite_type  text NOT NULL,
  prerequisite_value text,
  description        text,
  is_required        boolean NOT NULL DEFAULT true,
  eadb_id            uuid UNIQUE,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cert_prereq_company_idx ON public.certificate_prerequisites (company_id);

CREATE TABLE IF NOT EXISTS public.state_laws (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  state_code        varchar(2) NOT NULL,
  state_name        varchar(100),
  licensing         text,
  training_hours    text,
  min_age           varchar(50),
  use_of_force      text,
  citizens_arrest   text,
  weapons           text,
  regulatory_agency text,
  notes             text,
  eadb_id           uuid UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, state_code)
);

-- ── Classes and attendance ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_classes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  course_id          uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  instructor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  class_name         text NOT NULL,
  class_type         text,
  scheduled_date     date,
  start_time         time,
  end_time           time,
  duration_hours     numeric(4,1),
  capacity           integer CHECK (capacity IS NULL OR capacity >= 0),
  location           text,
  description        text,
  meeting_link       text,
  status             text NOT NULL DEFAULT 'scheduled',
  eadb_id            uuid UNIQUE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS training_classes_company_date_idx ON public.training_classes (company_id, scheduled_date);
CREATE INDEX IF NOT EXISTS training_classes_course_idx       ON public.training_classes (course_id);
CREATE INDEX IF NOT EXISTS training_classes_instructor_idx   ON public.training_classes (instructor_user_id);

CREATE TABLE IF NOT EXISTS public.training_class_enrollments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  class_id          uuid NOT NULL REFERENCES public.training_classes(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enrollment_status text NOT NULL DEFAULT 'enrolled',
  enrolled_at       timestamptz NOT NULL DEFAULT now(),
  eadb_id           uuid UNIQUE,
  UNIQUE (class_id, user_id)
);
CREATE INDEX IF NOT EXISTS tce_company_idx ON public.training_class_enrollments (company_id);
CREATE INDEX IF NOT EXISTS tce_user_idx    ON public.training_class_enrollments (user_id);

CREATE TABLE IF NOT EXISTS public.training_class_attendance (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  class_id          uuid NOT NULL REFERENCES public.training_classes(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attendance_status text NOT NULL DEFAULT 'present',
  check_in_time     timestamptz,
  check_out_time    timestamptz,
  notes             text,
  marked_by         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  eadb_id           uuid UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id)
);
CREATE INDEX IF NOT EXISTS tca_company_idx   ON public.training_class_attendance (company_id);
CREATE INDEX IF NOT EXISTS tca_user_idx      ON public.training_class_attendance (user_id);
CREATE INDEX IF NOT EXISTS tca_marked_by_idx ON public.training_class_attendance (marked_by);

-- ── Server-side quizzes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_quiz_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quiz_id         uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_number integer NOT NULL DEFAULT 0,
  question_text   text NOT NULL,
  options         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {"A": "...", "B": "...", ...}
  eadb_id         uuid UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tqq_quiz_idx    ON public.training_quiz_questions (quiz_id, question_number);
CREATE INDEX IF NOT EXISTS tqq_company_idx ON public.training_quiz_questions (company_id);

-- Answer keys: RLS on, no policies, no client grants. Only SECURITY DEFINER RPCs
-- below and the service role can read them.
CREATE TABLE IF NOT EXISTS public.training_quiz_answer_keys (
  question_id    uuid PRIMARY KEY REFERENCES public.training_quiz_questions(id) ON DELETE CASCADE,
  correct_answer text NOT NULL,
  explanation    text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Company consistency (child rows must use the parent's company) ─────────
CREATE OR REPLACE FUNCTION public.training_check_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_parent uuid;
BEGIN
  IF TG_TABLE_NAME = 'course_modules' THEN
    SELECT company_id INTO v_parent FROM public.courses WHERE id = NEW.course_id;
    IF NOT EXISTS (SELECT 1 FROM public.training_modules m WHERE m.id = NEW.module_id AND m.company_id = NEW.company_id) THEN
      RAISE EXCEPTION 'module belongs to another company' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'course_completion_requirements' THEN
    SELECT company_id INTO v_parent FROM public.courses WHERE id = NEW.course_id;
  ELSIF TG_TABLE_NAME IN ('training_class_enrollments','training_class_attendance') THEN
    SELECT company_id INTO v_parent FROM public.training_classes WHERE id = NEW.class_id;
  ELSIF TG_TABLE_NAME = 'training_quiz_questions' THEN
    SELECT company_id INTO v_parent FROM public.quizzes WHERE id = NEW.quiz_id;
  ELSIF TG_TABLE_NAME = 'training_classes' THEN
    IF NEW.course_id IS NULL THEN RETURN NEW; END IF;
    SELECT company_id INTO v_parent FROM public.courses WHERE id = NEW.course_id;
  END IF;
  IF v_parent IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'company_id must match the parent row' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.training_check_company() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['course_modules','course_completion_requirements','training_classes',
                           'training_class_enrollments','training_class_attendance','training_quiz_questions']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_company_check', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.training_check_company()', t || '_company_check', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['state_laws','training_classes','training_quiz_questions','training_quiz_answer_keys']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.training_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;

-- ── RLS ────────────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['course_modules','course_completion_requirements','certificate_prerequisites','state_laws',
                           'training_classes','training_class_enrollments','training_class_attendance',
                           'training_quiz_questions','training_quiz_answer_keys']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;

  -- Content tables: members (staff+) read; managers/instructors/admins/owners write.
  FOREACH t IN ARRAY ARRAY['course_modules','course_completion_requirements','certificate_prerequisites',
                           'state_laws','training_classes','training_quiz_questions']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.training_can_view(company_id))', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.training_can_manage(company_id))', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.training_can_manage(company_id)) WITH CHECK (public.training_can_manage(company_id))', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.training_can_manage(company_id))', t || '_delete', t);
  END LOOP;

  -- Rosters / attendance: managers see and edit all; a learner sees only their own rows.
  FOREACH t IN ARRAY ARRAY['training_class_enrollments','training_class_attendance']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.training_can_manage(company_id) OR (user_id = (SELECT public.get_my_user_id()) AND public.training_can_view(company_id)))', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.training_can_manage(company_id))', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.training_can_manage(company_id)) WITH CHECK (public.training_can_manage(company_id))', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.training_can_manage(company_id))', t || '_delete', t);
  END LOOP;
END $$;

-- Answer keys: no policies, and no table privileges for client roles at all.
REVOKE ALL ON public.training_quiz_answer_keys FROM anon, authenticated;

-- ── Quiz RPCs ──────────────────────────────────────────────────────────────
-- Questions without answers (members). Same shape as EADB get_assessment_quiz.
CREATE OR REPLACE FUNCTION public.get_training_quiz(p_quiz_id uuid)
RETURNS TABLE (id uuid, question_number integer, question_text text, options jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT q.id, q.question_number, q.question_text, q.options
  FROM public.training_quiz_questions q
  WHERE q.quiz_id = p_quiz_id
  ORDER BY q.question_number
$$;

-- Grade on the server, record the attempt for the caller, return per-question results.
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

-- Instructors and above: read / write answer keys.
CREATE OR REPLACE FUNCTION public.admin_get_training_quiz_answers(p_quiz_id uuid)
RETURNS TABLE (question_id uuid, correct_answer text, explanation text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quizzes z WHERE z.id = p_quiz_id AND public.training_can_manage(z.company_id)) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT k.question_id, k.correct_answer, k.explanation
    FROM public.training_quiz_answer_keys k
    JOIN public.training_quiz_questions q ON q.id = k.question_id
    WHERE q.quiz_id = p_quiz_id
    ORDER BY q.question_number;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_training_quiz_answer(p_question_id uuid, p_correct_answer text, p_explanation text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.training_quiz_questions q WHERE q.id = p_question_id AND public.training_can_manage(q.company_id)) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_correct_answer IS NULL OR length(p_correct_answer) = 0 OR length(p_correct_answer) > 20 THEN
    RAISE EXCEPTION 'bad answer' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.training_quiz_answer_keys (question_id, correct_answer, explanation)
  VALUES (p_question_id, p_correct_answer, p_explanation)
  ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer, explanation = EXCLUDED.explanation;
END $$;

REVOKE ALL ON FUNCTION public.get_training_quiz(uuid), public.grade_training_quiz(uuid, jsonb, text),
  public.admin_get_training_quiz_answers(uuid), public.admin_set_training_quiz_answer(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_training_quiz(uuid), public.grade_training_quiz(uuid, jsonb, text),
  public.admin_get_training_quiz_answers(uuid), public.admin_set_training_quiz_answer(uuid, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.training_touch_updated_at() FROM PUBLIC, anon, authenticated;

COMMIT;
