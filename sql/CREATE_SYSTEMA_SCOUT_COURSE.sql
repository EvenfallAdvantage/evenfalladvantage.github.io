-- =====================================================
-- SYSTEMA SCOUT COURSE CREATION
-- =====================================================
-- Creates the Systema Scout course and its 6 modules
-- Run this after COURSE_SYSTEM_SETUP.sql
-- =====================================================

-- =====================================================
-- 1. CREATE SYSTEMA SCOUT COURSE
-- =====================================================

INSERT INTO courses (
    course_code,
    course_name,
    description,
    short_description,
    price,
    currency,
    duration_hours,
    difficulty_level,
    icon,
    thumbnail_url,
    is_active,
    display_order,
    learning_objectives,
    prerequisites,
    target_audience
) VALUES (
    'systema-scout',
    'Systema Scout',
    'Systema Scout is a foundational, experiential training framework rooted in Systema principles. This course builds internal regulation, perceptual awareness, and self-accountability before proximity, contact, or force. The outcomes are qualitative and experiential, based on first-person awareness and observable behavioral changes. Participants can expect a noticeable change in how stress affects them in professional work and daily life. With consistent practice, many report a shift in perception, decision-making, and a growing, evolving relationship with empathy.',
    'Foundational internal training for security professionals, law enforcement, military, and anyone whose presence affects the safety of others.',
    149.99,
    'USD',
    5,
    'Foundational',
    'fa-yin-yang',
    NULL,
    true,
    2,
    ARRAY[
        'Develop internal regulation and stress management',
        'Build perceptual awareness and environmental observation',
        'Practice self-accountability and empathetic self-debrief',
        'Master the foundational cycle: Breathe → Relax → Structure → Move',
        'Eliminate unnecessary tension and effort',
        'Cultivate ongoing regulation, reflection, and responsibility'
    ],
    NULL,
    'Security professionals, law enforcement, military personnel, parents and caregivers, educators, coaches, and community members who regularly find themselves holding responsibility in tense or uncertain situations. For people who want to become someone whose presence makes situations safer rather than more volatile.'
)
ON CONFLICT (course_code) DO NOTHING
RETURNING id, course_code, course_name;

-- =====================================================
-- 2. CREATE TRAINING MODULES
-- =====================================================

-- Module 0: Orientation & Philosophy
INSERT INTO training_modules (
    module_code,
    module_name,
    description,
    icon,
    estimated_time,
    duration_minutes,
    difficulty_level,
    is_active,
    display_order,
    category
) VALUES (
    'systema-scout-orientation',
    'Orientation & Philosophy',
    'Understanding the Systema Scout framework, its purpose, and who it serves. Learn the foundational cycle: Breathe → Relax → Structure → Move. Explore the axis of responsibility and the qualitative, experiential nature of this training.',
    'fa-compass',
    '30-45 minutes',
    40,
    'Foundational',
    true,
    100,
    'systema-scout'
)
ON CONFLICT (module_code) DO NOTHING;

-- Module 1: Walking, Breathing, and Choice
INSERT INTO training_modules (
    module_code,
    module_name,
    description,
    icon,
    estimated_time,
    duration_minutes,
    difficulty_level,
    is_active,
    display_order,
    category
) VALUES (
    'systema-scout-walking',
    'Walking, Breathing, and Choice',
    'Explore the relationship between walking pace, breathing patterns, and conscious choice. Practice forward and backward walking with varied breath counts from 1 to 20 steps. Develop awareness of natural breathing patterns and learn to modulate breath consciously.',
    'fa-walking',
    '45-60 minutes',
    50,
    'Foundational',
    true,
    101,
    'systema-scout'
)
ON CONFLICT (module_code) DO NOTHING;

-- Module 2: Security Assessment (Observation and Recall)
INSERT INTO training_modules (
    module_code,
    module_name,
    description,
    icon,
    estimated_time,
    duration_minutes,
    difficulty_level,
    is_active,
    display_order,
    category
) VALUES (
    'systema-scout-observation',
    'Security Assessment: Observation & Recall',
    'Develop perceptual awareness through post-walk recall exercises. Practice concrete observation and detailed environmental assessment. Build scenario awareness for security work and expand continuous awareness practice.',
    'fa-eye',
    '30-45 minutes',
    40,
    'Intermediate',
    true,
    102,
    'systema-scout'
)
ON CONFLICT (module_code) DO NOTHING;

