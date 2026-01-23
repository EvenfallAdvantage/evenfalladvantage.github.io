-- =====================================================
-- COURSE SYSTEM - ROW LEVEL SECURITY POLICIES
-- =====================================================
-- This script sets up RLS policies for the course system
-- Run this AFTER running COURSE_SYSTEM_SETUP.sql
-- 
-- Created: 2026-01-23
-- =====================================================

-- =====================================================
-- 1. ENABLE RLS ON ALL COURSE TABLES
-- =====================================================

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_completion_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_reviews ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. COURSES TABLE POLICIES
-- =====================================================

-- Everyone can view active courses
CREATE POLICY "Anyone can view active courses"
ON courses FOR SELECT
TO authenticated
USING (is_active = true);

-- Admins can manage all courses
CREATE POLICY "Admins can manage courses"
ON courses FOR ALL
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

-- =====================================================
-- 3. COURSE_MODULES TABLE POLICIES
-- =====================================================

-- Students can view modules for courses they're enrolled in
CREATE POLICY "Students can view enrolled course modules"
ON course_modules FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM student_course_enrollments sce
        WHERE sce.course_id = course_modules.course_id
        AND sce.student_id = auth.uid()
        AND sce.enrollment_status IN ('active', 'completed')
        AND (sce.expires_at IS NULL OR sce.expires_at > NOW())
    )
);

-- Everyone can view course modules for active courses (for browsing)
CREATE POLICY "Anyone can view active course modules"
ON course_modules FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM courses
        WHERE courses.id = course_modules.course_id
        AND courses.is_active = true
    )
);

-- Admins can manage course modules
CREATE POLICY "Admins can manage course modules"
ON course_modules FOR ALL
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

-- =====================================================
-- 4. STUDENT_COURSE_ENROLLMENTS TABLE POLICIES
-- =====================================================

-- Students can view their own enrollments
CREATE POLICY "Students can view own enrollments"
ON student_course_enrollments FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Students can insert their own enrollments (for free courses or after payment)
CREATE POLICY "Students can enroll in courses"
ON student_course_enrollments FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

-- Students can update their own enrollment metadata (last_accessed_at, etc.)
CREATE POLICY "Students can update own enrollment metadata"
ON student_course_enrollments FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (
    student_id = auth.uid()
    -- Prevent students from changing critical fields
    AND enrollment_status = (SELECT enrollment_status FROM student_course_enrollments WHERE id = student_course_enrollments.id)
    AND amount_paid = (SELECT amount_paid FROM student_course_enrollments WHERE id = student_course_enrollments.id)
);

-- Admins can manage all enrollments
CREATE POLICY "Admins can manage all enrollments"
ON student_course_enrollments FOR ALL
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

-- Instructors can view enrollments for their students
CREATE POLICY "Instructors can view student enrollments"
ON student_course_enrollments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM instructors
        WHERE id = auth.uid()
        AND is_active = true
    )
);

-- =====================================================
-- 5. PAYMENT_TRANSACTIONS TABLE POLICIES
-- =====================================================

-- Students can view their own payment history
CREATE POLICY "Students can view own payments"
ON payment_transactions FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Only system/backend can create payment records (via Edge Functions)
-- Students cannot directly insert payments
CREATE POLICY "Service role can create payments"
ON payment_transactions FOR INSERT
TO service_role
WITH CHECK (true);

-- Only system/backend can update payment status
CREATE POLICY "Service role can update payments"
ON payment_transactions FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Admins can view all payment transactions
CREATE POLICY "Admins can view all payments"
ON payment_transactions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM administrators 
        WHERE user_id = auth.uid()
    )
);

-- Admins can manage payments (refunds, etc.)
CREATE POLICY "Admins can manage payments"
ON payment_transactions FOR ALL
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

-- =====================================================
-- 6. COURSE_COMPLETION_REQUIREMENTS TABLE POLICIES
-- =====================================================

-- Everyone can view completion requirements for active courses
CREATE POLICY "Anyone can view course requirements"
ON course_completion_requirements FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM courses
        WHERE courses.id = course_completion_requirements.course_id
        AND courses.is_active = true
    )
);

-- Admins can manage completion requirements
CREATE POLICY "Admins can manage requirements"
ON course_completion_requirements FOR ALL
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

-- =====================================================
-- 7. COURSE_REVIEWS TABLE POLICIES
-- =====================================================

-- Everyone can view approved reviews
CREATE POLICY "Anyone can view approved reviews"
ON course_reviews FOR SELECT
TO authenticated
USING (is_approved = true);

-- Students can view their own reviews (even if not approved)
CREATE POLICY "Students can view own reviews"
ON course_reviews FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Students can create reviews for courses they've enrolled in
CREATE POLICY "Students can create reviews for enrolled courses"
ON course_reviews FOR INSERT
TO authenticated
WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM student_course_enrollments
        WHERE student_id = auth.uid()
        AND course_id = course_reviews.course_id
        AND enrollment_status IN ('active', 'completed')
    )
);

-- Students can update their own reviews
CREATE POLICY "Students can update own reviews"
ON course_reviews FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- Students can delete their own reviews
CREATE POLICY "Students can delete own reviews"
ON course_reviews FOR DELETE
TO authenticated
USING (student_id = auth.uid());

-- Admins can manage all reviews
CREATE POLICY "Admins can manage all reviews"
ON course_reviews FOR ALL
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

-- =====================================================
-- 8. GRANT EXECUTE PERMISSIONS ON HELPER FUNCTIONS
-- =====================================================

-- Grant execute on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION student_has_course_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION student_has_module_access(UUID, UUID) TO authenticated;

-- =====================================================
-- 9. VERIFICATION
-- =====================================================

SELECT 'Course system RLS policies created successfully!' as status;

-- Show all policies for course tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN (
    'courses',
    'course_modules',
    'student_course_enrollments',
    'payment_transactions',
    'course_completion_requirements',
    'course_reviews'
)
ORDER BY tablename, policyname;
