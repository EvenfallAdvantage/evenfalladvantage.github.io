-- Fix foreign key issue for assessment_results
-- The issue is that assessment_results references the students table,
-- but we should be using student_profiles instead

-- First, check what tables we have and their relationships
SELECT 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'assessment_results';

-- Check if we have a students table or student_profiles table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('students', 'student_profiles');

-- If the foreign key points to 'students' but we're using 'student_profiles',
-- we need to drop and recreate the constraint

-- Drop the existing foreign key constraint
ALTER TABLE assessment_results
DROP CONSTRAINT IF EXISTS assessment_results_student_id_fkey;

-- Add the correct foreign key constraint pointing to student_profiles
ALTER TABLE assessment_results
ADD CONSTRAINT assessment_results_student_id_fkey 
FOREIGN KEY (student_id) 
REFERENCES student_profiles(id) 
ON DELETE CASCADE;

-- Verify the fix
SELECT 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'assessment_results';
