-- Fix RLS policies for client portal access
-- The client portal needs to read student_module_progress but RLS is blocking it

-- STEP 1: Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'student_module_progress';

-- STEP 2: Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'student_module_progress';

-- STEP 3: Create policy to allow authenticated users to read all student module progress
-- This allows clients to see candidate progress
-- Note: If policy already exists, you'll get an error - that's OK, just skip to STEP 4

CREATE POLICY "Allow authenticated users to view student module progress"
ON student_module_progress
FOR SELECT
TO authenticated
USING (true);

-- STEP 4: Verify the policy was created
SELECT 
    policyname,
    cmd,
    roles,
    qual
FROM pg_policies 
WHERE tablename = 'student_module_progress';
