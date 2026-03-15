-- Fix Dashboard Errors
-- Run this to fix the remaining console errors

-- ============================================
-- 1. Fix certifications foreign key
-- ============================================

-- Drop existing foreign key if it exists
ALTER TABLE certifications 
DROP CONSTRAINT IF EXISTS certifications_student_id_fkey;

-- Add proper foreign key relationship
ALTER TABLE certifications
ADD CONSTRAINT certifications_student_id_fkey 
FOREIGN KEY (student_id) 
REFERENCES students(id) 
ON DELETE CASCADE;

-- ============================================
-- 2. Add RLS policies for training_modules (existing table)
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Everyone can view training modules" ON training_modules;
DROP POLICY IF EXISTS "Admins can manage training modules" ON training_modules;

-- Allow everyone to view training modules
CREATE POLICY "Everyone can view training modules"
ON training_modules FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage training modules
CREATE POLICY "Admins can manage training modules"
ON training_modules FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM administrators WHERE user_id = auth.uid())
);

-- ============================================
-- 3. Verify fixes
-- ============================================

SELECT 'Fixes applied successfully!' as status;

-- Check foreign key
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name='certifications';

-- Check training_modules table
SELECT COUNT(*) as module_count FROM training_modules;
