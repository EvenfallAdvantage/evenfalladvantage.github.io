-- Test queries to debug the Browse Candidates issue

-- 1. Check if students exist
SELECT COUNT(*) as student_count FROM students;

-- 2. Check if student_profiles exist
SELECT COUNT(*) as profile_count FROM student_profiles;

-- 3. Check the relationship - see if student_id matches
SELECT 
    s.id as student_id,
    s.first_name,
    s.last_name,
    sp.student_id as profile_student_id,
    sp.profile_visible,
    CASE 
        WHEN sp.student_id IS NULL THEN 'NO PROFILE'
        WHEN s.id = sp.student_id THEN 'MATCH'
        ELSE 'MISMATCH'
    END as relationship_status
FROM students s
LEFT JOIN student_profiles sp ON s.id = sp.student_id;

-- 4. Check what the actual foreign key column name is
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'student_profiles'
ORDER BY ordinal_position;

-- 5. Try the exact query the client portal is using
SELECT 
    s.id,
    s.first_name,
    s.last_name,
    s.email,
    sp.*
FROM students s
LEFT JOIN student_profiles sp ON s.id = sp.student_id
WHERE sp.profile_visible IS NOT FALSE;
