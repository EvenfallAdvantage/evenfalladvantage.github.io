-- =============================================================================
-- 20261010180000_eadb_pii_read_lockdown.sql
-- Target: LEGACY EADB (project vaagvairvwmgyzsmymhs) ONLY. Not OverwatchDB.
-- Status: DRAFT. Not applied.
-- Rollback: migrations/rollback/20261010180000_eadb_pii_read_lockdown.rollback.sql
--
-- ORDER: apply AFTER 20261006120500_eadb_remove_anon_writes.sql (it fixes
-- is_admin(uuid), which these policies use; the guard below refuses to run on
-- the broken version) AND after Overwatch runs with
-- NEXT_PUBLIC_LEGACY_BRIDGE_MODE=server plus the bridge read ops of this PR
-- (Overwatch reads EADB with the anon key; after this migration anon reads of
-- per-person tables return nothing).
--
-- Problem: anon (publishable key, shipped in every page) and any signed-in
-- user can read every row of students (email, phone, date_of_birth),
-- student_profiles (address, phone), instructors, course enrolments, module
-- progress, assessment results, certificates, attendance, activity_log,
-- clients, certifications, work_experience, student_skills.
--
-- Rule after this migration (SELECT only; writes unchanged):
--   * anon: catalog only (courses, course_modules, training_modules,
--     module_slides, assessments, state_laws, crime data, skills, active
--     job_postings). Nothing per-person. Certificate check via
--     public.verify_certificate(code) (non-sensitive fields).
--   * a user: own rows (existing "own" policies, plus certifications own).
--   * EADB admins (is_admin(auth.uid())): everything below.
--   * active instructors (static instructor portal = staff directory: lists
--     all students to enrol them, checks prerequisites): students, module
--     progress, assessment results (certificates/classes/attendance already
--     have instructor policies). Address/phone/bio in student_profiles only
--     for students enrolled in one of THEIR classes.
--   * messaging partners (shared message_threads row): each other's
--     students / clients name + email (student-portal/js/messages.js).
--   * clients (employers): student_profiles, certifications, work_experience,
--     student_skills of students who set profile_visible = true.
--   * Overwatch: through legacy-bridge-write (service role) read ops.
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.module_slides') IS NULL
     OR to_regclass('public.administrators') IS NULL
     OR to_regclass('public.company_memberships') IS NOT NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for the legacy EADB (vaagvairvwmgyzsmymhs)';
  END IF;
  IF (SELECT prosrc FROM pg_proc WHERE oid = 'public.is_admin(uuid)'::regprocedure) ILIKE '%auth_user_id%' THEN
    RAISE EXCEPTION 'Apply 20261006120500_eadb_remove_anon_writes.sql first (is_admin(uuid) is still broken)';
  END IF;
END
$guard$;

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so policies don't recurse through other tables'
-- RLS; each only answers a question about the CALLER (auth.uid()).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eadb_is_active_instructor()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.instructors i WHERE i.id = auth.uid() AND i.is_active) $$;

CREATE OR REPLACE FUNCTION public.eadb_is_client()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.eadb_instructor_has_student(p_student_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_enrollments e
    JOIN public.scheduled_classes c ON c.id = e.class_id
    WHERE e.student_id = p_student_id AND c.instructor_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.eadb_shares_thread(p_other uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE (t.participant_1 = auth.uid() AND t.participant_2 = p_other)
       OR (t.participant_2 = auth.uid() AND t.participant_1 = p_other))
$$;

CREATE OR REPLACE FUNCTION public.eadb_profile_visible(p_student_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.student_profiles p WHERE p.student_id = p_student_id AND p.profile_visible) $$;

REVOKE ALL ON FUNCTION public.eadb_is_active_instructor(), public.eadb_is_client(),
  public.eadb_instructor_has_student(uuid), public.eadb_shares_thread(uuid),
  public.eadb_profile_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eadb_is_active_instructor(), public.eadb_is_client(),
  public.eadb_instructor_has_student(uuid), public.eadb_shares_thread(uuid),
  public.eadb_profile_visible(uuid) TO authenticated, service_role;

-- Public certificate verification: by verification code or certificate
-- number, non-sensitive fields only (no email, no student id, no notes/pdf).
CREATE OR REPLACE FUNCTION public.verify_certificate(p_code text)
  RETURNS TABLE (certificate_number text, certificate_name text, certificate_type text,
                 holder_name text, state_issued text, issue_date date, expiration_date date, status text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT c.certificate_number::text, c.certificate_name::text, c.certificate_type::text,
         trim(coalesce(s.first_name, '') || ' ' || left(coalesce(s.last_name, ''), 1) || CASE WHEN coalesce(s.last_name, '') <> '' THEN '.' ELSE '' END),
         c.state_issued::text, c.issue_date::date, c.expiration_date::date,
         CASE WHEN c.status = 'active' AND c.expiration_date IS NOT NULL AND c.expiration_date::date < current_date
              THEN 'expired' ELSE c.status::text END
  FROM public.certificates c
  LEFT JOIN public.students s ON s.id = c.student_id
  WHERE p_code IS NOT NULL AND length(p_code) BETWEEN 6 AND 64
    AND (c.verification_code = p_code OR c.certificate_number = p_code)
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS anon_select_students ON public.students;
DROP POLICY IF EXISTS "Allow authenticated to view students" ON public.students;
DROP POLICY IF EXISTS "Allow authenticated users to view students" ON public.students;
CREATE POLICY students_staff_select ON public.students FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.eadb_is_active_instructor());
CREATE POLICY students_thread_partner_select ON public.students FOR SELECT TO authenticated
  USING (public.eadb_shares_thread(id));
-- kept: "Users can view own data" (auth.uid() = id)

-- student_profiles (address, phone, bio, resume)
DROP POLICY IF EXISTS "Allow authenticated to view profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to view profiles" ON public.student_profiles;
CREATE POLICY student_profiles_scoped_select ON public.student_profiles FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid())
         OR public.eadb_instructor_has_student(student_id)
         OR (profile_visible AND public.eadb_is_client()));
