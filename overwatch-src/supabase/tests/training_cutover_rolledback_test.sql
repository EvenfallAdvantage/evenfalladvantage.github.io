-- Rolled-back test for 20261017233000_training_cutover.sql and
-- 20261017233100_remove_duplicate_empty_courses.sql (OverwatchDB).
-- Run as ONE request: [setup block] + both migration bodies (without BEGIN/COMMIT) + [test block].
-- The final RAISE aborts the whole implicit transaction, so nothing persists.
-- (scripts: build with tests/build_training_cutover_test.sh)

-- ── setup (before the migration): an inline quiz with answers in quizzes.questions ──
DO $s$
BEGIN
  INSERT INTO public.quizzes (id, company_id, title, updated_at, question_source, questions, passing_score, max_attempts)
  VALUES ('00000000-0000-4000-8000-00000000a001', '0f03bc15-aa8d-4bd3-956f-90bdd7904091', 'ZZTEST inline drill', now(), 'inline',
    '[{"id":"x1","text":"Inline Q1?","options":["a","b","c"],"correctIndex":0},{"id":"x2","text":"Inline Q2?","options":["a","b"],"correctIndex":1}]', 70, 1);
END $s$;

--@@MIGRATIONS@@

DO $t$
DECLARE
  ef  uuid := '0f03bc15-aa8d-4bd3-956f-90bdd7904091';
  s_admin text := '6054e6d0-4bc7-4c7b-a50b-7a4eed4a4967';
  s_instr text := 'f2fc53f4-d752-498c-b4f3-2465695dfcc4';
  s_staff text := '3689872f-7a38-455c-8d15-4087ed77ffe0';
  s_out   text := 'afaa0965-ebe0-4a9d-94e4-be3553f8eab0';
  s_mgr   text := '6d44cf9e-2ed3-4453-b5c6-ef5fa6dfc37d';
  u_instr uuid; u_admin uuid; cl2 uuid := gen_random_uuid(); cl3 uuid := gen_random_uuid();
  u_staff uuid; inline_q uuid := '00000000-0000-4000-8000-00000000a001';
  qz uuid := gen_random_uuid(); qz0 uuid := gen_random_uuid(); c1 uuid := gen_random_uuid(); m1 uuid;
  cl uuid := gen_random_uuid(); ids_before uuid[]; ids_after uuid[];
  r text[] := '{}'; n int; j jsonb; v text; st text; det text; id1 uuid; id2 uuid;
