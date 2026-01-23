-- =====================================================
-- COURSE SYSTEM WITH PAYWALL - DATABASE SETUP
-- =====================================================
-- This script creates the complete course system infrastructure
-- Run this in your Supabase SQL Editor
-- 
-- Created: 2026-01-23
-- Purpose: Enable course-based learning with payment integration
-- =====================================================

-- =====================================================
-- 1. COURSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code TEXT UNIQUE NOT NULL,
    course_name TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    duration_hours INTEGER,
    difficulty_level TEXT CHECK (difficulty_level IN ('Beginner', 'Intermediate', 'Advanced')),
    icon TEXT DEFAULT 'fa-graduation-cap',
    thumbnail_url TEXT,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    prerequisites TEXT[], -- Array of course_codes that must be completed first
    learning_objectives TEXT[], -- Array of learning objectives
    target_audience TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for courses
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(course_code);
CREATE INDEX IF NOT EXISTS idx_courses_active ON courses(is_active);
CREATE INDEX IF NOT EXISTS idx_courses_featured ON courses(is_featured);
CREATE INDEX IF NOT EXISTS idx_courses_display_order ON courses(display_order);

-- =====================================================
-- 2. COURSE_MODULES TABLE (Junction Table)
-- =====================================================
CREATE TABLE IF NOT EXISTS course_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
    module_id UUID REFERENCES training_modules(id) ON DELETE CASCADE NOT NULL,
    module_order INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT true,
    unlock_after_module_id UUID REFERENCES training_modules(id), -- Sequential unlocking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(course_id, module_id),
    UNIQUE(course_id, module_order)
);

-- Create indexes for course_modules
CREATE INDEX IF NOT EXISTS idx_course_modules_course ON course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_module ON course_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_order ON course_modules(course_id, module_order);

-- =====================================================
-- 3. STUDENT_COURSE_ENROLLMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS student_course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
    enrollment_status TEXT DEFAULT 'active' CHECK (enrollment_status IN ('active', 'completed', 'expired', 'cancelled')),
    enrollment_type TEXT DEFAULT 'paid' CHECK (enrollment_type IN ('paid', 'free', 'trial', 'comp')),
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completion_date TIMESTAMP WITH TIME ZONE,
    completion_percentage DECIMAL(5,2) DEFAULT 0.00,
    payment_id TEXT, -- Reference to payment transaction
    amount_paid DECIMAL(10,2),
    currency TEXT DEFAULT 'USD',
    expires_at TIMESTAMP WITH TIME ZONE, -- For time-limited access
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, course_id) -- One enrollment per student per course
);

