-- ============================================================
-- RUN THIS ON THE ** LEGACY ** SUPABASE (vaagvairvwmgyzsmymhs)
-- Adds RLS policies so Overwatch (via anon key) can perform
-- instructor CRUD operations through the legacy bridge.
-- ============================================================

-- ─── Instructors ─────────────────────────────────────────────
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_instructors' AND tablename = 'instructors') THEN
    CREATE POLICY "anon_select_instructors"
      ON instructors FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_instructors' AND tablename = 'instructors') THEN
    CREATE POLICY "anon_insert_instructors"
      ON instructors FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_update_instructors' AND tablename = 'instructors') THEN
    CREATE POLICY "anon_update_instructors"
      ON instructors FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ─── Courses ─────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_courses' AND tablename = 'courses') THEN
    CREATE POLICY "anon_select_courses" ON courses FOR SELECT TO anon USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_courses' AND tablename = 'courses') THEN
    CREATE POLICY "anon_insert_courses"
      ON courses FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_update_courses' AND tablename = 'courses') THEN
    CREATE POLICY "anon_update_courses"
      ON courses FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ─── Training Modules ────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_training_modules' AND tablename = 'training_modules') THEN
    CREATE POLICY "anon_select_training_modules" ON training_modules FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_training_modules' AND tablename = 'training_modules') THEN
    CREATE POLICY "anon_insert_training_modules"
      ON training_modules FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_update_training_modules' AND tablename = 'training_modules') THEN
    CREATE POLICY "anon_update_training_modules"
      ON training_modules FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ─── Module Slides ───────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_module_slides' AND tablename = 'module_slides') THEN
    CREATE POLICY "anon_select_module_slides" ON module_slides FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_module_slides' AND tablename = 'module_slides') THEN
    CREATE POLICY "anon_insert_module_slides"
      ON module_slides FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_update_module_slides' AND tablename = 'module_slides') THEN
    CREATE POLICY "anon_update_module_slides"
      ON module_slides FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_delete_module_slides' AND tablename = 'module_slides') THEN
    CREATE POLICY "anon_delete_module_slides"
      ON module_slides FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;

-- ─── Assessments ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_assessments' AND tablename = 'assessments') THEN
    CREATE POLICY "anon_select_assessments" ON assessments FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_assessments' AND tablename = 'assessments') THEN
    CREATE POLICY "anon_insert_assessments"
      ON assessments FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_update_assessments' AND tablename = 'assessments') THEN
    CREATE POLICY "anon_update_assessments"
      ON assessments FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ─── Scheduled Classes ───────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_scheduled_classes' AND tablename = 'scheduled_classes') THEN
    CREATE POLICY "anon_select_scheduled_classes" ON scheduled_classes FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_scheduled_classes' AND tablename = 'scheduled_classes') THEN
    CREATE POLICY "anon_insert_scheduled_classes"
      ON scheduled_classes FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_update_scheduled_classes' AND tablename = 'scheduled_classes') THEN
    CREATE POLICY "anon_update_scheduled_classes"
      ON scheduled_classes FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ─── Class Enrollments ──────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_class_enrollments' AND tablename = 'class_enrollments') THEN
    CREATE POLICY "anon_select_class_enrollments" ON class_enrollments FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_class_enrollments' AND tablename = 'class_enrollments') THEN
    CREATE POLICY "anon_insert_class_enrollments"
      ON class_enrollments FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_delete_class_enrollments' AND tablename = 'class_enrollments') THEN
    CREATE POLICY "anon_delete_class_enrollments"
      ON class_enrollments FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;

-- ─── Class Attendance ────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_class_attendance' AND tablename = 'class_attendance') THEN
    CREATE POLICY "anon_select_class_attendance" ON class_attendance FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_class_attendance' AND tablename = 'class_attendance') THEN
    CREATE POLICY "anon_insert_class_attendance"
      ON class_attendance FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_update_class_attendance' AND tablename = 'class_attendance') THEN
    CREATE POLICY "anon_update_class_attendance"
      ON class_attendance FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ─── Certificates ────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_certificates' AND tablename = 'certificates') THEN
    CREATE POLICY "anon_select_certificates" ON certificates FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_certificates' AND tablename = 'certificates') THEN
    CREATE POLICY "anon_insert_certificates"
      ON certificates FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

-- ─── Additional Read Tables ──────────────────────────────────
-- Students (needed for student listing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_students' AND tablename = 'students') THEN
    CREATE POLICY "anon_select_students" ON students FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- Student module progress
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_student_module_progress' AND tablename = 'student_module_progress') THEN
    CREATE POLICY "anon_select_student_module_progress" ON student_module_progress FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- Student course enrollments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_student_course_enrollments' AND tablename = 'student_course_enrollments') THEN
    CREATE POLICY "anon_select_student_course_enrollments" ON student_course_enrollments FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- Course modules (join table)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_course_modules' AND tablename = 'course_modules') THEN
    CREATE POLICY "anon_select_course_modules" ON course_modules FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- Assessment results
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_assessment_results' AND tablename = 'assessment_results') THEN
    CREATE POLICY "anon_select_assessment_results" ON assessment_results FOR SELECT TO anon USING (true);
  END IF;
END $$;
