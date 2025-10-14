-- Fix Row-Level Security for module_slides table
-- Run this in Supabase SQL Editor to fix the 403 error

-- ============================================
-- 1. Drop existing policies
-- ============================================

DROP POLICY IF EXISTS "Everyone can view slides" ON module_slides;
DROP POLICY IF EXISTS "Admins can manage slides" ON module_slides;
DROP POLICY IF EXISTS "Admins can insert slides" ON module_slides;
DROP POLICY IF EXISTS "Admins can update slides" ON module_slides;
DROP POLICY IF EXISTS "Admins can delete slides" ON module_slides;

-- ============================================
-- 2. Create new policies
-- ============================================

-- Allow authenticated users to view slides
CREATE POLICY "Anyone can view slides"
ON module_slides FOR SELECT
TO authenticated
USING (true);

-- Allow admins to insert slides
CREATE POLICY "Admins can insert slides"
ON module_slides FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM administrators 
    WHERE user_id = auth.uid()
  )
);

-- Allow admins to update slides
CREATE POLICY "Admins can update slides"
ON module_slides FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM administrators 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM administrators 
    WHERE user_id = auth.uid()
  )
);

-- Allow admins to delete slides
CREATE POLICY "Admins can delete slides"
ON module_slides FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM administrators 
    WHERE user_id = auth.uid()
  )
);

-- ============================================
-- 3. Verify policies
-- ============================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'module_slides'
ORDER BY policyname;

SELECT 'Module slides RLS policies fixed successfully!' as status;