-- Module 3: Glove Work (Unnecessary Tension)
INSERT INTO training_modules (
    module_code,
    module_name,
    description,
    icon,
    estimated_time,
    duration_minutes,
    difficulty_level,
    is_active,
    display_order,
    category
) VALUES (
    'systema-scout-tension',
    'Glove Work: Unnecessary Tension',
    'Identify and eliminate unnecessary tension through constrained movement. Observe psychological and physical responses to effort. Practice self-observation during constraint and explore variations including eyes closed, lying down, and walking.',
    'fa-hand-paper',
    '45-60 minutes',
    50,
    'Intermediate',
    true,
    103,
    'systema-scout'
)
ON CONFLICT (module_code) DO NOTHING;

-- Module 4: Integration & Self-Regulation
INSERT INTO training_modules (
    module_code,
    module_name,
    description,
    icon,
    estimated_time,
    duration_minutes,
    difficulty_level,
    is_active,
    display_order,
    category
) VALUES (
    'systema-scout-integration',
    'Integration & Self-Regulation',
    'Integrate walking, observation, and tension awareness into daily practice. Develop self-accountability and empathetic self-debrief skills. Combine multiple awareness practices and apply regulation skills to professional scenarios.',
    'fa-puzzle-piece',
    '60 minutes',
    60,
    'Advanced',
    true,
    104,
    'systema-scout'
)
ON CONFLICT (module_code) DO NOTHING;

-- Module 5: Closing Aim & Continued Practice
INSERT INTO training_modules (
    module_code,
    module_name,
    description,
    icon,
    estimated_time,
    duration_minutes,
    difficulty_level,
    is_active,
    display_order,
    category
) VALUES (
    'systema-scout-closing',
    'Closing Aim & Continued Practice',
    'Review the aim of Systema Scout and establish a sustainable practice routine. Understand the path forward as a regulated, responsible practitioner. Create a personal practice plan and commit to ongoing responsibility and reflection.',
    'fa-flag-checkered',
    '20-30 minutes',
    25,
    'Foundational',
    true,
    105,
    'systema-scout'
)
ON CONFLICT (module_code) DO NOTHING;

-- =====================================================
-- 3. LINK MODULES TO COURSE
-- =====================================================

DO $$
DECLARE
    v_course_id UUID;
    v_module_id UUID;
BEGIN
    -- Get course ID
    SELECT id INTO v_course_id FROM courses WHERE course_code = 'systema-scout';
    
    IF v_course_id IS NULL THEN
        RAISE EXCEPTION 'Course "systema-scout" not found. Please run the INSERT statement first.';
    END IF;
    
    -- Module 0: Orientation & Philosophy
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'systema-scout-orientation';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 0, true)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    -- Module 1: Walking, Breathing, and Choice
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'systema-scout-walking';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 1, true)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    -- Module 2: Security Assessment
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'systema-scout-observation';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 2, true)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    -- Module 3: Glove Work
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'systema-scout-tension';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 3, true)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    -- Module 4: Integration & Self-Regulation
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'systema-scout-integration';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 4, true)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    -- Module 5: Closing Aim
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'systema-scout-closing';
    IF v_module_id IS NOT NULL THEN
        INSERT INTO course_modules (course_id, module_id, module_order, is_required)
        VALUES (v_course_id, v_module_id, 5, true)
        ON CONFLICT (course_id, module_id) DO NOTHING;
        
        UPDATE training_modules SET default_course_id = v_course_id WHERE id = v_module_id;
    END IF;
    
    RAISE NOTICE 'Successfully linked 6 modules to Systema Scout course';
END $$;

-- =====================================================
-- 4. SET COURSE COMPLETION REQUIREMENTS
-- =====================================================

DO $$
DECLARE
    v_course_id UUID;
BEGIN
    SELECT id INTO v_course_id FROM courses WHERE course_code = 'systema-scout';
    
    IF v_course_id IS NOT NULL THEN
        -- Require completion of all required modules
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
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Course completion requirements set for Systema Scout';
    END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check course was created
SELECT 
    course_code,
    course_name,
    price,
    duration_hours,
    difficulty_level
FROM courses 
WHERE course_code = 'systema-scout';

-- Check modules are linked
SELECT 
    cm.module_order,
    tm.module_name,
    tm.estimated_time,
    cm.is_required
FROM course_modules cm
JOIN training_modules tm ON cm.module_id = tm.id
JOIN courses c ON cm.course_id = c.id
WHERE c.course_code = 'systema-scout'
ORDER BY cm.module_order;

-- Check completion requirements
SELECT 
    c.course_name,
    ccr.requirement_type,
    ccr.requirement_value,
    ccr.is_required
FROM course_completion_requirements ccr
JOIN courses c ON ccr.course_id = c.id
WHERE c.course_code = 'systema-scout';
