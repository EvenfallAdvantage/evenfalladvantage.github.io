-- =====================================================
-- ENROLL ALL STUDENTS IN SYSTEMA SCOUT
-- =====================================================
-- This script enrolls all existing students in the Systema Scout course
-- with complimentary access (no payment required)
-- =====================================================

DO $$
DECLARE
    v_course_id UUID;
    v_student RECORD;
    v_enrolled_count INTEGER := 0;
    v_already_enrolled_count INTEGER := 0;
BEGIN
    -- Get the Systema Scout course ID
    SELECT id INTO v_course_id 
    FROM courses 
    WHERE course_code = 'systema-scout';
    
    IF v_course_id IS NULL THEN
        RAISE EXCEPTION 'Systema Scout course not found. Please run CREATE_SYSTEMA_SCOUT_COURSE.sql first.';
    END IF;
    
    RAISE NOTICE 'Found Systema Scout course: %', v_course_id;
    
    -- Loop through all students
    FOR v_student IN SELECT id, email, first_name, last_name FROM students
    LOOP
        -- Check if already enrolled
        IF EXISTS (
            SELECT 1 FROM student_course_enrollments 
            WHERE student_id = v_student.id 
            AND course_id = v_course_id
        ) THEN
            v_already_enrolled_count := v_already_enrolled_count + 1;
            RAISE NOTICE 'Student already enrolled: % (% %)', v_student.email, v_student.first_name, v_student.last_name;
        ELSE
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
                v_student.id,
                v_course_id,
                'active',
                'comp',  -- Complimentary access
                0.00,
                'USD',
                NOW()
            );
            
            v_enrolled_count := v_enrolled_count + 1;
            RAISE NOTICE 'Enrolled: % (% %)', v_student.email, v_student.first_name, v_student.last_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Enrollment Complete!';
    RAISE NOTICE 'Newly enrolled: % students', v_enrolled_count;
    RAISE NOTICE 'Already enrolled: % students', v_already_enrolled_count;
    RAISE NOTICE 'Total students processed: %', v_enrolled_count + v_already_enrolled_count;
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Show all Systema Scout enrollments
SELECT 
    s.email,
    s.first_name,
    s.last_name,
    sce.enrollment_type,
    sce.enrollment_status,
    sce.completion_percentage,
    sce.purchase_date
FROM student_course_enrollments sce
JOIN students s ON sce.student_id = s.id
JOIN courses c ON sce.course_id = c.id
WHERE c.course_code = 'systema-scout'
ORDER BY sce.purchase_date DESC;

-- Count total enrollments
SELECT 
    COUNT(*) as total_enrollments,
    COUNT(CASE WHEN enrollment_type = 'comp' THEN 1 END) as complimentary_enrollments
FROM student_course_enrollments sce
JOIN courses c ON sce.course_id = c.id
WHERE c.course_code = 'systema-scout';