-- Create indexes for student_course_enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON student_course_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON student_course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON student_course_enrollments(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_enrollments_payment ON student_course_enrollments(payment_id);

-- =====================================================
-- 4. PAYMENT_TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    payment_provider TEXT NOT NULL CHECK (payment_provider IN ('stripe', 'paypal', 'manual', 'comp')),
    transaction_id TEXT UNIQUE, -- External payment provider transaction ID
    payment_intent_id TEXT, -- Stripe PaymentIntent ID
    checkout_session_id TEXT, -- Stripe Checkout Session ID
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')),
    payment_method TEXT, -- 'card', 'bank_transfer', etc.
    customer_email TEXT,
    customer_name TEXT,
    billing_address JSONB,
    metadata JSONB, -- Additional payment metadata
    error_message TEXT,
    refund_amount DECIMAL(10,2),
    refund_reason TEXT,
    refunded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for payment_transactions
CREATE INDEX IF NOT EXISTS idx_payments_student ON payment_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_course ON payment_transactions(course_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payment_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payment_transactions(created_at);

-- =====================================================
-- 5. COURSE_COMPLETION_REQUIREMENTS TABLE
-- =====================================================
-- Tracks what's needed to complete a course
CREATE TABLE IF NOT EXISTS course_completion_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
    requirement_type TEXT NOT NULL CHECK (requirement_type IN ('module_completion', 'assessment_pass', 'minimum_score', 'time_spent')),
    requirement_value JSONB, -- Flexible storage for different requirement types
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_completion_reqs_course ON course_completion_requirements(course_id);

-- =====================================================
-- 6. COURSE_REVIEWS TABLE (Optional - for future)
-- =====================================================
CREATE TABLE IF NOT EXISTS course_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(course_id, student_id) -- One review per student per course
);

CREATE INDEX IF NOT EXISTS idx_reviews_course ON course_reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_reviews_student ON course_reviews(student_id);
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON course_reviews(is_approved);

-- =====================================================
-- 7. UPDATE EXISTING TABLES
-- =====================================================

-- Add course_id to training_modules for backward compatibility
ALTER TABLE training_modules 
ADD COLUMN IF NOT EXISTS default_course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_training_modules_course ON training_modules(default_course_id);

-- =====================================================
-- 8. TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Courses updated_at trigger
CREATE OR REPLACE FUNCTION update_courses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION update_courses_updated_at();

-- Enrollments updated_at trigger
CREATE OR REPLACE FUNCTION update_enrollments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enrollments_updated_at
    BEFORE UPDATE ON student_course_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION update_enrollments_updated_at();

-- Payments updated_at trigger
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payments_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();

-- =====================================================
-- 9. FUNCTION TO UPDATE COURSE COMPLETION PERCENTAGE
-- =====================================================

CREATE OR REPLACE FUNCTION update_course_completion_percentage()
RETURNS TRIGGER AS $$
DECLARE
    v_total_modules INTEGER;
    v_completed_modules INTEGER;
    v_percentage DECIMAL(5,2);
    v_course_id UUID;
BEGIN
    -- Get the course_id from the module
    SELECT cm.course_id INTO v_course_id
    FROM course_modules cm
    WHERE cm.module_id = NEW.module_id
    LIMIT 1;
    
    IF v_course_id IS NOT NULL THEN
        -- Count total required modules in the course
        SELECT COUNT(*) INTO v_total_modules
        FROM course_modules
        WHERE course_id = v_course_id AND is_required = true;
        
        -- Count completed required modules for this student
        SELECT COUNT(DISTINCT cm.module_id) INTO v_completed_modules
        FROM course_modules cm
        INNER JOIN student_module_progress smp ON cm.module_id = smp.module_id
        WHERE cm.course_id = v_course_id
        AND cm.is_required = true
        AND smp.student_id = NEW.student_id
        AND smp.status = 'completed';
        
        -- Calculate percentage
        IF v_total_modules > 0 THEN
            v_percentage := (v_completed_modules::DECIMAL / v_total_modules::DECIMAL) * 100;
        ELSE
            v_percentage := 0;
        END IF;
        
        -- Update enrollment record
        UPDATE student_course_enrollments
        SET 
            completion_percentage = v_percentage,
            completion_date = CASE WHEN v_percentage >= 100 THEN NOW() ELSE NULL END,
            enrollment_status = CASE WHEN v_percentage >= 100 THEN 'completed' ELSE enrollment_status END,
            updated_at = NOW()
        WHERE student_id = NEW.student_id AND course_id = v_course_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update course completion when module progress changes
CREATE TRIGGER trigger_update_course_completion
    AFTER INSERT OR UPDATE ON student_module_progress
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION update_course_completion_percentage();

-- =====================================================
-- 10. HELPER FUNCTIONS
-- =====================================================

-- Function to check if student has access to a course
CREATE OR REPLACE FUNCTION student_has_course_access(
    p_student_id UUID,
    p_course_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_access BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM student_course_enrollments
        WHERE student_id = p_student_id
        AND course_id = p_course_id
        AND enrollment_status IN ('active', 'completed')
        AND (expires_at IS NULL OR expires_at > NOW())
    ) INTO v_has_access;
    
    RETURN v_has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if student has access to a module
CREATE OR REPLACE FUNCTION student_has_module_access(
    p_student_id UUID,
    p_module_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_access BOOLEAN;
BEGIN
    -- Check if module belongs to any course the student is enrolled in
    SELECT EXISTS(
        SELECT 1
        FROM course_modules cm
        INNER JOIN student_course_enrollments sce ON cm.course_id = sce.course_id
        WHERE cm.module_id = p_module_id
        AND sce.student_id = p_student_id
        AND sce.enrollment_status IN ('active', 'completed')
        AND (sce.expires_at IS NULL OR sce.expires_at > NOW())
    ) INTO v_has_access;
    
    RETURN v_has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 11. VERIFICATION
-- =====================================================

SELECT 'Course system tables created successfully!' as status;

-- Display created tables
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN (
    'courses',
    'course_modules',
    'student_course_enrollments',
    'payment_transactions',
    'course_completion_requirements',
    'course_reviews'
)
ORDER BY table_name;
