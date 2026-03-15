-- =====================================================
-- MIGRATE EXISTING MODULES TO "UNARMED GUARD CORE" COURSE
-- =====================================================
-- This script creates the first course and links existing modules 0-7
-- Run this AFTER running COURSE_SYSTEM_SETUP.sql
-- 
-- Created: 2026-01-23
-- =====================================================

-- =====================================================
-- 1. CREATE "UNARMED GUARD CORE" COURSE
-- =====================================================

INSERT INTO courses (
    course_code,
    course_name,
    description,
    short_description,
    price,
    duration_hours,
    difficulty_level,
    icon,
    is_active,
    is_featured,
    display_order,
    learning_objectives,
    target_audience
) VALUES (
    'unarmed-guard-core',
    'Unarmed Guard Core',
    'Comprehensive training program covering essential security guard competencies including radio communications, emergency medical response, threat assessment, incident command systems, cultural competency, crowd management, and legal aspects of security work. This course prepares students for professional unarmed security positions at events, venues, and facilities.',
    'Essential training for professional unarmed security guards covering 8 core modules from communications to legal aspects.',
    299.99,
    16,
    'Beginner',
    'fa-shield-halved',
    true,
    true,
    1,
    ARRAY[
        'Master professional radio communication protocols and procedures',
        'Perform life-saving hemorrhage control using STOP THE BLEED® techniques',
        'Identify and assess security threats with enhanced situational awareness',
        'Understand and apply NIMS/ICS principles in emergency situations',
        'Interact professionally with diverse populations and accessibility needs',
        'Implement effective crowd management and public safety strategies',
        'Apply appropriate use of force within legal boundaries',
        'Demonstrate comprehensive security guard competencies'
    ],
    'Aspiring security professionals, event security staff, venue security personnel, and individuals seeking entry-level positions in the private security industry.'
)
ON CONFLICT (course_code) DO NOTHING
RETURNING id, course_code, course_name;

-- =====================================================
-- 2. LINK MODULES TO COURSE
-- =====================================================

-- Get the course ID
DO $$
DECLARE
    v_course_id UUID;
    v_module_id UUID;
BEGIN
    -- Get course ID
    SELECT id INTO v_course_id FROM courses WHERE course_code = 'unarmed-guard-core';
    
    IF v_course_id IS NULL THEN
        RAISE EXCEPTION 'Course "unarmed-guard-core" not found. Please run the INSERT statement first.';
    END IF;
    
    -- Module 0: Welcome Materials
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'welcome-materials';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 0, false)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    -- Module 1: Radio Communications
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'communication-protocols';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 1, true)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    -- Module 2: STOP THE BLEED
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'stop-the-bleed';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 2, true)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    -- Module 3: Threat Assessment
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'threat-assessment';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 3, true)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    -- Module 4: ICS-100
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'ics-100';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 4, true)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    -- Module 5: Diverse Populations
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'diverse-population';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 5, true)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    -- Module 6: Crowd Management
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'crowd-management';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 6, true)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    -- Module 7: Use of Force
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'use-of-force';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 7, true)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    RAISE NOTICE 'Successfully linked modules to Unarmed Guard Core course';
END $$;

-- =====================================================
-- 3. CREATE COMPLETION REQUIREMENTS
-- =====================================================

DO $$
DECLARE
    v_course_id UUID;
BEGIN
    SELECT id INTO v_course_id FROM courses WHERE course_code = 'unarmed-guard-core';
    
    -- Requirement: Complete all required modules
    INSERT INTO course_completion_requirements (
        course_id,
        requirement_type,
        requirement_value,
        is_required
    ) VALUES (
        v_course_id,
        'module_completion',
        '{"percentage": 100, "required_only": true}'::jsonb,
        true
    );
    
    -- Requirement: Pass all assessments with 70% or higher
    INSERT INTO course_completion_requirements (
        course_id,
        requirement_type,
        requirement_value,
        is_required
    ) VALUES (
        v_course_id,
        'minimum_score',
        '{"score": 70, "all_assessments": true}'::jsonb,
        true
    );
END $$;

-- =====================================================
-- 4. GRANT EXISTING STUDENTS FREE ACCESS (OPTIONAL)
-- =====================================================
-- Uncomment this section if you want to give all existing students
-- free access to the Unarmed Guard Core course

/*
DO $$
DECLARE
    v_course_id UUID;
    v_student RECORD;
BEGIN
    SELECT id INTO v_course_id FROM courses WHERE course_code = 'unarmed-guard-core';
    
    FOR v_student IN SELECT id FROM students WHERE id IS NOT NULL
    LOOP
        INSERT INTO student_course_enrollments (
            student_id,
            course_id,
            enrollment_status,
            enrollment_type,
            amount_paid,
            purchase_date
        ) VALUES (
            v_student.id,
            v_course_id,
            'active',
            'comp',
            0.00,
            NOW()
        )
        ON CONFLICT (student_id, course_id) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'Granted free access to all existing students';
END $$;
*/

-- =====================================================
-- 5. VERIFICATION
-- =====================================================

-- Show course details
SELECT 
    c.course_name,
    c.course_code,
    c.price,
    c.duration_hours,
    COUNT(cm.id) as total_modules,
    COUNT(CASE WHEN cm.is_required THEN 1 END) as required_modules
FROM courses c
LEFT JOIN course_modules cm ON c.id = cm.course_id
WHERE c.course_code = 'unarmed-guard-core'
GROUP BY c.id, c.course_name, c.course_code, c.price, c.duration_hours;

-- Show linked modules
SELECT 
    cm.module_order,
    tm.module_name,
    tm.module_code,
    cm.is_required,
    tm.duration_minutes
FROM course_modules cm
INNER JOIN training_modules tm ON cm.module_id = tm.id
INNER JOIN courses c ON cm.course_id = c.id
WHERE c.course_code = 'unarmed-guard-core'
ORDER BY cm.module_order;

-- Show completion requirements
SELECT 
    c.course_name,
    ccr.requirement_type,
    ccr.requirement_value,
    ccr.is_required
FROM course_completion_requirements ccr
INNER JOIN courses c ON ccr.course_id = c.id
WHERE c.course_code = 'unarmed-guard-core';

SELECT 'Unarmed Guard Core course migration completed successfully!' as status;
