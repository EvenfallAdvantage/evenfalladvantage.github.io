-- =============================================================================
-- 20261006120500_eadb_remove_anon_writes.sql
-- Target: LEGACY EADB (project vaagvairvwmgyzsmymhs) ONLY. Not OverwatchDB.
-- Kept in migrations/eadb/ so `supabase db push` for overwatch-src never
-- picks it up. Status: DRAFT. Not applied.
-- Rollback: migrations/rollback/20261006120500_eadb_remove_anon_writes.rollback.sql
--
-- Removes every anon INSERT/UPDATE/DELETE policy on the 10 legacy tables.
-- With the publishable (anon) key shipped in the static portals and the
-- Overwatch bundle, these let anyone on the internet create/alter courses,
-- modules, slides, classes, enrollments, attendance, assessments,
-- certificates, instructors and students.
--
-- !! BREAKING: the Overwatch legacy bridge (src/lib/legacy/*,
-- src/lib/account-linker.ts) writes to EADB with the anon key and no EADB
-- session. Those writes stop working when this is applied; see the PR body
-- for the exact list. Do not apply until the bridge is moved to an
-- authenticated EADB session or a server-side (service-role) endpoint.
--
-- Not changed here (follow-ups): anon SELECT USING (true) policies on these
-- tables (students/instructors expose names and emails to the anon key).
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.module_slides') IS NULL
     OR to_regclass('public.administrators') IS NULL
     OR to_regclass('public.company_memberships') IS NOT NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for the legacy EADB (vaagvairvwmgyzsmymhs)';
  END IF;
END
$guard$;

-- assessments
DROP POLICY IF EXISTS anon_insert_assessments ON public.assessments;
DROP POLICY IF EXISTS anon_update_assessments ON public.assessments;
-- certificates
DROP POLICY IF EXISTS anon_insert_certificates ON public.certificates;
-- class_attendance
DROP POLICY IF EXISTS anon_insert_class_attendance ON public.class_attendance;
DROP POLICY IF EXISTS anon_update_class_attendance ON public.class_attendance;
-- class_enrollments
DROP POLICY IF EXISTS anon_insert_class_enrollments ON public.class_enrollments;
DROP POLICY IF EXISTS anon_delete_class_enrollments ON public.class_enrollments;
-- courses
DROP POLICY IF EXISTS anon_insert_courses ON public.courses;
DROP POLICY IF EXISTS anon_update_courses ON public.courses;
-- instructors
DROP POLICY IF EXISTS anon_insert_instructors ON public.instructors;
DROP POLICY IF EXISTS anon_update_instructors ON public.instructors;
-- module_slides
DROP POLICY IF EXISTS anon_insert_module_slides ON public.module_slides;
DROP POLICY IF EXISTS anon_update_module_slides ON public.module_slides;
DROP POLICY IF EXISTS anon_delete_module_slides ON public.module_slides;
-- scheduled_classes
DROP POLICY IF EXISTS anon_insert_scheduled_classes ON public.scheduled_classes;
DROP POLICY IF EXISTS anon_update_scheduled_classes ON public.scheduled_classes;
-- training_modules
DROP POLICY IF EXISTS anon_insert_training_modules ON public.training_modules;
DROP POLICY IF EXISTS anon_update_training_modules ON public.training_modules;
-- students
DROP POLICY IF EXISTS students_anon_insert ON public.students;
DROP POLICY IF EXISTS students_anon_update ON public.students;
DROP POLICY IF EXISTS "Enable insert for anon and authenticated" ON public.students;

-- Student portal signup (student-portal/js/supabase-config.js) inserts its own
-- students row right after auth.signUp(). Keep that working for a signed-in
-- user, but only for their own id and sign-in email.
CREATE POLICY students_self_insert ON public.students
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND lower(email) = lower(auth.jwt() ->> 'email'));

-- Defence in depth: anon keeps SELECT (out of scope) but loses write grants.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.assessments, public.certificates, public.class_attendance,
  public.class_enrollments, public.courses, public.instructors,
  public.module_slides, public.scheduled_classes, public.students,
  public.training_modules
FROM anon;

-- OPTIONAL (not enabled): if EADB requires email confirmation, signUp()
-- returns no session and the portal's students insert above runs as anon and
-- now fails. Creating the row in the existing auth trigger fixes that:
--
-- CREATE OR REPLACE FUNCTION public.handle_new_student()
--  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
-- AS $function$
-- BEGIN
--   INSERT INTO student_profiles (student_id) VALUES (NEW.id);
--   INSERT INTO students (id, email, first_name, last_name)
--   VALUES (NEW.id, NEW.email,
--           COALESCE(NULLIF(NEW.raw_user_meta_data->>'first_name', ''), 'Student'),
--           COALESCE(NEW.raw_user_meta_data->>'last_name', ''))
--   ON CONFLICT DO NOTHING;
--   RETURN NEW;
-- END;
-- $function$;

COMMIT;
