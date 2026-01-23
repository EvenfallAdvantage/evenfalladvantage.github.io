-- =====================================================
-- FIX ALL RLS POLICIES - COMPLETE SOLUTION
-- =====================================================
-- This script removes ALL RLS policies that cause recursion
-- and recreates them with simple, non-recursive checks
-- =====================================================

-- =====================================================
-- 1. DROP ALL EXISTING POLICIES
-- =====================================================

-- Drop ALL policies on student_course_enrollments
DROP POLICY IF EXISTS "Students can view their enrollments" ON student_course_enrollments;
DROP POLICY IF EXISTS "Students can view their own enrollments" ON student_course_enrollments;
DROP POLICY IF EXISTS "Enable read access for enrolled students" ON student_course_enrollments;
DROP POLICY IF EXISTS "Students can insert enrollments" ON student_course_enrollments;
DROP POLICY IF EXISTS "Students can update their enrollments" ON student_course_enrollments;

-- Drop ALL policies on student_module_progress
DROP POLICY IF EXISTS "Students can view their own progress" ON student_module_progress;
DROP POLICY IF EXISTS "Students can view their progress" ON student_module_progress;
DROP POLICY IF EXISTS "Enable read access for own progress" ON student_module_progress;
DROP POLICY IF EXISTS "Students can update their own progress" ON student_module_progress;
DROP POLICY IF EXISTS "Students can update their progress" ON student_module_progress;
DROP POLICY IF EXISTS "Enable update for own progress" ON student_module_progress;
DROP POLICY IF EXISTS "Students can insert their own progress" ON student_module_progress;
DROP POLICY IF EXISTS "Students can insert their progress" ON student_module_progress;
DROP POLICY IF EXISTS "Enable insert for own progress" ON student_module_progress;

-- =====================================================
-- 2. CREATE SIMPLE, NON-RECURSIVE POLICIES
-- =====================================================

-- STUDENT_COURSE_ENROLLMENTS: Simple SELECT policy
CREATE POLICY "students_select_own_enrollments"
ON student_course_enrollments
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- STUDENT_MODULE_PROGRESS: Simple SELECT policy
CREATE POLICY "students_select_own_progress"
ON student_module_progress
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- STUDENT_MODULE_PROGRESS: Simple INSERT policy
CREATE POLICY "students_insert_own_progress"
ON student_module_progress
FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

-- STUDENT_MODULE_PROGRESS: Simple UPDATE policy
CREATE POLICY "students_update_own_progress"
ON student_module_progress
FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- =====================================================
-- 3. VERIFICATION
-- =====================================================

-- Show all policies on student_course_enrollments
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'student_course_enrollments';

-- Show all policies on student_module_progress
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'student_module_progress';
