-- Remove admin and client accounts from student_profiles
-- These accounts should not be in the student portal

-- First, check which profiles will be removed
SELECT 
    sp.id,
    au.email,
    au.raw_user_meta_data->>'role' as user_role,
    au.created_at
FROM student_profiles sp
JOIN auth.users au ON sp.id = au.id
WHERE au.email IN ('evenfall.adv@gmail.com', 'admin@evenfalladvantage.com')
   OR au.raw_user_meta_data->>'role' IN ('admin', 'client');

-- Delete student profiles for admin and client accounts
DELETE FROM student_profiles
WHERE id IN (
    SELECT sp.id
    FROM student_profiles sp
    JOIN auth.users au ON sp.id = au.id
    WHERE au.email IN ('evenfall.adv@gmail.com', 'admin@evenfalladvantage.com')
       OR au.raw_user_meta_data->>'role' IN ('admin', 'client')
);

-- Verify they're removed
SELECT 
    COUNT(*) as total_student_profiles,
    COUNT(CASE WHEN au.email IN ('evenfall.adv@gmail.com', 'admin@evenfalladvantage.com') THEN 1 END) as admin_client_profiles
FROM student_profiles sp
JOIN auth.users au ON sp.id = au.id;

-- Show remaining student profiles
SELECT 
    sp.id,
    au.email,
    au.created_at
FROM student_profiles sp
JOIN auth.users au ON sp.id = au.id
ORDER BY au.created_at DESC;
