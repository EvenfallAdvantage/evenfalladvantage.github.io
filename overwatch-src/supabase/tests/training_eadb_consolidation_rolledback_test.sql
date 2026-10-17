-- Rolled-back test for 20261017184312_training_eadb_consolidation.sql (OverwatchDB).
-- Paste the migration body (without BEGIN/COMMIT) and then this block in ONE request;
-- the final RAISE aborts the whole implicit transaction, so nothing persists.
DO $t$
DECLARE
  ef  uuid := '0f03bc15-aa8d-4bd3-956f-90bdd7904091';   -- Evenfall Advantage LLC
  oc  uuid := '4b9c9385-98c9-4e0e-895c-7f40c3c5ab71';   -- some other company
  s_admin text := '6054e6d0-4bc7-4c7b-a50b-7a4eed4a4967'; -- Icarus (admin)
  s_instr text := 'f2fc53f4-d752-498c-b4f3-2465695dfcc4';
  s_mgr   text := '6d44cf9e-2ed3-4453-b5c6-ef5fa6dfc37d';
  s_staff text := '3689872f-7a38-455c-8d15-4087ed77ffe0';
  s_out   text := 'afaa0965-ebe0-4a9d-94e4-be3553f8eab0';  -- not in Evenfall
  u_staff uuid; u_instr uuid;
  c1 uuid := gen_random_uuid(); c_other uuid := gen_random_uuid();
  m1 uuid := gen_random_uuid(); m_other uuid := gen_random_uuid();
  qz uuid := gen_random_uuid(); q1 uuid := gen_random_uuid(); q2 uuid := gen_random_uuid();
  cl uuid := gen_random_uuid();
  r text[] := '{}'; v text; n int; j jsonb;
