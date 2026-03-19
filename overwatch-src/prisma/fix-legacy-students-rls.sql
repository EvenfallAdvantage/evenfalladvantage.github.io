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
DROP POLICY IF EXISTS students_anon_insert ON students;
CREATE POLICY students_anon_insert
  ON students
  FOR INSERT TO anon
  WITH CHECK (true);

-- Also allow anonymous inserts into student_profiles (created after student)
DROP POLICY IF EXISTS student_profiles_anon_insert ON student_profiles;
CREATE POLICY student_profiles_anon_insert
  ON student_profiles
  FOR INSERT TO anon
  WITH CHECK (true);

-- Also allow anonymous upserts (on_conflict) by enabling UPDATE for anon on students
DROP POLICY IF EXISTS students_anon_update ON students;
CREATE POLICY students_anon_update
  ON students
  FOR UPDATE TO anon
  USING (true);
