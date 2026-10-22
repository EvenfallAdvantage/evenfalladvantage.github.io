-- Rollback: restore previous (broad) instructor write policies.
DROP POLICY IF EXISTS "Instructors insert enrollments in own classes" ON public.class_enrollments;
DROP POLICY IF EXISTS "Instructors update enrollments in own classes" ON public.class_enrollments;
DROP POLICY IF EXISTS "Instructors delete enrollments in own classes" ON public.class_enrollments;
DROP POLICY IF EXISTS "Issuer or admin can revoke certificates" ON public.certificates;
CREATE POLICY "Instructors can insert enrollments" ON public.class_enrollments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM instructors WHERE instructors.id = auth.uid() AND instructors.is_active = true));
CREATE POLICY "Instructors can update enrollments" ON public.class_enrollments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM instructors WHERE instructors.id = auth.uid() AND instructors.is_active = true));
CREATE POLICY "Instructors can delete enrollments" ON public.class_enrollments FOR DELETE
  USING (EXISTS (SELECT 1 FROM instructors WHERE instructors.id = auth.uid() AND instructors.is_active = true));
CREATE POLICY "Instructors can revoke certificates" ON public.certificates FOR UPDATE
  USING (auth.uid() IN (SELECT instructors.id FROM instructors));
