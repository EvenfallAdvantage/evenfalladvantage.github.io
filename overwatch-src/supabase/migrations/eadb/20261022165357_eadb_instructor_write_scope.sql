-- EADB: scope instructor writes on class_enrollments / certificates to classes
-- the instructor owns (scheduled_classes.instructor_id = auth.uid()).
-- Previously ANY active instructor could insert/update/delete ANY enrollment and
-- revoke ANY certificate. Admins (public.administrators) keep full write access.
DROP POLICY IF EXISTS "Instructors can insert enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Instructors can update enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Instructors can delete enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Instructors can revoke certificates" ON public.certificates;

CREATE POLICY "Instructors insert enrollments in own classes" ON public.class_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (public.eadb_instructor_owns_class(class_id) OR public.is_admin((select auth.uid())));
CREATE POLICY "Instructors update enrollments in own classes" ON public.class_enrollments
  FOR UPDATE TO authenticated
  USING (public.eadb_instructor_owns_class(class_id) OR public.is_admin((select auth.uid())))
  WITH CHECK (public.eadb_instructor_owns_class(class_id) OR public.is_admin((select auth.uid())));
CREATE POLICY "Instructors delete enrollments in own classes" ON public.class_enrollments
  FOR DELETE TO authenticated
  USING (public.eadb_instructor_owns_class(class_id) OR public.is_admin((select auth.uid())));

-- Certificates: the issuing instructor (or an admin) may revoke/update; issued_by
-- cannot be reassigned to someone else by a non-admin.
CREATE POLICY "Issuer or admin can revoke certificates" ON public.certificates
  FOR UPDATE TO authenticated
  USING (issued_by = (select auth.uid()) OR public.is_admin((select auth.uid())))
  WITH CHECK (issued_by = (select auth.uid()) OR public.is_admin((select auth.uid())));
