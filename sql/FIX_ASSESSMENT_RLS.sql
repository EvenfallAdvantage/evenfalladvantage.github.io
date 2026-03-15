-- =====================================================
-- FIX ASSESSMENTS TABLE RLS POLICIES
-- =====================================================
-- The assessments table needs RLS policies to allow
-- authenticated users to read assessment data
-- =====================================================

-- Enable RLS on assessments table if not already enabled
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Students can view assessments" ON assessments;
DROP POLICY IF EXISTS "Authenticated users can view assessments" ON assessments;

-- Create policy to allow all authenticated users to view assessments
CREATE POLICY "Authenticated users can view assessments"
ON assessments FOR SELECT
TO authenticated
USING (true);

-- Verify the policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'assessments';
