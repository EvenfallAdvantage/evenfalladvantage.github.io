-- =====================================================
-- RE-ENABLE RLS WITH PROPER NON-RECURSIVE POLICIES
-- =====================================================
-- This script re-enables RLS and creates simple policies
-- that avoid infinite recursion
-- =====================================================

-- =====================================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- =====================================================

-- Drop all policies on student_course_enrollments
DROP POLICY IF EXISTS "Students can view their enrollments" ON student_course_enrollments;
DROP POLICY IF EXISTS "Students can view their own enrollments" ON student_course_enrollments;
DROP POLICY IF EXISTS "Enable read access for enrolled students" ON student_course_enrollments;
DROP POLICY IF EXISTS "Students can insert enrollments" ON student_course_enrollments;
DROP POLICY IF EXISTS "Students can update their enrollments" ON student_course_enrollments;
DROP POLICY IF EXISTS "students_select_own_enrollments" ON student_course_enrollments;

-- Drop all policies on student_module_progress
DROP POLICY IF EXISTS "Students can view their own progress" ON student_module_progress;
DROP POLICY IF EXISTS "Students can view their progress" ON student_module_progress;
DROP POLICY IF EXISTS "Enable read access for own progress" ON student_module_progress;
DROP POLICY IF EXISTS "Students can update their own progress" ON student_module_progress;
DROP POLICY IF EXISTS "Students can update their progress" ON student_module_progress;
DROP POLICY IF EXISTS "Enable update for own progress" ON student_module_progress;
DROP POLICY IF EXISTS "Students can insert their own progress" ON student_module_progress;
DROP POLICY IF EXISTS "Students can insert their progress" ON student_module_progress;
DROP POLICY IF EXISTS "Enable insert for own progress" ON student_module_progress;
DROP POLICY IF EXISTS "students_select_own_progress" ON student_module_progress;
DROP POLICY IF EXISTS "students_insert_own_progress" ON student_module_progress;
DROP POLICY IF EXISTS "students_update_own_progress" ON student_module_progress;

-- =====================================================
-- STEP 2: RE-ENABLE RLS ON TABLES
-- =====================================================

ALTER TABLE student_course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_module_progress ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 3: CREATE SIMPLE, NON-RECURSIVE POLICIES
-- =====================================================

-- STUDENT_COURSE_ENROLLMENTS POLICIES
-- Simple policy: students can only see their own enrollments
CREATE POLICY "students_view_own_enrollments"
ON student_course_enrollments
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Allow students to update their own enrollment data (last_accessed, etc.)
CREATE POLICY "students_update_own_enrollments"
ON student_course_enrollments
FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- STUDENT_MODULE_PROGRESS POLICIES
-- Simple policy: students can only see their own progress
CREATE POLICY "students_view_own_progress"
ON student_module_progress
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Allow students to insert their own progress
CREATE POLICY "students_create_own_progress"
ON student_module_progress
FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

-- Allow students to update their own progress
CREATE POLICY "students_modify_own_progress"
ON student_module_progress
FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- =====================================================
-- STEP 4: VERIFICATION
-- =====================================================

-- Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('student_course_enrollments', 'student_module_progress')
ORDER BY tablename;

-- Show all policies on student_course_enrollments
SELECT 
    tablename,
    policyname,
    cmd as command,
    permissive,
    roles,
    qual as using_expression
FROM pg_policies
WHERE tablename = 'student_course_enrollments'
ORDER BY policyname;

-- Show all policies on student_module_progress
SELECT 
    tablename,
    policyname,
    cmd as command,
    permissive,
    roles,
    qual as using_expression
FROM pg_policies
WHERE tablename = 'student_module_progress'
ORDER BY policyname;

-- =====================================================
-- NOTES
-- =====================================================
-- These policies are simple and non-recursive:
-- 1. They only check student_id = auth.uid()
-- 2. They do NOT reference other tables
-- 3. They do NOT create circular dependencies
-- 
-- This ensures:
-- - No infinite recursion errors
-- - Students can only see/modify their own data
-- - Performance is optimal (simple equality checks)
-- =====================================================
