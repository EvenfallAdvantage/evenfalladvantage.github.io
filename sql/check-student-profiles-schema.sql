-- Check the actual schema of student_profiles table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'student_profiles'
ORDER BY ordinal_position;
