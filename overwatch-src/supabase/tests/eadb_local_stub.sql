-- LOCAL-ONLY minimal stub of the legacy EADB tables/policies touched by
-- eadb/20261006120500_eadb_remove_anon_writes.sql (syntax + rollback check).
-- Never run against a Supabase project.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE TABLE public.administrators (user_id uuid);
CREATE TABLE public.instructors (id uuid PRIMARY KEY, is_active boolean DEFAULT true);
CREATE TABLE public.students (id uuid PRIMARY KEY, email text NOT NULL UNIQUE, first_name text NOT NULL, last_name text NOT NULL);
CREATE TABLE public.courses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text);
CREATE TABLE public.training_modules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text);
CREATE TABLE public.module_slides (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text);
CREATE TABLE public.assessments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text);
CREATE TABLE public.scheduled_classes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), instructor_id uuid);
CREATE TABLE public.class_enrollments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid);
CREATE TABLE public.class_attendance (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), class_id uuid);
CREATE TABLE public.certificates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), issued_by uuid);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['administrators','instructors','students','courses','training_modules','module_slides','assessments','scheduled_classes','class_enrollments','class_attendance','certificates'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)', t || '_read', t);
  END LOOP;
END $$;
CREATE POLICY anon_insert_assessments ON public.assessments AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_assessments ON public.assessments AS PERMISSIVE FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_insert_certificates ON public.certificates AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_insert_class_attendance ON public.class_attendance AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_class_attendance ON public.class_attendance AS PERMISSIVE FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_class_enrollments ON public.class_enrollments AS PERMISSIVE FOR DELETE TO anon USING (true);
CREATE POLICY anon_insert_class_enrollments ON public.class_enrollments AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_insert_courses ON public.courses AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_courses ON public.courses AS PERMISSIVE FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_insert_instructors ON public.instructors AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_instructors ON public.instructors AS PERMISSIVE FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_delete_module_slides ON public.module_slides AS PERMISSIVE FOR DELETE TO anon USING (true);
CREATE POLICY anon_insert_module_slides ON public.module_slides AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_module_slides ON public.module_slides AS PERMISSIVE FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_insert_scheduled_classes ON public.scheduled_classes AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_scheduled_classes ON public.scheduled_classes AS PERMISSIVE FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable insert for anon and authenticated" ON public.students AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY students_anon_insert ON public.students AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY students_anon_update ON public.students AS PERMISSIVE FOR UPDATE TO anon USING (true);
CREATE POLICY anon_insert_training_modules ON public.training_modules AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY anon_update_training_modules ON public.training_modules AS PERMISSIVE FOR UPDATE TO anon USING (true) WITH CHECK (true);
