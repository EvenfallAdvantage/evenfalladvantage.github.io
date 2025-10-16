-- Create missing student profiles for users who have auth accounts but no profile
-- This fixes the foreign key constraint error

-- First, check which auth users don't have student profiles
SELECT 
    au.id as auth_user_id,
    au.email,
    au.created_at,
    sp.id as profile_id
FROM auth.users au
LEFT JOIN student_profiles sp ON au.id = sp.id
WHERE sp.id IS NULL
ORDER BY au.created_at DESC;

-- Create student profiles for any auth users that don't have them
INSERT INTO student_profiles (id, email, first_name, last_name, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'first_name', split_part(au.email, '@', 1)) as first_name,
    COALESCE(au.raw_user_meta_data->>'last_name', 'User') as last_name,
    au.created_at,
    NOW()
FROM auth.users au
LEFT JOIN student_profiles sp ON au.id = sp.id
WHERE sp.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Verify all users now have profiles
SELECT 
    COUNT(*) as total_auth_users,
    COUNT(sp.id) as users_with_profiles,
    COUNT(*) - COUNT(sp.id) as users_missing_profiles
FROM auth.users au
LEFT JOIN student_profiles sp ON au.id = sp.id;

-- Show the newly created profiles
SELECT 
    sp.id,
    sp.email,
    sp.first_name,
    sp.last_name,
    sp.created_at
FROM student_profiles sp
WHERE sp.id IN (
    SELECT au.id 
    FROM auth.users au
    WHERE au.created_at > NOW() - INTERVAL '1 day'
)
ORDER BY sp.created_at DESC;
