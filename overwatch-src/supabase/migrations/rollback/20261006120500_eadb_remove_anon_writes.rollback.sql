-- =============================================================================
-- ROLLBACK for eadb/20261006120500_eadb_remove_anon_writes.sql
-- Target: LEGACY EADB (project vaagvairvwmgyzsmymhs) ONLY.
-- Recreates the exact policies read from pg_policies on 2026-10-06.
-- NOTE: this re-opens anonymous writes on all 10 tables.
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.module_slides') IS NULL
     OR to_regclass('public.administrators') IS NULL
     OR to_regclass('public.company_memberships') IS NOT NULL THEN
    RAISE EXCEPTION 'Wrong database: this rollback is for the legacy EADB (vaagvairvwmgyzsmymhs)';
  END IF;
END
$guard$;

DROP POLICY IF EXISTS students_self_insert ON public.students;
DROP POLICY IF EXISTS student_profiles_self_insert ON public.student_profiles;

GRANT INSERT, UPDATE, DELETE, TRUNCATE ON
  public.assessments, public.certificates, public.class_attendance,
  public.class_enrollments, public.courses, public.instructors,
  public.module_slides, public.scheduled_classes, public.students,
  public.training_modules, public.student_profiles
TO anon;

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

CREATE POLICY "Enable insert for anon and authenticated" ON public.student_profiles AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY student_profiles_anon_insert ON public.student_profiles AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);

COMMIT;
