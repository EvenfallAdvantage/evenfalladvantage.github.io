-- =============================================================================
-- ROLLBACK for eadb/20261010180000_eadb_pii_read_lockdown.sql
-- Target: LEGACY EADB (project vaagvairvwmgyzsmymhs) ONLY.
-- Recreates the 23 SELECT policies exactly as read from pg_policies on
-- 2026-10-10. NOTE: this re-exposes every per-person table to anon.
-- verify_certificate() is kept (harmless, read-only, non-sensitive fields).
-- =============================================================================
BEGIN;

DROP POLICY IF EXISTS students_staff_select ON public.students;
DROP POLICY IF EXISTS students_thread_partner_select ON public.students;
DROP POLICY IF EXISTS student_profiles_scoped_select ON public.student_profiles;
DROP POLICY IF EXISTS instructors_admin_select ON public.instructors;
DROP POLICY IF EXISTS student_course_enrollments_admin_select ON public.student_course_enrollments;
DROP POLICY IF EXISTS student_module_progress_staff_select ON public.student_module_progress;
DROP POLICY IF EXISTS assessment_results_staff_select ON public.assessment_results;
DROP POLICY IF EXISTS certificates_admin_select ON public.certificates;
DROP POLICY IF EXISTS class_attendance_admin_select ON public.class_attendance;
DROP POLICY IF EXISTS class_enrollments_admin_select ON public.class_enrollments;
DROP POLICY IF EXISTS scheduled_classes_admin_select ON public.scheduled_classes;
DROP POLICY IF EXISTS activity_log_scoped_select ON public.activity_log;
DROP POLICY IF EXISTS clients_scoped_select ON public.clients;
DROP POLICY IF EXISTS certifications_scoped_select ON public.certifications;
DROP POLICY IF EXISTS work_experience_scoped_select ON public.work_experience;
DROP POLICY IF EXISTS student_skills_scoped_select ON public.student_skills;
DROP POLICY IF EXISTS scenario_results_admin_select ON public.scenario_results;

CREATE POLICY anon_select_activity_log ON public.activity_log AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY authenticated_select_activity_log ON public.activity_log AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY anon_select_assessment_results ON public.assessment_results AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY anon_select_certificates ON public.certificates AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "Allow authenticated to view certifications" ON public.certifications AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Clients can view certifications of visible profiles" ON public.certifications AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM student_profiles sp
  WHERE ((sp.student_id = certifications.student_id) AND (sp.profile_visible = true)))));
CREATE POLICY anon_select_class_attendance ON public.class_attendance AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY anon_select_class_enrollments ON public.class_enrollments AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "Allow authenticated to view clients" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view clients" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "View active instructors" ON public.instructors AS PERMISSIVE FOR SELECT TO public USING ((is_active = true));
CREATE POLICY anon_select_instructors ON public.instructors AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY anon_select_scheduled_classes ON public.scheduled_classes AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY anon_select_student_course_enrollments ON public.student_course_enrollments AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY anon_select_student_module_progress ON public.student_module_progress AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "Allow authenticated to view profiles" ON public.student_profiles AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view profiles" ON public.student_profiles AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY anon_select_student_skills ON public.student_skills AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY authenticated_select_student_skills ON public.student_skills AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated to view students" ON public.students AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to view students" ON public.students AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY anon_select_students ON public.students AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY "Allow authenticated users to view work experience" ON public.work_experience AS PERMISSIVE FOR SELECT TO authenticated USING (true);

DROP FUNCTION IF EXISTS public.eadb_is_active_instructor();
DROP FUNCTION IF EXISTS public.eadb_is_client();
DROP FUNCTION IF EXISTS public.eadb_instructor_has_student(uuid);
DROP FUNCTION IF EXISTS public.eadb_shares_thread(uuid);
DROP FUNCTION IF EXISTS public.eadb_profile_visible(uuid);

COMMIT;
