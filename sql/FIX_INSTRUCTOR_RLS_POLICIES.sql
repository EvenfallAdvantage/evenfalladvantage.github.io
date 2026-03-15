-- =====================================================
-- FIX INSTRUCTOR PORTAL RLS POLICIES
-- =====================================================
-- This fixes the infinite recursion error in class_enrollments policies

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Instructors can manage enrollments" ON class_enrollments;
DROP POLICY IF EXISTS "Students can view their enrolled classes" ON scheduled_classes;

-- Recreate class_enrollments policies without circular reference
-- Simpler approach: Allow instructors to see all enrollments (they need this for management)
CREATE POLICY "Instructors can view all enrollments" ON class_enrollments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM instructors 
            WHERE id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Instructors can insert enrollments" ON class_enrollments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM instructors 
            WHERE id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Instructors can update enrollments" ON class_enrollments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM instructors 
            WHERE id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Instructors can delete enrollments" ON class_enrollments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM instructors 
            WHERE id = auth.uid() AND is_active = true
        )
    );

-- Students can view their own enrollments (no circular reference)
CREATE POLICY "Students view own enrollments" ON class_enrollments
    FOR SELECT USING (auth.uid() = student_id);

-- Recreate the scheduled_classes policy for students viewing enrolled classes
-- This time without causing recursion
CREATE POLICY "Students view enrolled classes" ON scheduled_classes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM class_enrollments 
            WHERE class_enrollments.class_id = scheduled_classes.id 
            AND class_enrollments.student_id = auth.uid()
        )
    );

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this to verify policies are created:
-- SELECT schemaname, tablename, policyname 
-- FROM pg_policies 
-- WHERE tablename IN ('scheduled_classes', 'class_enrollments')
-- ORDER BY tablename, policyname;
