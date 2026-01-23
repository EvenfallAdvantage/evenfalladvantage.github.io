-- =====================================================
-- TEMPORARILY DISABLE RLS TO TEST
-- =====================================================
-- This script temporarily disables RLS on the problematic tables
-- to verify if RLS policies are the root cause
-- =====================================================

-- Disable RLS on student_course_enrollments
ALTER TABLE student_course_enrollments DISABLE ROW LEVEL SECURITY;

-- Disable RLS on student_module_progress
ALTER TABLE student_module_progress DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename IN ('student_course_enrollments', 'student_module_progress');

-- Note: This is TEMPORARY for testing only
-- After confirming this fixes the issue, we'll re-enable RLS with proper policies
