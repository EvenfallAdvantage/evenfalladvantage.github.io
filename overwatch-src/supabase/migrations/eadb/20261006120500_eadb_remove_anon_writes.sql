-- =============================================================================
-- 20261006120500_eadb_remove_anon_writes.sql
-- Target: LEGACY EADB (project vaagvairvwmgyzsmymhs) ONLY. Not OverwatchDB.
-- Kept in migrations/eadb/ so `supabase db push` for overwatch-src never
-- picks it up. Status: DRAFT. Not applied.
-- Rollback: migrations/rollback/20261006120500_eadb_remove_anon_writes.rollback.sql
--
-- Removes every anon INSERT/UPDATE/DELETE policy on the 10 legacy tables
-- (+ student_profiles and activity_log) and fixes is_admin(uuid).
-- With the publishable (anon) key shipped in the static portals and the
-- Overwatch bundle, these let anyone on the internet create/alter courses,
-- modules, slides, classes, enrollments, attendance, assessments,
-- certificates, instructors and students.
--
-- !! BREAKING until the Overwatch legacy bridge uses the server path:
-- src/lib/legacy/* and src/lib/account-linker.ts used to write to EADB with
-- the anon key. PR "fix/eadb-instructor-hq-server-link" moves every one of
-- those writes to the `legacy-bridge-write` edge function (deployed on EADB,
-- service role, verifies the Overwatch session + company role). Apply this
-- migration ONLY after:
--   1. legacy-bridge-write is deployed to EADB with its secrets, and
--   2. the Overwatch frontend from that PR is live and Instructor HQ writes
--      were checked to go through the function (Network tab: POST
--      /functions/v1/legacy-bridge-write -> 200), and
--   3. ideally NEXT_PUBLIC_LEGACY_BRIDGE_MODE=server is set so nothing falls
--      back to anon writes.
-- Updated 2026-10-06: also closes anon inserts on student_profiles (two
-- policies) and revokes anon writes on it; adds student_profiles_self_insert.
--
-- Re-checked against the live EADB 2026-10-10 (all 26 dropped policies still
-- exist as listed). Also now:
--   * activity_log: drops anon_insert_activity_log (anon INSERT WITH CHECK
--     true; every writer signs in - student portal - and keeps
--     authenticated_insert_activity_log) and revokes anon writes on it.
--   * is_admin(uuid): live body reads administrators.auth_user_id / is_active,
--     which don't exist (columns are id, user_id, ...), so every policy that
--     calls is_admin(auth.uid()) errors 42703 (administrators "Admins can
--     create new admins", state_laws insert/update/delete, skills insert).
--     Rewritten to the same test as is_admin(): a row with user_id = p_user_id.
--     SECURITY INVOKER on purpose: administrators RLS shows a user only their
--     own row, so is_admin(<someone else>) can't be used to probe who is admin.
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

-- student_profiles: the student portal inserts its own profile row right
-- after signUp (and handle_new_student already creates it server-side).
-- "Enable insert for anon and authenticated" also let any signed-in user
-- create a profile for any student_id.
DROP POLICY IF EXISTS student_profiles_anon_insert ON public.student_profiles;
DROP POLICY IF EXISTS "Enable insert for anon and authenticated" ON public.student_profiles;
CREATE POLICY student_profiles_self_insert ON public.student_profiles
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- activity_log: signed-in writers only (authenticated_insert_activity_log stays).
DROP POLICY IF EXISTS anon_insert_activity_log ON public.activity_log;

-- is_admin(uuid): fix the broken column references (see header).
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $function$
  SELECT p_user_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.administrators a WHERE a.user_id = p_user_id)
$function$;

-- Defence in depth: anon keeps SELECT (out of scope) but loses write grants.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.assessments, public.certificates, public.class_attendance,
  public.class_enrollments, public.courses, public.instructors,
  public.module_slides, public.scheduled_classes, public.students,
  public.training_modules, public.student_profiles, public.activity_log
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
