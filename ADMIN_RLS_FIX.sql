-- QUICK FIX for Admin RLS Issues
-- This temporarily allows all authenticated users to view data
-- Run this to get the dashboard working immediately

-- ============================================
-- TEMPORARY: Allow all authenticated users to view students
-- ============================================

DROP POLICY IF EXISTS "Admins can view all students" ON students;
DROP POLICY IF EXISTS "Students can view own record" ON students;

-- Temporary policy - allows all authenticated users to view students
CREATE POLICY "Allow authenticated to view students"
ON students FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- TEMPORARY: Allow all authenticated users to view student profiles
-- ============================================

DROP POLICY IF EXISTS "Admins can view all profiles" ON student_profiles;
DROP POLICY IF EXISTS "Students can view own profile" ON student_profiles;

CREATE POLICY "Allow authenticated to view profiles"
ON student_profiles FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- TEMPORARY: Allow all authenticated users to view clients
-- ============================================

DROP POLICY IF EXISTS "Admins can view all clients" ON clients;
DROP POLICY IF EXISTS "Clients can view own record" ON clients;

CREATE POLICY "Allow authenticated to view clients"
ON clients FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- TEMPORARY: Allow all authenticated users to view certifications
-- ============================================

DROP POLICY IF EXISTS "Admins can view all certifications" ON certifications;
DROP POLICY IF EXISTS "Students can view own certifications" ON certifications;

CREATE POLICY "Allow authenticated to view certifications"
ON certifications FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- Allow admins to modify data
-- ============================================

-- Drop existing modification policies first
DROP POLICY IF EXISTS "Admins can insert students" ON students;
DROP POLICY IF EXISTS "Admins can update students" ON students;
DROP POLICY IF EXISTS "Admins can delete students" ON students;
DROP POLICY IF EXISTS "Admins can insert profiles" ON student_profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON student_profiles;
DROP POLICY IF EXISTS "Admins can insert clients" ON clients;
DROP POLICY IF EXISTS "Admins can update clients" ON clients;
DROP POLICY IF EXISTS "Admins can delete clients" ON clients;
DROP POLICY IF EXISTS "Admins can insert certifications" ON certifications;
DROP POLICY IF EXISTS "Admins can update certifications" ON certifications;
DROP POLICY IF EXISTS "Admins can delete certifications" ON certifications;

-- Students
CREATE POLICY "Admins can insert students"
ON students FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can update students"
ON students FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can delete students"
ON students FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

-- Student Profiles
CREATE POLICY "Admins can insert profiles"
ON student_profiles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can update profiles"
ON student_profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

-- Clients
CREATE POLICY "Admins can insert clients"
ON clients FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can update clients"
ON clients FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can delete clients"
ON clients FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

-- Certifications
CREATE POLICY "Admins can insert certifications"
ON certifications FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can update certifications"
ON certifications FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can delete certifications"
ON certifications FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

SELECT 'Quick fix applied! Dashboard should work now.' as status;

-- Verify you can see students
SELECT COUNT(*) as student_count FROM students;
SELECT COUNT(*) as client_count FROM clients;