BEGIN
  SELECT id INTO u_staff FROM public.users WHERE supabase_id = s_staff;
  SELECT id INTO u_instr FROM public.users WHERE supabase_id = s_instr;
  SELECT id INTO u_admin FROM public.users WHERE supabase_id = s_admin;

  -- 1. inline quiz converted
  SELECT count(*) INTO n FROM public.training_quiz_questions WHERE quiz_id = inline_q; r := array_append(r, (('inline_moved_q=' || n))::text);
  SELECT string_agg(k.correct_answer, '' ORDER BY q.question_number) INTO v FROM public.training_quiz_questions q
    JOIN public.training_quiz_answer_keys k ON k.question_id = q.id WHERE q.quiz_id = inline_q; r := array_append(r, (('inline_keys=' || v))::text);
  SELECT question_source || '/' || questions::text INTO v FROM public.quizzes WHERE id = inline_q; r := array_append(r, (('inline_now=' || v))::text);
  SELECT count(*) INTO n FROM public.quizzes WHERE question_source <> 'server' OR questions <> '[]'::jsonb; r := array_append(r, (('any_inline_left=' || n))::text);
  BEGIN UPDATE public.quizzes SET questions = '[{"correctIndex":0}]' WHERE id = inline_q; r := array_append(r, ('inline_write=ALLOWED'::text)::text);
  EXCEPTION WHEN check_violation THEN r := array_append(r, ('inline_write=blocked'::text)::text); END;

  -- 7. duplicate shells removed, EADB copies kept
  SELECT count(*) INTO n FROM public.courses WHERE id IN ('6d1bfb20-5abe-4e53-a2c3-d06262fe5570','81e8c6ba-74a3-4cd7-811d-273e641c54f4','f1d4872f-4ae1-4dc6-bda9-a33b8db1b62a');
  r := array_append(r, (('dup_left=' || n))::text);
  SELECT count(*) INTO n FROM public.courses WHERE company_id = ef AND eadb_id IS NOT NULL; r := array_append(r, (('eadb_courses=' || n))::text);

  -- fixtures (owner)
  INSERT INTO public.quizzes (id, company_id, title, updated_at, passing_score, max_attempts) VALUES
    (qz, ef, 'ZZTEST server quiz', now(), 50, 2), (qz0, ef, 'ZZTEST ack drill', now(), 70, 0);
  INSERT INTO public.courses (id, company_id, title, updated_at) VALUES (c1, ef, 'ZZTEST course', now());
  -- cl: taught by the instructor; cl2: taught by the admin. Staff is enrolled in cl only.
  INSERT INTO public.training_classes (id, company_id, class_name, scheduled_date, instructor_user_id) VALUES
    (cl, ef, 'ZZTEST class (instructor)', current_date, u_instr), (cl2, ef, 'ZZTEST class (admin)', current_date, u_admin);
  INSERT INTO public.training_class_enrollments (company_id, class_id, user_id) VALUES (ef, cl, u_staff), (ef, cl2, u_staff);
  INSERT INTO public.training_class_attendance (company_id, class_id, user_id, attendance_status) VALUES (ef, cl2, u_staff, 'present');

  -- ── instructor ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', s_instr, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT public.admin_save_training_quiz_questions(qz, '[{"question":"2+2?","options":["3","4"],"correct":"B","explanation":"math"},{"question":"Sky?","options":["blue","green","red"],"correct":"A"}]') INTO n;
  r := array_append(r, (('instr_save_q=' || n))::text);
  SELECT array_agg(id ORDER BY question_number) INTO ids_before FROM public.training_quiz_questions WHERE quiz_id = qz;
  PERFORM public.admin_save_training_quiz_questions(qz, '[{"question":"2+2 = ?","options":["3","4"],"correct":"B"},{"question":"Sky?","options":["blue","green"],"correct":"A"}]');
  SELECT array_agg(id ORDER BY question_number) INTO ids_after FROM public.training_quiz_questions WHERE quiz_id = qz;
  r := array_append(r, (('save_keeps_ids=' || (ids_before = ids_after)::text))::text);
  BEGIN PERFORM public.admin_save_training_quiz_questions(qz, '[{"question":"x","options":["a","b"],"correct":"C"}]'); r := array_append(r, ('bad_correct=ALLOWED'::text)::text);
  EXCEPTION WHEN invalid_parameter_value THEN r := array_append(r, (('bad_correct=' || SQLERRM))::text); END;
  INSERT INTO public.training_modules (company_id, module_code, module_name) VALUES (ef, 'ZZTESTM', 'ZZTEST module') RETURNING id INTO m1;
  INSERT INTO public.module_slides (module_id, title) VALUES (m1, 'ZZ slide'); r := array_append(r, ('instr_module_slide=ok'::text)::text);
  UPDATE public.courses SET description = 'x' WHERE id = c1; GET DIAGNOSTICS n = ROW_COUNT; r := array_append(r, (('instr_course_update=' || n))::text);
  SELECT count(*) INTO n FROM public.training_list_learners(ef) WHERE user_id = u_staff; r := array_append(r, (('instr_learners_has_staff=' || n))::text);
  SELECT count(*) INTO n FROM public.training_list_learners(ef); r := array_append(r, (('learners_total=' || n))::text);
  SELECT count(*) INTO n FROM public.training_class_roster(cl); r := array_append(r, (('roster=' || n))::text);
  -- class scoping: own classes only
  SELECT count(*) INTO n FROM public.training_classes WHERE id IN (cl, cl2); r := array_append(r, (('instr_sees_classes=' || n))::text);
  SELECT count(*) INTO n FROM public.training_classes WHERE company_id = ef AND instructor_user_id IS DISTINCT FROM u_instr; r := array_append(r, (('instr_sees_others_classes=' || n))::text);
  BEGIN PERFORM public.training_class_roster(cl2); r := array_append(r, ('instr_roster_other=ALLOWED'::text)::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('instr_roster_other=denied'::text)::text); END;
  SELECT count(*) INTO n FROM public.training_class_enrollments WHERE class_id = cl2; r := array_append(r, (('instr_other_enrol_rows=' || n))::text);
  SELECT count(*) INTO n FROM public.training_class_attendance WHERE class_id = cl2; r := array_append(r, (('instr_other_attend_rows=' || n))::text);
  BEGIN INSERT INTO public.training_class_enrollments (company_id, class_id, user_id) VALUES (ef, cl2, u_instr); r := array_append(r, ('instr_enrol_other=ALLOWED'::text)::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('instr_enrol_other=denied'::text)::text); END;
  BEGIN INSERT INTO public.training_class_attendance (company_id, class_id, user_id, attendance_status) VALUES (ef, cl2, u_staff, 'absent'); r := array_append(r, ('instr_attend_other=ALLOWED'::text)::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('instr_attend_other=denied'::text)::text); END;
  INSERT INTO public.training_class_attendance (company_id, class_id, user_id, attendance_status) VALUES (ef, cl, u_staff, 'late');
  r := array_append(r, ('instr_attend_own=ok'::text)::text);
  UPDATE public.training_classes SET location = 'x' WHERE id = cl2; GET DIAGNOSTICS n = ROW_COUNT; r := array_append(r, (('instr_update_other_rows=' || n))::text);
  BEGIN UPDATE public.training_classes SET instructor_user_id = u_admin WHERE id = cl; r := array_append(r, ('instr_handoff=ALLOWED'::text)::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('instr_handoff=denied'::text)::text); END;
  BEGIN INSERT INTO public.training_classes (company_id, class_name, instructor_user_id) VALUES (ef, 'ZZ for admin', u_admin); r := array_append(r, ('instr_create_for_other=ALLOWED'::text)::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('instr_create_for_other=denied'::text)::text); END;
  INSERT INTO public.training_classes (id, company_id, class_name, instructor_user_id) VALUES (cl3, ef, 'ZZ own', u_instr);
  r := array_append(r, ('instr_create_own=ok'::text)::text);
  RESET ROLE;

  -- ── manager: same "own classes only" rule ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', s_mgr, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.training_classes WHERE id IN (cl, cl2, cl3); r := array_append(r, (('mgr_sees_classes=' || n))::text);
  BEGIN PERFORM public.training_class_roster(cl); r := array_append(r, ('mgr_roster=ALLOWED'::text)::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('mgr_roster=denied'::text)::text); END;
  RESET ROLE;

  -- ── admin: all classes and rosters ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', s_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.training_classes WHERE id IN (cl, cl2, cl3); r := array_append(r, (('admin_sees_classes=' || n))::text);
  SELECT count(*) INTO n FROM public.training_class_roster(cl); r := array_append(r, (('admin_roster_instr_class=' || n))::text);
  UPDATE public.training_classes SET location = 'y' WHERE id = cl; GET DIAGNOSTICS n = ROW_COUNT; r := array_append(r, (('admin_update_any_rows=' || n))::text);
  RESET ROLE;

  -- ── staff (learner) ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', s_staff, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN INSERT INTO public.quizzes (id, company_id, title, updated_at) VALUES (gen_random_uuid(), ef, 'ZZ staff quiz', now()); r := array_append(r, ('staff_create_quiz=ALLOWED'::text)::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('staff_create_quiz=denied'::text)::text); END;
  UPDATE public.quizzes SET passing_score = 0 WHERE id = qz; GET DIAGNOSTICS n = ROW_COUNT; r := array_append(r, (('staff_update_quiz_rows=' || n))::text);
  UPDATE public.courses SET price = 0 WHERE id = c1; GET DIAGNOSTICS n = ROW_COUNT; r := array_append(r, (('staff_update_course_rows=' || n))::text);
  BEGIN INSERT INTO public.quiz_attempts (id, quiz_id, user_id, score, passed) VALUES (gen_random_uuid(), qz, u_staff, 100, true); r := array_append(r, ('staff_fake_attempt=ALLOWED'::text)::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('staff_fake_attempt=denied'::text)::text); END;
  SELECT count(*) INTO n FROM public.assessment_questions; r := array_append(r, (('staff_bank_rows=' || n))::text);
  SELECT count(*) INTO n FROM public.training_classes WHERE id IN (cl, cl2, cl3); r := array_append(r, (('staff_sees_classes=' || n))::text);
  SELECT count(*) INTO n FROM public.training_class_enrollments WHERE class_id IN (cl, cl2); r := array_append(r, (('staff_own_enrol_rows=' || n))::text);
  BEGIN PERFORM public.training_class_roster(cl); r := array_append(r, ('staff_roster=ALLOWED'::text)::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('staff_roster=denied'::text)::text); END;
  BEGIN SELECT count(*) INTO n FROM public.training_quiz_answer_keys; r := array_append(r, ('staff_keys=ALLOWED'::text)::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('staff_keys=denied'::text)::text); END;
  SELECT id INTO id1 FROM public.training_quiz_questions WHERE quiz_id = qz AND question_number = 1;
  SELECT id INTO id2 FROM public.training_quiz_questions WHERE quiz_id = qz AND question_number = 2;
  j := public.grade_training_quiz(qz, jsonb_build_object(id1::text, 'B', id2::text, 'C'));
  r := array_append(r, (('grade=' || (j->>'score') || '/' || (j->>'passed')))::text);
  j := public.grade_training_quiz(qz0, '{}'::jsonb); r := array_append(r, (('ack=' || (j->>'score') || '/' || (j->>'passed')))::text);
  BEGIN PERFORM public.grade_training_quiz(gen_random_uuid(), '{}'::jsonb); r := array_append(r, ('missing=NO_ERROR'::text)::text);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS st = RETURNED_SQLSTATE, det = PG_EXCEPTION_DETAIL; r := array_append(r, (('missing=' || st || ' ' || det))::text); END;
  PERFORM public.grade_training_quiz(qz, '{}'::jsonb);
  BEGIN PERFORM public.grade_training_quiz(qz, '{}'::jsonb); r := array_append(r, ('third_attempt=ALLOWED'::text)::text);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS st = RETURNED_SQLSTATE, det = PG_EXCEPTION_DETAIL; r := array_append(r, (('third_attempt=' || st || ' ' || det))::text); END;
  BEGIN PERFORM public.training_list_learners(ef); r := array_append(r, ('staff_learners=ALLOWED'::text)::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('staff_learners=denied'::text)::text); END;
  BEGIN PERFORM public.training_issue_certificate(ef, u_staff, 'Self cert'); r := array_append(r, ('staff_issue=ALLOWED'::text)::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('staff_issue=denied'::text)::text); END;
  RESET ROLE;

  -- ── outsider: same 404 as a missing quiz ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', s_out, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.grade_training_quiz(qz, '{}'::jsonb); r := array_append(r, ('outsider_grade=ALLOWED'::text)::text);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS st = RETURNED_SQLSTATE, det = PG_EXCEPTION_DETAIL; r := array_append(r, (('outsider_grade=' || st || ' ' || det))::text); END;
  SELECT count(*) INTO n FROM public.courses WHERE company_id = ef; r := array_append(r, (('outsider_courses=' || n))::text);
  RESET ROLE;

  -- ── instructor again: sees the staff attempts, issues a cert, delete guards ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', s_instr, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.quiz_attempts WHERE quiz_id = qz; r := array_append(r, (('instr_sees_attempts=' || n))::text);
  SELECT count(*) INTO n FROM public.quiz_attempts WHERE eadb_id IS NOT NULL; r := array_append(r, (('instr_sees_eadb_attempts=' || n))::text);
  SELECT count(*) INTO n FROM public.student_module_progress WHERE eadb_id IS NOT NULL; r := array_append(r, (('instr_sees_eadb_progress=' || n))::text);
  SELECT count(*) INTO n FROM public.course_enrollments WHERE eadb_id IS NOT NULL; r := array_append(r, (('instr_sees_eadb_enrol=' || n))::text);
  PERFORM public.training_issue_certificate(ef, u_staff, 'ZZTEST completion', 'course_completion', 'CA');
  RESET ROLE;
  SELECT count(*) INTO n FROM public.certifications WHERE user_id = u_staff AND cert_type = 'ZZTEST completion' AND certificate_number LIKE 'EA-%' AND verification_code LIKE 'V-%';
  r := array_append(r, (('cert_issued=' || n))::text);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.training_delete_quiz(qz); r := array_append(r, ('delete_used_quiz=ALLOWED'::text)::text);
  EXCEPTION WHEN foreign_key_violation THEN r := array_append(r, (('delete_used_quiz=' || SQLERRM))::text); END;
  PERFORM public.training_delete_quiz(inline_q); SELECT count(*) INTO n FROM public.quizzes WHERE id = inline_q; r := array_append(r, (('delete_unused_quiz_left=' || n))::text);
  BEGIN PERFORM public.training_delete_course('ccaeb538-fd61-4684-8920-f7f49ec7be30'); r := array_append(r, ('delete_used_course=ALLOWED'::text)::text);
  EXCEPTION WHEN foreign_key_violation THEN r := array_append(r, (('delete_used_course=' || SQLERRM))::text); END;
  RESET ROLE;

  RAISE EXCEPTION 'TEST_RESULT %', array_to_string(r, ' | ');
END $t$;
