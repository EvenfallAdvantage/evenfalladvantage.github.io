-- Fix student_profiles table to have unique constraint on student_id
-- Run this in Supabase SQL Editor

-- First, check if there are any duplicate student_ids
SELECT student_id, COUNT(*) 
FROM student_profiles 
GROUP BY student_id 
HAVING COUNT(*) > 1;

-- If there are duplicates, remove them (keeping the most recent)
DELETE FROM student_profiles a
USING student_profiles b
WHERE a.id < b.id 
AND a.student_id = b.student_id;

-- Add unique constraint on student_id
ALTER TABLE student_profiles 
ADD CONSTRAINT student_profiles_student_id_key 
UNIQUE (student_id);

-- Verify the constraint was added
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'student_profiles'::regclass;
