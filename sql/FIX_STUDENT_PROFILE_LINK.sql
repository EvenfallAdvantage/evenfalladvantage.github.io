-- Fix the student_id mismatch in student_profiles

-- First, let's see the current mismatch
SELECT 
    s.id as correct_student_id,
    s.first_name,
    s.last_name,
    sp.student_id as wrong_student_id,
    sp.profile_visible
FROM students s
LEFT JOIN student_profiles sp ON s.id = sp.student_id
WHERE sp.student_id IS NULL OR s.id != sp.student_id;

-- Update the student_id to match the correct student
-- Replace the UUIDs with the actual values from your database
UPDATE student_profiles 
SET student_id = '0874cd6d-1d59-46d8-a43c-5fc8fef3db6e'
WHERE student_id = 'ad3db11a-50b8-4a24-847c-a168c834a69f';

-- Verify the fix
SELECT 
    s.id as student_id,
    s.first_name,
    s.last_name,
    sp.student_id as profile_student_id,
    sp.profile_visible,
    CASE 
        WHEN sp.student_id IS NULL THEN 'NO PROFILE'
        WHEN s.id = sp.student_id THEN 'MATCH ✓'
        ELSE 'MISMATCH ✗'
    END as status
FROM students s
LEFT JOIN student_profiles sp ON s.id = sp.student_id;
