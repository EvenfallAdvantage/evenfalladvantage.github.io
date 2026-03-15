-- =====================================================
-- MANUAL COURSE ENROLLMENT (Stripe Placeholder)
-- =====================================================
-- Use this script to manually enroll students in courses
-- until Stripe payment processing is set up
-- =====================================================

-- =====================================================
-- OPTION 1: Enroll ALL existing students in a course
-- =====================================================
-- This gives all current students free access to the specified course

DO $$
DECLARE
    v_course_id UUID;
    v_student RECORD;
    v_enrolled_count INTEGER := 0;
BEGIN
    -- Get the Unarmed Guard Core course ID
    SELECT id INTO v_course_id 
    FROM courses 
    WHERE course_code = 'unarmed-guard-core';
    
    IF v_course_id IS NULL THEN
        RAISE EXCEPTION 'Course not found. Make sure you ran MIGRATE_UNARMED_GUARD_CORE.sql first.';
    END IF;
    
    -- Loop through all students
    FOR v_student IN SELECT id, email FROM students
    LOOP
        -- Insert enrollment if it doesn't exist
        INSERT INTO student_course_enrollments (
            student_id,
            course_id,
            enrollment_status,
            enrollment_type,
            amount_paid,
            currency,
            purchase_date
        ) VALUES (
            v_student.id,
            v_course_id,
            'active',
            'comp',  -- Complimentary access
            0.00,
            'USD',
            NOW()
        )
        ON CONFLICT (student_id, course_id) 
        DO UPDATE SET
            enrollment_status = 'active',
            updated_at = NOW();
        
        v_enrolled_count := v_enrolled_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Successfully enrolled % students in Unarmed Guard Core', v_enrolled_count;
END $$;

-- =====================================================
-- OPTION 2: Enroll a SPECIFIC student by email
-- =====================================================
-- Replace 'student@example.com' with the actual student email

/*
DO $$
DECLARE
    v_course_id UUID;
    v_student_id UUID;
BEGIN
    -- Get course ID
    SELECT id INTO v_course_id 
    FROM courses 
    WHERE course_code = 'unarmed-guard-core';
    
    -- Get student ID by email
    SELECT id INTO v_student_id 
    FROM students 
    WHERE email = 'student@example.com';  -- CHANGE THIS EMAIL
    
    IF v_course_id IS NULL THEN
        RAISE EXCEPTION 'Course not found';
    END IF;
    
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Student not found with that email';
    END IF;
    
    -- Insert enrollment
    INSERT INTO student_course_enrollments (
        student_id,
        course_id,
        enrollment_status,
        enrollment_type,
        amount_paid,
        currency,
        purchase_date
    ) VALUES (
        v_student_id,
        v_course_id,
        'active',
        'comp',
        0.00,
        'USD',
        NOW()
    )
    ON CONFLICT (student_id, course_id) 
    DO UPDATE SET
        enrollment_status = 'active',
        updated_at = NOW();
    
    RAISE NOTICE 'Successfully enrolled student in course';
END $$;
*/

-- =====================================================
-- OPTION 3: Enroll multiple specific students
-- =====================================================
-- Add student emails to the array

/*
DO $$
DECLARE
    v_course_id UUID;
    v_student_email TEXT;
    v_student_id UUID;
    v_enrolled_count INTEGER := 0;
    v_student_emails TEXT[] := ARRAY[
        'student1@example.com',
        'student2@example.com',
        'student3@example.com'
        -- Add more emails as needed
    ];
BEGIN
    -- Get course ID
    SELECT id INTO v_course_id 
    FROM courses 
    WHERE course_code = 'unarmed-guard-core';
    
    IF v_course_id IS NULL THEN
        RAISE EXCEPTION 'Course not found';
    END IF;
    
    -- Loop through email list
    FOREACH v_student_email IN ARRAY v_student_emails
    LOOP
        -- Get student ID
        SELECT id INTO v_student_id 
        FROM students 
        WHERE email = v_student_email;
        
        IF v_student_id IS NOT NULL THEN
            -- Insert enrollment
            INSERT INTO student_course_enrollments (
                student_id,
                course_id,
                enrollment_status,
                enrollment_type,
                amount_paid,
                currency,
                purchase_date
            ) VALUES (
                v_student_id,
                v_course_id,
                'active',
                'comp',
                0.00,
                'USD',
                NOW()
            )
            ON CONFLICT (student_id, course_id) 
            DO UPDATE SET
                enrollment_status = 'active',
                updated_at = NOW();
            
            v_enrolled_count := v_enrolled_count + 1;
            RAISE NOTICE 'Enrolled: %', v_student_email;
        ELSE
            RAISE NOTICE 'Student not found: %', v_student_email;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Successfully enrolled % students', v_enrolled_count;
END $$;
*/

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check all enrollments
SELECT 
    s.email,
    s.first_name,
    s.last_name,
    c.course_name,
    sce.enrollment_type,
    sce.enrollment_status,
    sce.completion_percentage,
    sce.purchase_date
FROM student_course_enrollments sce
JOIN students s ON sce.student_id = s.id
JOIN courses c ON sce.course_id = c.id
ORDER BY sce.purchase_date DESC;

-- Count enrollments by course
SELECT 
    c.course_name,
    COUNT(*) as total_enrollments,
    COUNT(CASE WHEN sce.enrollment_type = 'comp' THEN 1 END) as complimentary,
    COUNT(CASE WHEN sce.enrollment_type = 'paid' THEN 1 END) as paid
FROM student_course_enrollments sce
JOIN courses c ON sce.course_id = c.id
GROUP BY c.course_name;

-- =====================================================
-- REMOVE ENROLLMENT (if needed)
-- =====================================================

/*
-- Remove specific student enrollment
DELETE FROM student_course_enrollments
WHERE student_id = (SELECT id FROM students WHERE email = 'student@example.com')
AND course_id = (SELECT id FROM courses WHERE course_code = 'unarmed-guard-core');

-- Remove all enrollments for a course
DELETE FROM student_course_enrollments
WHERE course_id = (SELECT id FROM courses WHERE course_code = 'unarmed-guard-core');
*/

-- =====================================================
-- NOTES
-- =====================================================
-- 
-- enrollment_type options:
--   'comp' = Complimentary (free access granted by admin)
--   'free' = Free course (no payment required)
--   'paid' = Paid through Stripe
--   'trial' = Trial access
--
-- enrollment_status options:
--   'active' = Currently enrolled, can access content
--   'completed' = Finished all requirements
--   'expired' = Time-limited access expired
--   'cancelled' = Enrollment cancelled
--
-- When you set up Stripe later, paid enrollments will be
-- created automatically by the Edge Functions.
--
