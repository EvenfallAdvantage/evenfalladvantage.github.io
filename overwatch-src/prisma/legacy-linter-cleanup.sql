-- ============================================================
-- RUN THIS ON THE ** LEGACY ** SUPABASE (vaagvairvwmgyzsmymhs)
-- Fixes linter errors and warnings:
--   - Enable RLS on 3 unprotected tables
--   - Set search_path on 13 functions
--
-- NOTE: "RLS Policy Always True" warnings are INTENTIONAL —
--   Overwatch bridge needs anon write access to those tables.
-- NOTE: "Leaked Password Protection" is a dashboard setting —
--   go to Auth > Settings > enable "Leaked password protection"
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 1. ENABLE RLS ON UNPROTECTED TABLES
-- ═══════════════════════════════════════════════════════════

-- student_skills
ALTER TABLE student_skills ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_student_skills' AND tablename = 'student_skills') THEN
    CREATE POLICY "anon_select_student_skills" ON student_skills FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_student_skills' AND tablename = 'student_skills') THEN
    CREATE POLICY "authenticated_select_student_skills" ON student_skills FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_insert_student_skills' AND tablename = 'student_skills') THEN
    CREATE POLICY "authenticated_insert_student_skills" ON student_skills FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_update_student_skills' AND tablename = 'student_skills') THEN
    CREATE POLICY "authenticated_update_student_skills" ON student_skills FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- skills
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_skills' AND tablename = 'skills') THEN
    CREATE POLICY "anon_select_skills" ON skills FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_skills' AND tablename = 'skills') THEN
    CREATE POLICY "authenticated_select_skills" ON skills FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_insert_skills' AND tablename = 'skills') THEN
    CREATE POLICY "authenticated_insert_skills" ON skills FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- activity_log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_select_activity_log' AND tablename = 'activity_log') THEN
    CREATE POLICY "anon_select_activity_log" ON activity_log FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_select_activity_log' AND tablename = 'activity_log') THEN
    CREATE POLICY "authenticated_select_activity_log" ON activity_log FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_insert_activity_log' AND tablename = 'activity_log') THEN
    CREATE POLICY "anon_insert_activity_log" ON activity_log FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_insert_activity_log' AND tablename = 'activity_log') THEN
    CREATE POLICY "authenticated_insert_activity_log" ON activity_log FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 2. FIX MUTABLE SEARCH_PATH ON FUNCTIONS
-- ═══════════════════════════════════════════════════════════

-- update_courses_updated_at
CREATE OR REPLACE FUNCTION public.update_courses_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- update_enrollments_updated_at
CREATE OR REPLACE FUNCTION public.update_enrollments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- update_payments_updated_at
CREATE OR REPLACE FUNCTION public.update_payments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- update_updated_at_column (generic)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- update_thread_timestamp
CREATE OR REPLACE FUNCTION public.update_thread_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

-- generate_certificate_number
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.certificate_number := 'CERT-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8);
  RETURN NEW;
END;
$$;

-- update_course_completion_percentage
CREATE OR REPLACE FUNCTION public.update_course_completion_percentage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  total_modules int;
  completed_modules int;
  enrollment_record record;
BEGIN
  FOR enrollment_record IN
    SELECT sce.id, sce.course_id, sce.student_id
    FROM student_course_enrollments sce
    WHERE sce.student_id = NEW.student_id
  LOOP
    SELECT count(*) INTO total_modules
    FROM course_modules cm
    WHERE cm.course_id = enrollment_record.course_id;

    SELECT count(*) INTO completed_modules
    FROM student_module_progress smp
    JOIN course_modules cm ON cm.module_id = smp.module_id AND cm.course_id = enrollment_record.course_id
    WHERE smp.student_id = NEW.student_id AND smp.status = 'completed';

    IF total_modules > 0 THEN
      UPDATE student_course_enrollments
      SET completion_percentage = (completed_modules::numeric / total_modules::numeric) * 100
      WHERE id = enrollment_record.id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- get_crime_data_with_fallback
CREATE OR REPLACE FUNCTION public.get_crime_data_with_fallback(
  p_lat double precision,
  p_lon double precision,
  p_radius_miles double precision DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  state text,
  city text,
  latitude double precision,
  longitude double precision,
  crime_type text,
  crime_count integer,
  year integer,
  source text,
  distance_miles double precision
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cd.id, cd.state, cd.city, cd.latitude, cd.longitude,
    cd.crime_type, cd.crime_count, cd.year, cd.source,
    (3959 * acos(
      cos(radians(p_lat)) * cos(radians(cd.latitude)) *
      cos(radians(cd.longitude) - radians(p_lon)) +
      sin(radians(p_lat)) * sin(radians(cd.latitude))
    )) AS distance_miles
  FROM crime_data cd
  WHERE (3959 * acos(
      cos(radians(p_lat)) * cos(radians(cd.latitude)) *
      cos(radians(cd.longitude) - radians(p_lon)) +
      sin(radians(p_lat)) * sin(radians(cd.latitude))
    )) <= p_radius_miles
  ORDER BY distance_miles;
END;
$$;

-- student_has_course_access
CREATE OR REPLACE FUNCTION public.student_has_course_access(p_student_id uuid, p_course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM student_course_enrollments
    WHERE student_id = p_student_id AND course_id = p_course_id AND status = 'active'
  );
END;
$$;

-- student_has_module_access
CREATE OR REPLACE FUNCTION public.student_has_module_access(p_student_id uuid, p_module_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM student_course_enrollments sce
    JOIN course_modules cm ON cm.course_id = sce.course_id
    WHERE sce.student_id = p_student_id AND cm.module_id = p_module_id AND sce.status = 'active'
  );
END;
$$;

-- handle_new_student
CREATE OR REPLACE FUNCTION public.handle_new_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO student_profiles (student_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- handle_new_client
CREATE OR REPLACE FUNCTION public.handle_new_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- is_admin
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM administrators WHERE auth_user_id = p_user_id AND is_active = true
  );
END;
$$;
