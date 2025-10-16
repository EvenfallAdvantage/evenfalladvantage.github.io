-- Admin RLS Policies
-- Run this to give admins permission to view and manage all data

-- ============================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM administrators
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STUDENTS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all students" ON students;
DROP POLICY IF EXISTS "Admins can insert students" ON students;
DROP POLICY IF EXISTS "Admins can update students" ON students;
DROP POLICY IF EXISTS "Admins can delete students" ON students;
DROP POLICY IF EXISTS "Students can view own record" ON students;

-- Allow admins to view all students
CREATE POLICY "Admins can view all students"
ON students FOR SELECT
TO authenticated
USING (is_admin());

-- Allow students to view their own record
CREATE POLICY "Students can view own record"
ON students FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Allow admins to insert students
CREATE POLICY "Admins can insert students"
ON students FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- Allow admins to update students
CREATE POLICY "Admins can update students"
ON students FOR UPDATE
TO authenticated
USING (is_admin());

-- Allow admins to delete students
CREATE POLICY "Admins can delete students"
ON students FOR DELETE
TO authenticated
USING (is_admin());

-- ============================================
-- STUDENT PROFILES TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admins can view all profiles" ON student_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON student_profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON student_profiles;
DROP POLICY IF EXISTS "Students can view own profile" ON student_profiles;
DROP POLICY IF EXISTS "Students can update own profile" ON student_profiles;

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON student_profiles FOR SELECT
TO authenticated
USING (is_admin());

-- Allow students to view their own profile
CREATE POLICY "Students can view own profile"
ON student_profiles FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Allow admins to insert profiles
CREATE POLICY "Admins can insert profiles"
ON student_profiles FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- Allow admins to update profiles
CREATE POLICY "Admins can update profiles"
ON student_profiles FOR UPDATE
TO authenticated
USING (is_admin());

-- Allow students to update their own profile
CREATE POLICY "Students can update own profile"
ON student_profiles FOR UPDATE
TO authenticated
USING (student_id = auth.uid());

-- ============================================
-- CLIENTS TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admins can view all clients" ON clients;
DROP POLICY IF EXISTS "Admins can insert clients" ON clients;
DROP POLICY IF EXISTS "Admins can update clients" ON clients;
DROP POLICY IF EXISTS "Admins can delete clients" ON clients;
DROP POLICY IF EXISTS "Clients can view own record" ON clients;

-- Allow admins to view all clients
CREATE POLICY "Admins can view all clients"
ON clients FOR SELECT
TO authenticated
USING (is_admin());

-- Allow clients to view their own record
CREATE POLICY "Clients can view own record"
ON clients FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Allow admins to insert clients
CREATE POLICY "Admins can insert clients"
ON clients FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- Allow admins to update clients
CREATE POLICY "Admins can update clients"
ON clients FOR UPDATE
TO authenticated
USING (is_admin());

-- Allow admins to delete clients
CREATE POLICY "Admins can delete clients"
ON clients FOR DELETE
TO authenticated
USING (is_admin());

-- ============================================
-- CERTIFICATIONS TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admins can view all certifications" ON certifications;
DROP POLICY IF EXISTS "Admins can insert certifications" ON certifications;
DROP POLICY IF EXISTS "Admins can update certifications" ON certifications;
DROP POLICY IF EXISTS "Admins can delete certifications" ON certifications;
DROP POLICY IF EXISTS "Students can view own certifications" ON certifications;

-- Allow admins to view all certifications
CREATE POLICY "Admins can view all certifications"
ON certifications FOR SELECT
TO authenticated
USING (is_admin());

-- Allow students to view their own certifications
CREATE POLICY "Students can view own certifications"
ON certifications FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Allow admins to insert certifications
CREATE POLICY "Admins can insert certifications"
ON certifications FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- Allow admins to update certifications
CREATE POLICY "Admins can update certifications"
ON certifications FOR UPDATE
TO authenticated
USING (is_admin());

-- Allow admins to delete certifications
CREATE POLICY "Admins can delete certifications"
ON certifications FOR DELETE
TO authenticated
USING (is_admin());

-- ============================================
-- MODULES TABLE POLICIES (if exists)
-- ============================================

-- Only create policies if modules table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'modules') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Admins can view all modules" ON modules;
    DROP POLICY IF EXISTS "Everyone can view modules" ON modules;

    -- Allow admins to view all modules
    CREATE POLICY "Admins can view all modules"
    ON modules FOR SELECT
    TO authenticated
    USING (is_admin());

    -- Allow everyone to view modules (for students)
    CREATE POLICY "Everyone can view modules"
    ON modules FOR SELECT
    TO authenticated
    USING (true);
    
    RAISE NOTICE 'Modules table policies created';
  ELSE
    RAISE NOTICE 'Modules table does not exist, skipping policies';
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Admin RLS policies created successfully!' as status;

-- Test the is_admin function
SELECT 
  auth.uid() as current_user_id,
  is_admin() as is_current_user_admin;

-- Show all policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('students', 'student_profiles', 'clients', 'certifications', 'administrators')
ORDER BY tablename, policyname;
