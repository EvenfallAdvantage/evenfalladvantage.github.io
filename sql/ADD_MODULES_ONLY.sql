-- =====================================================
-- ADD ALL 8 MODULES TO SURVEILLANCE COURSE
-- =====================================================
-- PREREQUISITE: Course 'surveillance-detection' must exist
-- Run SURVEILLANCE_COURSE_SIMPLE.sql first if not already done
-- =====================================================

-- This script adds all 8 modules WITHOUT assessments
-- Assessments can be added later through the admin panel
-- =====================================================

-- Get the course ID first
DO $$
DECLARE
    v_course_id UUID;
BEGIN
    -- Get course ID
    SELECT id INTO v_course_id FROM courses WHERE course_code = 'surveillance-detection';
    
    IF v_course_id IS NULL THEN
        RAISE EXCEPTION 'Course surveillance-detection not found. Run SURVEILLANCE_COURSE_SIMPLE.sql first.';
    END IF;

    -- MODULE 1: Introduction
    INSERT INTO training_modules (
        module_code, module_name, description, icon, 
        estimated_duration_minutes, display_order, is_required, default_course_id
    ) VALUES (
        'surveillance-intro',
        'Introduction to Surveillance & Stalking',
        'Understanding the fundamentals of surveillance and stalking, including definitions, legal frameworks, and real-world impact.',
        'fa-info-circle',
        45, 1, true, v_course_id
    ) ON CONFLICT (module_code) DO NOTHING;

    -- MODULE 2: Pre-Attack Indicators
    INSERT INTO training_modules (
        module_code, module_name, description, icon,
        estimated_duration_minutes, display_order, is_required, default_course_id
    ) VALUES (
        'pre-attack-indicators',
        'Pre-Attack Indicators & Behavioral Analysis',
        'Learn to recognize the 15 key pre-attack indicators and behavioral cues that precede hostile actions.',
        'fa-exclamation-triangle',
        90, 2, true, v_course_id
    ) ON CONFLICT (module_code) DO NOTHING;

    -- MODULE 3: Physical Surveillance
    INSERT INTO training_modules (
        module_code, module_name, description, icon,
        estimated_duration_minutes, display_order, is_required, default_course_id
    ) VALUES (
        'physical-surveillance',
        'Physical Surveillance Detection',
        'Master surveillance detection routes (SDRs), foot and vehicle surveillance patterns, and counter-surveillance techniques.',
        'fa-walking',
        120, 3, true, v_course_id
    ) ON CONFLICT (module_code) DO NOTHING;

    -- MODULE 4: Technical Surveillance
    INSERT INTO training_modules (
        module_code, module_name, description, icon,
        estimated_duration_minutes, display_order, is_required, default_course_id
    ) VALUES (
        'technical-surveillance',
        'Technical Surveillance Recognition',
        'Learn to identify GPS trackers, hidden cameras, audio bugs, and other technical surveillance devices.',
        'fa-video',
        90, 4, true, v_course_id
    ) ON CONFLICT (module_code) DO NOTHING;

    -- MODULE 5: Cyber Stalking
    INSERT INTO training_modules (
        module_code, module_name, description, icon,
        estimated_duration_minutes, display_order, is_required, default_course_id
    ) VALUES (
        'cyber-stalking',
        'Cyber Stalking & Digital Surveillance',
        'Understand digital surveillance methods, social media monitoring, spyware, and online harassment protection.',
        'fa-laptop',
        90, 5, true, v_course_id
    ) ON CONFLICT (module_code) DO NOTHING;

    -- MODULE 6: OPSEC
    INSERT INTO training_modules (
        module_code, module_name, description, icon,
        estimated_duration_minutes, display_order, is_required, default_course_id
    ) VALUES (
        'opsec-personal-security',
        'OPSEC & Personal Security',
        'Learn operational security principles, routine analysis, pattern breaking, and creating effective security protocols.',
        'fa-shield-alt',
        90, 6, true, v_course_id
    ) ON CONFLICT (module_code) DO NOTHING;

    -- MODULE 7: Documentation
    INSERT INTO training_modules (
        module_code, module_name, description, icon,
        estimated_duration_minutes, display_order, is_required, default_course_id
    ) VALUES (
        'documentation-reporting',
        'Documentation, Reporting & Legal Considerations',
        'Learn proper evidence collection, documentation procedures, legal reporting, and working with law enforcement.',
        'fa-file-alt',
        90, 7, true, v_course_id
    ) ON CONFLICT (module_code) DO NOTHING;

    -- MODULE 8: Response Strategies
    INSERT INTO training_modules (
        module_code, module_name, description, icon,
        estimated_duration_minutes, display_order, is_required, default_course_id
    ) VALUES (
        'response-safety-planning',
        'Response Strategies & Safety Planning',
        'Develop comprehensive response strategies, emergency action plans, and long-term safety protocols.',
        'fa-life-ring',
        90, 8, true, v_course_id
    ) ON CONFLICT (module_code) DO NOTHING;

    -- Link all modules to course
    INSERT INTO course_modules (course_id, module_id, module_order)
    SELECT v_course_id, id, display_order
    FROM training_modules
    WHERE module_code IN (
        'surveillance-intro',
        'pre-attack-indicators',
        'physical-surveillance',
        'technical-surveillance',
        'cyber-stalking',
        'opsec-personal-security',
        'documentation-reporting',
        'response-safety-planning'
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Successfully added 8 modules to surveillance-detection course';
END $$;
