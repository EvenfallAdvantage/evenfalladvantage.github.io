-- =====================================================
-- FIX RLS INFINITE RECURSION ISSUE
-- =====================================================
-- This script fixes the infinite recursion error in RLS policies
-- The issue is caused by circular policy dependencies
-- =====================================================

-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Students can view their enrollments" ON student_course_enrollments;
DROP POLICY IF EXISTS "Students can view their own progress" ON student_module_progress;
DROP POLICY IF EXISTS "Students can update their own progress" ON student_module_progress;
DROP POLICY IF EXISTS "Students can insert their own progress" ON student_module_progress;

-- Recreate policies WITHOUT circular dependencies
-- These policies use direct student_id checks instead of checking through enrollments

-- =====================================================
-- STUDENT_COURSE_ENROLLMENTS POLICIES
-- =====================================================

-- Students can view their own enrollments (simple, no recursion)
CREATE POLICY "Students can view their enrollments"
ON student_course_enrollments
FOR SELECT
TO authenticated
USING (
    student_id = auth.uid()
);

-- =====================================================
-- STUDENT_MODULE_PROGRESS POLICIES
-- =====================================================

-- Students can view their own progress (simple, no recursion)
CREATE POLICY "Students can view their own progress"
ON student_module_progress
FOR SELECT
TO authenticated
USING (
    student_id = auth.uid()
);

-- Students can insert their own progress (simple, no recursion)
CREATE POLICY "Students can insert their own progress"
ON student_module_progress
FOR INSERT
TO authenticated
WITH CHECK (
    student_id = auth.uid()
);

-- Students can update their own progress (simple, no recursion)
CREATE POLICY "Students can update their own progress"
ON student_module_progress
FOR UPDATE
TO authenticated
USING (
    student_id = auth.uid()
)
WITH CHECK (
    student_id = auth.uid()
);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- List all policies on student_course_enrollments
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'student_course_enrollments'
ORDER BY policyname;

-- List all policies on student_module_progress
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'student_module_progress'
ORDER BY policyname;
