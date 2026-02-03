-- =====================================================
-- CREATE ALL SYSTEMA SCOUT ASSESSMENTS
-- =====================================================
-- Creates assessments for ALL 6 Systema Scout modules (0-5)
-- Run this BEFORE generating assessment questions
-- =====================================================

-- =====================================================
-- MODULE 0: Orientation & Philosophy
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    total_questions,
    time_limit_minutes,
    passing_score,
    category,
    icon
)
SELECT 
    tm.id,
    'Systema Scout: Orientation & Philosophy',
    20,
    25,
    80,
    'Systema Scout',
    'fa-compass'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-orientation'
ON CONFLICT DO NOTHING;

-- =====================================================
-- MODULE 1: Walking, Breathing, and Choice
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    total_questions,
    time_limit_minutes,
    passing_score,
    category,
    icon
)
SELECT 
    tm.id,
    'Systema Scout: Walking, Breathing, and Choice',
    20,
    25,
    80,
    'Systema Scout',
    'fa-walking'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-walking'
ON CONFLICT DO NOTHING;

-- =====================================================
-- MODULE 2: Security Assessment - Observation & Recall
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    total_questions,
    time_limit_minutes,
    passing_score,
    category,
    icon
)
SELECT 
    tm.id,
    'Systema Scout: Security Assessment',
    20,
    25,
    80,
    'Systema Scout',
    'fa-eye'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-observation'
ON CONFLICT DO NOTHING;

-- =====================================================
-- MODULE 3: Glove Work - Unnecessary Tension
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    total_questions,
    time_limit_minutes,
    passing_score,
    category,
    icon
)
SELECT 
    tm.id,
    'Systema Scout: Glove Work & Tension Management',
    20,
    25,
    80,
    'Systema Scout',
    'fa-hand-paper'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-tension'
ON CONFLICT DO NOTHING;

-- =====================================================
-- MODULE 4: Integration & Self-Regulation
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    total_questions,
    time_limit_minutes,
    passing_score,
    category,
    icon
)
SELECT 
    tm.id,
    'Systema Scout: Integration & Self-Regulation',
    20,
    30,
    80,
    'Systema Scout',
    'fa-puzzle-piece'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-integration'
ON CONFLICT DO NOTHING;

-- =====================================================
-- MODULE 5: Closing Aim & Continued Practice
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    total_questions,
    time_limit_minutes,
    passing_score,
    category,
    icon
)
SELECT 
    tm.id,
    'Systema Scout: Closing Aim & Continued Practice',
    20,
    20,
    80,
    'Systema Scout',
    'fa-flag-checkered'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-closing'
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Show all Systema Scout assessments
SELECT 
    tm.module_code,
    tm.module_name,
    a.assessment_name,
    a.total_questions,
    a.time_limit_minutes,
    a.passing_score,
    a.icon
FROM assessments a
JOIN training_modules tm ON a.module_id = tm.id
WHERE tm.module_code LIKE 'systema-scout%'
ORDER BY tm.display_order;

-- Count assessments created
SELECT 
    COUNT(*) as total_systema_assessments
FROM assessments a
JOIN training_modules tm ON a.module_id = tm.id
WHERE tm.module_code LIKE 'systema-scout%';
