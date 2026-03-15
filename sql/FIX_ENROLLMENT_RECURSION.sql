-- =====================================================
-- FIX ENROLLMENT POLICY RECURSION
-- =====================================================
-- This script completely removes and recreates the 
-- student_course_enrollments policies to eliminate recursion
-- =====================================================

-- Step 1: Disable RLS temporarily to see what's happening
ALTER TABLE student_course_enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_module_progress DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL policies on both tables
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Drop all policies on student_course_enrollments
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'student_course_enrollments'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON student_course_enrollments', pol.policyname);
    END LOOP;
    
    -- Drop all policies on student_module_progress
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'student_module_progress'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON student_module_progress', pol.policyname);
    END LOOP;
END $$;

-- Step 3: Re-enable RLS
ALTER TABLE student_course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_module_progress ENABLE ROW LEVEL SECURITY;

-- Step 4: Create ONLY the essential policies with NO dependencies

-- STUDENT_COURSE_ENROLLMENTS: Only allow students to see their own enrollments
CREATE POLICY "enrollment_select_policy"
ON student_course_enrollments
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- STUDENT_MODULE_PROGRESS: Allow students to see their own progress
CREATE POLICY "progress_select_policy"
ON student_module_progress
FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- STUDENT_MODULE_PROGRESS: Allow students to insert their own progress
CREATE POLICY "progress_insert_policy"
ON student_module_progress
FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

-- STUDENT_MODULE_PROGRESS: Allow students to update their own progress
CREATE POLICY "progress_update_policy"
ON student_module_progress
FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- Step 5: Verification - Show what policies exist now
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('student_course_enrollments', 'student_module_progress')
ORDER BY tablename, policyname;

-- Step 6: Test if we can query the tables
SELECT 'Testing student_course_enrollments' as test, COUNT(*) as count FROM student_course_enrollments;
SELECT 'Testing student_module_progress' as test, COUNT(*) as count FROM student_module_progress;
