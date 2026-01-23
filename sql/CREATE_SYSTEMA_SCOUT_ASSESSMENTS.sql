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
    question_count,
    time_limit,
    passing_score,
    is_active,
    category
)
SELECT 
    tm.id,
    'Systema Scout: Walking, Breathing, and Choice',
    15,
    20,
    80,
    true,
    'Systema Scout'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-walking';

-- =====================================================
-- MODULE 2: Security Assessment - Observation & Recall
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    question_count,
    time_limit,
    passing_score,
    is_active,
    category
)
SELECT 
    tm.id,
    'Systema Scout: Security Assessment',
    15,
    20,
    80,
    true,
    'Systema Scout'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-security';

-- =====================================================
-- MODULE 3: Glove Work - Unnecessary Tension
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    question_count,
    time_limit,
    passing_score,
    is_active,
    category
)
SELECT 
    tm.id,
    'Systema Scout: Glove Work & Tension Management',
    15,
    20,
    80,
    true,
    'Systema Scout'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-glove';

-- =====================================================
-- MODULE 4: Eyes Closed & Lying Down Walking
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    question_count,
    time_limit,
    passing_score,
    is_active,
    category
)
SELECT 
    tm.id,
    'Systema Scout: Sensory Awareness & Movement',
    15,
    20,
    80,
    true,
    'Systema Scout'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-eyes';

-- =====================================================
-- MODULE 5: Evolving Relationship with Empathy
-- =====================================================

INSERT INTO assessments (
    module_id,
    assessment_name,
    question_count,
    time_limit,
    passing_score,
    is_active,
    category
)
SELECT 
    tm.id,
    'Systema Scout: Empathy & Professional Relationships',
    15,
    20,
    80,
    true,
    'Systema Scout'
FROM training_modules tm
WHERE tm.module_code = 'systema-scout-empathy';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Show all Systema Scout assessments
SELECT 
    a.assessment_name,
    tm.module_name,
    tm.module_code,
    a.question_count,
    a.time_limit,
    a.passing_score,
    a.is_active
FROM assessments a
JOIN training_modules tm ON a.module_id = tm.id
WHERE tm.module_code LIKE 'systema-scout%'
ORDER BY tm.module_code;

-- Count assessments created
SELECT 
    COUNT(*) as total_assessments,
    COUNT(CASE WHEN a.is_active = true THEN 1 END) as active_assessments
FROM assessments a
JOIN training_modules tm ON a.module_id = tm.id
WHERE tm.module_code LIKE 'systema-scout%';
