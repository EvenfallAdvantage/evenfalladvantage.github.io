-- =====================================================
-- CLEANUP DUPLICATE SYSTEMA SCOUT ASSESSMENTS
-- =====================================================
-- Remove duplicate assessments, keeping only the ones with questions
-- =====================================================

-- First, let's see which assessments have questions
WITH assessments_with_questions AS (
    SELECT 
        a.id,
        a.module_id,
        a.assessment_name,
        COUNT(aq.id) as question_count
    FROM assessments a
    LEFT JOIN assessment_questions aq ON aq.assessment_id = a.id
    JOIN training_modules tm ON a.module_id = tm.id
    WHERE tm.module_code LIKE 'systema-scout%'
    GROUP BY a.id, a.module_id, a.assessment_name
),
assessments_to_keep AS (
    SELECT DISTINCT ON (module_id)
        id,
        module_id,
        assessment_name,
        question_count
    FROM assessments_with_questions
    ORDER BY module_id, question_count DESC, id
)
-- Delete assessments that are NOT in the keep list
DELETE FROM assessments
WHERE id IN (
    SELECT a.id
    FROM assessments a
    JOIN training_modules tm ON a.module_id = tm.id
    WHERE tm.module_code LIKE 'systema-scout%'
    AND a.id NOT IN (SELECT id FROM assessments_to_keep)
);

-- Verify the cleanup
SELECT 
    tm.module_code,
    tm.module_name,
    a.assessment_name,
    COUNT(aq.id) as question_count
FROM training_modules tm
LEFT JOIN assessments a ON a.module_id = tm.id
LEFT JOIN assessment_questions aq ON aq.assessment_id = a.id
WHERE tm.module_code LIKE 'systema-scout%'
GROUP BY tm.module_code, tm.module_name, a.assessment_name, tm.display_order
ORDER BY tm.display_order;
