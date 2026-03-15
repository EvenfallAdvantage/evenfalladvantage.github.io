-- Create missing student profiles for users who have auth accounts but no profile
-- This fixes the foreign key constraint error

-- First, check which auth users don't have student profiles
-- Exclude admin and client accounts
SELECT 
    au.id as auth_user_id,
    au.email,
    au.raw_user_meta_data->>'role' as user_role,
    au.created_at,
    sp.id as profile_id
FROM auth.users au
LEFT JOIN student_profiles sp ON au.id = sp.id
WHERE sp.id IS NULL
  AND au.email NOT IN ('evenfall.adv@gmail.com', 'admin@evenfalladvantage.com')
  AND COALESCE(au.raw_user_meta_data->>'role', 'student') NOT IN ('admin', 'client')
ORDER BY au.created_at DESC;

-- Create student profiles for any auth users that don't have them
-- Note: Using only the 'id' column - other columns will be populated when user updates their profile
-- Exclude admin and client accounts
INSERT INTO student_profiles (id)
SELECT 
    au.id
FROM auth.users au
LEFT JOIN student_profiles sp ON au.id = sp.id
WHERE sp.id IS NULL
  AND au.email NOT IN ('evenfall.adv@gmail.com', 'admin@evenfalladvantage.com')
  AND COALESCE(au.raw_user_meta_data->>'role', 'student') NOT IN ('admin', 'client')
ON CONFLICT (id) DO NOTHING;

-- Verify all users now have profiles
SELECT 
    COUNT(*) as total_auth_users,
    COUNT(sp.id) as users_with_profiles,
    COUNT(*) - COUNT(sp.id) as users_missing_profiles
FROM auth.users au
LEFT JOIN student_profiles sp ON au.id = sp.id;

-- Show all student profiles with their auth email
SELECT 
    sp.id,
    au.email,
    au.created_at
FROM student_profiles sp
JOIN auth.users au ON sp.id = au.id
ORDER BY au.created_at DESC
LIMIT 10;