-- kept: "Users can view own profile"

-- instructors (email, phone)
DROP POLICY IF EXISTS anon_select_instructors ON public.instructors;
DROP POLICY IF EXISTS "View active instructors" ON public.instructors;
CREATE POLICY instructors_admin_select ON public.instructors FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
-- kept: "Instructors can view own profile"

-- learning records
DROP POLICY IF EXISTS anon_select_student_course_enrollments ON public.student_course_enrollments;
CREATE POLICY student_course_enrollments_admin_select ON public.student_course_enrollments FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS anon_select_student_module_progress ON public.student_module_progress;
CREATE POLICY student_module_progress_staff_select ON public.student_module_progress FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.eadb_is_active_instructor());

DROP POLICY IF EXISTS anon_select_assessment_results ON public.assessment_results;
CREATE POLICY assessment_results_staff_select ON public.assessment_results FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.eadb_is_active_instructor());

DROP POLICY IF EXISTS anon_select_certificates ON public.certificates;
CREATE POLICY certificates_admin_select ON public.certificates FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
-- kept: "Students can view own certificates", "Instructors can view all certificates"

-- classes
DROP POLICY IF EXISTS anon_select_class_attendance ON public.class_attendance;
DROP POLICY IF EXISTS anon_select_class_enrollments ON public.class_enrollments;
DROP POLICY IF EXISTS anon_select_scheduled_classes ON public.scheduled_classes;
CREATE POLICY class_attendance_admin_select ON public.class_attendance FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY class_enrollments_admin_select ON public.class_enrollments FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY scheduled_classes_admin_select ON public.scheduled_classes FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- activity_log
DROP POLICY IF EXISTS anon_select_activity_log ON public.activity_log;
DROP POLICY IF EXISTS authenticated_select_activity_log ON public.activity_log;
CREATE POLICY activity_log_scoped_select ON public.activity_log FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_admin(auth.uid()));

-- clients (employer contact details)
DROP POLICY IF EXISTS "Allow authenticated to view clients" ON public.clients;
DROP POLICY IF EXISTS "Allow authenticated users to view clients" ON public.clients;
CREATE POLICY clients_scoped_select ON public.clients FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.eadb_shares_thread(id));
-- kept: "Enable read access for own profile"

-- talent profile pieces: own, admin, clients for visible profiles
DROP POLICY IF EXISTS "Allow authenticated to view certifications" ON public.certifications;
DROP POLICY IF EXISTS "Clients can view certifications of visible profiles" ON public.certifications;
CREATE POLICY certifications_scoped_select ON public.certifications FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_admin(auth.uid())
         OR (public.eadb_is_client() AND public.eadb_profile_visible(student_id)));

DROP POLICY IF EXISTS "Allow authenticated users to view work experience" ON public.work_experience;
CREATE POLICY work_experience_scoped_select ON public.work_experience FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR (public.eadb_is_client() AND public.eadb_profile_visible(student_id)));
-- kept: "Users can view own experience"

DROP POLICY IF EXISTS anon_select_student_skills ON public.student_skills;
DROP POLICY IF EXISTS authenticated_select_student_skills ON public.student_skills;
CREATE POLICY student_skills_scoped_select ON public.student_skills FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_admin(auth.uid())
         OR (public.eadb_is_client() AND public.eadb_profile_visible(student_id)));

CREATE POLICY scenario_results_admin_select ON public.scenario_results FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

COMMIT;
