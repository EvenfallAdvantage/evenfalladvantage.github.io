-- =====================================================
-- FIX ALL RLS POLICIES FOR ASSESSMENT SYSTEM
-- =====================================================
-- Ensure all tables needed for assessments have proper RLS policies
-- =====================================================

-- 1. Training Modules - students need to read module info
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view training modules" ON training_modules;
DROP POLICY IF EXISTS "Everyone can view training modules" ON training_modules;
DROP POLICY IF EXISTS "Authenticated users can view training modules" ON training_modules;

CREATE POLICY "Authenticated users can view training modules"
ON training_modules FOR SELECT
TO authenticated
USING (true);

-- 2. Assessments - students need to read assessment info
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view assessments" ON assessments;
DROP POLICY IF EXISTS "Authenticated users can view assessments" ON assessments;

CREATE POLICY "Authenticated users can view assessments"
ON assessments FOR SELECT
TO authenticated
USING (true);

-- 3. Assessment Questions - students need to read questions
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view questions" ON assessment_questions;
DROP POLICY IF EXISTS "Authenticated users can view questions" ON assessment_questions;

CREATE POLICY "Authenticated users can view questions"
ON assessment_questions FOR SELECT
TO authenticated
USING (true);

-- Verify all policies were created
SELECT 
    tablename,
    policyname,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('training_modules', 'assessments', 'assessment_questions')
ORDER BY tablename, policyname;