BEGIN
  SELECT id INTO u_staff FROM public.users WHERE supabase_id = s_staff;
  SELECT id INTO u_instr FROM public.users WHERE supabase_id = s_instr;

  -- Fixtures (as owner, RLS bypassed)
  INSERT INTO public.courses (id, company_id, title, updated_at, eadb_id, course_code) VALUES
    (c1, ef, 'ZZTEST course', now(), gen_random_uuid(), 'ZZ1'), (c_other, oc, 'ZZTEST other co', now(), NULL, NULL);
  INSERT INTO public.training_modules (id, company_id, module_code, module_name, eadb_id, default_course_id) VALUES
    (m1, ef, 'ZZM1', 'ZZTEST module', gen_random_uuid(), c1), (m_other, oc, 'ZZM2', 'ZZTEST other', NULL, NULL);
  INSERT INTO public.course_modules (company_id, course_id, module_id, module_order) VALUES (ef, c1, m1, 1);
  INSERT INTO public.state_laws (company_id, state_code, state_name) VALUES (ef, 'ZZ', 'Test state');
  INSERT INTO public.quizzes (id, company_id, title, updated_at, question_source, max_attempts, passing_score)
    VALUES (qz, ef, 'ZZTEST quiz', now(), 'server', 2, 70);
  INSERT INTO public.training_quiz_questions (id, company_id, quiz_id, question_number, question_text, options) VALUES
    (q1, ef, qz, 1, 'Q1?', '{"A":"a","B":"b"}'), (q2, ef, qz, 2, 'Q2?', '{"A":"a","B":"b"}');
  INSERT INTO public.training_quiz_answer_keys (question_id, correct_answer, explanation) VALUES (q1, 'A', 'x'), (q2, 'B', 'y');
  INSERT INTO public.training_classes (id, company_id, course_id, instructor_user_id, class_name, scheduled_date)
    VALUES (cl, ef, c1, u_instr, 'ZZTEST class', current_date);
  INSERT INTO public.training_class_enrollments (company_id, class_id, user_id) VALUES (ef, cl, u_staff), (ef, cl, u_instr);
  INSERT INTO public.training_class_attendance (company_id, class_id, user_id, attendance_status) VALUES (ef, cl, u_staff, 'present');

  -- Trigger: company mismatch rejected even for the owner role
  BEGIN INSERT INTO public.course_modules (company_id, course_id, module_id) VALUES (ef, c_other, m1); r := array_append(r, ('mismatch=ALLOWED')::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('mismatch=denied')::text); END;
  BEGIN INSERT INTO public.training_class_enrollments (company_id, class_id, user_id) VALUES (oc, cl, u_staff); r := array_append(r, ('enr_mismatch=ALLOWED')::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('enr_mismatch=denied')::text); END;

  -- ── staff (learner) ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', s_staff, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.course_modules WHERE course_id = c1; r := array_append(r, (('staff_read_cm=' || n))::text);
  SELECT count(*) INTO n FROM public.state_laws WHERE state_code = 'ZZ'; r := array_append(r, (('staff_read_laws=' || n))::text);
  SELECT count(*) INTO n FROM public.training_class_enrollments WHERE class_id = cl; r := array_append(r, (('staff_enr_visible=' || n))::text);
  SELECT count(*) INTO n FROM public.training_class_attendance WHERE class_id = cl; r := array_append(r, (('staff_att_visible=' || n))::text);
  BEGIN INSERT INTO public.course_modules (company_id, course_id, module_id) VALUES (ef, c1, m1); r := array_append(r, ('staff_write_cm=ALLOWED')::text);
  EXCEPTION WHEN insufficient_privilege OR unique_violation THEN r := array_append(r, (('staff_write_cm=denied:' || SQLSTATE))::text); END;
  BEGIN UPDATE public.training_classes SET class_name = 'x' WHERE id = cl; GET DIAGNOSTICS n = ROW_COUNT; r := array_append(r, (('staff_update_class_rows=' || n))::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('staff_update_class=denied')::text); END;
  BEGIN SELECT count(*) INTO n FROM public.training_quiz_answer_keys; r := array_append(r, ('staff_read_keys=ALLOWED')::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('staff_read_keys=denied')::text); END;
  BEGIN PERFORM public.admin_get_training_quiz_answers(qz); r := array_append(r, ('staff_admin_get=ALLOWED')::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('staff_admin_get=denied')::text); END;
  BEGIN PERFORM public.admin_set_training_quiz_answer(q1, 'B'); r := array_append(r, ('staff_admin_set=ALLOWED')::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('staff_admin_set=denied')::text); END;
  SELECT count(*), bool_and(to_jsonb(g) ? 'correct_answer') INTO n, v FROM public.get_training_quiz(qz) g;
  r := array_append(r, (('staff_get_quiz=' || n || ' has_answer_field=' || coalesce(v, 'f')))::text);
  j := public.grade_training_quiz(qz, jsonb_build_object(q1::text, 'a', q2::text, 'A'));
  r := array_append(r, (('grade1=' || (j->>'score') || '/' || (j->>'passed')))::text);
  j := public.grade_training_quiz(qz, jsonb_build_object(q1::text, 'A', q2::text, 'B'));
  r := array_append(r, (('grade2=' || (j->>'score') || '/' || (j->>'passed')))::text);
  BEGIN j := public.grade_training_quiz(qz, '{}'); r := array_append(r, ('grade3=ALLOWED')::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('grade3(max_attempts)=denied')::text); END;
  SELECT count(*) INTO n FROM public.quiz_attempts WHERE quiz_id = qz; r := array_append(r, (('staff_attempts_visible=' || n))::text);
  RESET ROLE;

  -- ── instructor ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', s_instr, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.training_class_enrollments WHERE class_id = cl; r := array_append(r, (('instr_enr_visible=' || n))::text);
  BEGIN INSERT INTO public.course_completion_requirements (company_id, course_id, requirement_type) VALUES (ef, c1, 'all_modules'); r := array_append(r, ('instr_write_ccr=ok')::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('instr_write_ccr=DENIED')::text); END;
  BEGIN UPDATE public.training_class_attendance SET attendance_status = 'late' WHERE class_id = cl; GET DIAGNOSTICS n = ROW_COUNT; r := array_append(r, (('instr_mark_att_rows=' || n))::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('instr_mark_att=DENIED')::text); END;
  SELECT count(*) INTO n FROM public.admin_get_training_quiz_answers(qz); r := array_append(r, (('instr_admin_get=' || n))::text);
  PERFORM public.admin_set_training_quiz_answer(q2, 'A', 'changed'); r := array_append(r, ('instr_admin_set=ok')::text);
  BEGIN SELECT count(*) INTO n FROM public.training_quiz_answer_keys; r := array_append(r, ('instr_read_keys_direct=ALLOWED')::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('instr_read_keys_direct=denied')::text); END;
  BEGIN INSERT INTO public.state_laws (company_id, state_code) VALUES (oc, 'ZY'); r := array_append(r, ('instr_write_othercompany=ALLOWED')::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('instr_write_othercompany=denied')::text); END;
  RESET ROLE;

  -- ── manager ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', s_mgr, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE public.state_laws SET notes = 'm' WHERE state_code = 'ZZ'; GET DIAGNOSTICS n = ROW_COUNT; r := array_append(r, (('mgr_update_laws_rows=' || n))::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('mgr_update_laws=DENIED')::text); END;
  RESET ROLE;

  -- ── admin (Icarus) ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', s_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN DELETE FROM public.training_class_enrollments WHERE class_id = cl AND user_id = u_instr; GET DIAGNOSTICS n = ROW_COUNT; r := array_append(r, (('admin_delete_enr_rows=' || n))::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('admin_delete_enr=DENIED')::text); END;
  RESET ROLE;

  -- ── outsider (other company) ──
  PERFORM set_config('request.jwt.claims', json_build_object('sub', s_out, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.course_modules WHERE course_id = c1; r := array_append(r, (('out_read_cm=' || n))::text);
  SELECT count(*) INTO n FROM public.training_classes WHERE id = cl; r := array_append(r, (('out_read_class=' || n))::text);
  SELECT count(*) INTO n FROM public.training_quiz_questions WHERE quiz_id = qz; r := array_append(r, (('out_read_questions=' || n))::text);
  SELECT count(*) INTO n FROM public.get_training_quiz(qz); r := array_append(r, (('out_get_quiz=' || n))::text);
  BEGIN j := public.grade_training_quiz(qz, '{}'); r := array_append(r, ('out_grade=ALLOWED')::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('out_grade=denied')::text); END;
  BEGIN PERFORM public.admin_get_training_quiz_answers(qz); r := array_append(r, ('out_admin_get=ALLOWED')::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('out_admin_get=denied')::text); END;
  RESET ROLE;

  -- ── anon ──
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  BEGIN SELECT count(*) INTO n FROM public.course_modules; r := array_append(r, (('anon_read_cm=ALLOWED:' || n))::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('anon_read_cm=denied')::text); END;
  BEGIN SELECT count(*) INTO n FROM public.training_classes; r := array_append(r, (('anon_read_classes=ALLOWED:' || n))::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('anon_read_classes=denied')::text); END;
  BEGIN PERFORM public.grade_training_quiz(qz, '{}'); r := array_append(r, ('anon_grade=ALLOWED')::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('anon_grade=denied')::text); END;
  BEGIN PERFORM public.training_can_view(ef); r := array_append(r, ('anon_helper=ALLOWED')::text);
  EXCEPTION WHEN insufficient_privilege THEN r := array_append(r, ('anon_helper=denied')::text); END;
  RESET ROLE;

  -- Existing inline quizzes untouched
  SELECT count(*) INTO n FROM public.quizzes WHERE question_source = 'inline' AND id <> qz; r := array_append(r, (('existing_inline_quizzes=' || n))::text);
  SELECT count(*) INTO n FROM public.courses WHERE eadb_id IS NULL AND id NOT IN (c1, c_other); r := array_append(r, (('existing_courses_untouched=' || n))::text);

  RAISE EXCEPTION 'ROLLED BACK OK | %', array_to_string(r, ' | ');
END $t$;
