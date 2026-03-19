-- ============================================================
-- FIX: Legacy students table RLS blocking anon inserts
-- Run in: LEGACY Supabase Dashboard → SQL Editor → New Query
-- Legacy instance: vaagvairvwmgyzsmymhs.supabase.co
--
-- Problem: Overwatch's legacy-bridge.ts uses the anon key to
-- create student profiles, but the students table has no INSERT
-- policy for anon → 401 / 42501 RLS violation.
-- ============================================================

-- Allow anonymous inserts into students (for auto-linking from Overwatch)
CREATE POLICY IF NOT EXISTS students_anon_insert
  ON public.students
  FOR INSERT TO anon
  WITH CHECK (true);

-- Also allow anonymous inserts into student_profiles (created after student)
CREATE POLICY IF NOT EXISTS student_profiles_anon_insert
  ON public.student_profiles
  FOR INSERT TO anon
  WITH CHECK (true);

-- Also allow anonymous upserts (on_conflict) by enabling UPDATE for anon on students
CREATE POLICY IF NOT EXISTS students_anon_update
  ON public.students
  FOR UPDATE TO anon
  USING (true);
