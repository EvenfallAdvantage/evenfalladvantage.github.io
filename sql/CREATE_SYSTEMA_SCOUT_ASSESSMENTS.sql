-- =====================================================
-- CREATE SYSTEMA SCOUT ASSESSMENTS
-- =====================================================
-- This script creates assessments for all Systema Scout modules
-- Each assessment tests knowledge from the corresponding module
-- =====================================================

-- Note: Module 0 (Orientation) typically doesn't have an assessment
-- We'll create assessments for Modules 1-5

-- =====================================================
-- MODULE 1: Walking, Breathing, and Choice
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    total_questions,
    time_limit_minutes,
    passing_score,
    category
)
SELECT 
    tm.id,
    'Systema Scout: Walking, Breathing, and Choice',
    15,
    20,
    80,
    'Systema Scout'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-walking';

-- =====================================================
-- MODULE 2: Security Assessment - Observation & Recall
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    total_questions,
    time_limit_minutes,
    passing_score,
    category
)
SELECT 
    tm.id,
    'Systema Scout: Security Assessment',
    15,
    20,
    80,
    'Systema Scout'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-observation';

-- =====================================================
-- MODULE 3: Glove Work - Unnecessary Tension
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    total_questions,
    time_limit_minutes,
    passing_score,
    category
)
SELECT 
    tm.id,
    'Systema Scout: Glove Work & Tension Management',
    15,
    20,
    80,
    'Systema Scout'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-tension';

-- =====================================================
-- MODULE 4: Eyes Closed & Lying Down Walking
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    total_questions,
    time_limit_minutes,
    passing_score,
    category
)
SELECT 
    tm.id,
    'Systema Scout: Sensory Awareness & Movement',
    15,
    20,
    80,
    'Systema Scout'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-closing';

-- =====================================================
-- MODULE 5: Evolving Relationship with Empathy
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    total_questions,
    time_limit_minutes,
    passing_score,
    category
)
SELECT 
    tm.id,
    'Systema Scout: Empathy & Professional Relationships',
    15,
    20,
    80,
    'Systema Scout'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-integration';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Show all Systema Scout assessments
SELECT 
    a.assessment_name,
    tm.module_name,
    tm.module_code,
    a.total_questions,
    a.time_limit_minutes,
    a.passing_score,
    a.category
FROM assessments a
JOIN training_modules tm ON a.module_id = tm.id
WHERE tm.module_code LIKE 'systema-scout%'
ORDER BY tm.module_code;

-- Count assessments created
SELECT 
    COUNT(*) as total_assessments
FROM assessments a
JOIN training_modules tm ON a.module_id = tm.id
WHERE tm.module_code LIKE 'systema-scout%';
