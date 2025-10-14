-- Administrator Setup SQL
-- Run this in your Supabase SQL Editor

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

-- RLS Policies for administrators
-- Admins can view all admin records
CREATE POLICY "Admins can view all admins"
    ON administrators FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM administrators
            WHERE administrators.user_id = auth.uid()
        )
    );

-- Admins can update their own record
CREATE POLICY "Admins can update own record"
    ON administrators FOR UPDATE
    USING (user_id = auth.uid());

-- Only existing admins can create new admins
CREATE POLICY "Admins can create new admins"
    ON administrators FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM administrators
            WHERE administrators.user_id = auth.uid()
        )
    );

-- Create first admin account (CHANGE THESE VALUES!)
-- First, create the auth user in Supabase Dashboard -> Authentication -> Users
-- Then run this with the user's ID:

-- INSERT INTO administrators (user_id, first_name, last_name, email)
-- VALUES (
--     'YOUR_USER_ID_HERE',
--     'Admin',
--     'User',
--     'admin@evenfalladvantage.com'
-- );

-- Grant admins access to view all tables (optional, for read access)
-- Note: Admins will use service role for write operations

SELECT 'Administrators table created successfully!' as status;
SELECT 'Remember to create your first admin user in Supabase Auth, then add them to the administrators table!' as reminder;
