-- ============================================================
-- RUN THIS ON THE ** LEGACY ** SUPABASE (vaagvairvwmgyzsmymhs)
-- Adds RLS policies so Overwatch (via anon key) can perform
-- instructor CRUD operations through the legacy bridge.
-- ============================================================

-- ─── Instructors ─────────────────────────────────────────────
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;

-- Allow reading instructors
CREATE POLICY "anon_select_instructors"
  ON instructors FOR SELECT
  TO anon
  USING (true);

-- Allow creating instructor records from Overwatch
CREATE POLICY "anon_insert_instructors"
  ON instructors FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow updating instructor records
CREATE POLICY "anon_update_instructors"
  ON instructors FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- ─── Courses ─────────────────────────────────────────────────
-- SELECT likely already works; add INSERT/UPDATE for instructor editing
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_certificates' AND tablename = 'certificates') THEN
    CREATE POLICY "anon_insert_certificates"
      ON certificates FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;
