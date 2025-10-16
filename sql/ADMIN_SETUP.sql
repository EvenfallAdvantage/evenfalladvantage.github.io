-- Administrator Setup SQL
-- Run this in your Supabase SQL Editor

-- Drop existing table if needed (CAREFUL - this deletes data!)
-- DROP TABLE IF EXISTS administrators CASCADE;

-- Create administrators table
CREATE TABLE IF NOT EXISTS administrators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_administrators_user_id ON administrators(user_id);
CREATE INDEX IF NOT EXISTS idx_administrators_email ON administrators(email);

-- Enable Row Level Security
ALTER TABLE administrators ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all admins" ON administrators;
DROP POLICY IF EXISTS "Admins can update own record" ON administrators;
DROP POLICY IF EXISTS "Admins can create new admins" ON administrators;
DROP POLICY IF EXISTS "Allow authenticated users to read admins" ON administrators;

-- Simple policy: Allow authenticated users to read their own admin record
CREATE POLICY "Allow authenticated users to read admins"
    ON administrators FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Allow admins to update their own record
CREATE POLICY "Admins can update own record"
    ON administrators FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- Allow admins to insert (for creating new admins)
CREATE POLICY "Admins can create new admins"
    ON administrators FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- IMPORTANT: Now insert your admin user
-- Replace 'f3aec261-501c-4857-99c2-273bf14cda23' with your actual user ID

INSERT INTO administrators (user_id, first_name, last_name, email)
VALUES (
    'f3aec261-501c-4857-99c2-273bf14cda23',
    'Admin',
    'User',
    'admin@evenfalladvantage.com'
)
ON CONFLICT (user_id) DO NOTHING;

SELECT 'Administrators table created successfully!' as status;
SELECT * FROM administrators;
