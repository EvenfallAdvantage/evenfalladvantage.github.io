-- Test if assessment questions are accessible
-- Run this to verify the data is there and accessible

-- Check if questions exist for Systema Scout modules
SELECT 
    tm.module_code,
    tm.module_name,
    a.assessment_name,
    COUNT(aq.id) as question_count
FROM training_modules tm
JOIN assessments a ON a.module_id = tm.id
LEFT JOIN assessment_questions aq ON aq.assessment_id = a.id
WHERE tm.module_code LIKE 'systema-scout%'
GROUP BY tm.module_code, tm.module_name, a.assessment_name, tm.display_order
ORDER BY tm.display_order;

-- Check a specific assessment's questions
SELECT 
    aq.question_number,
    aq.question_text,
    aq.correct_answer
FROM assessment_questions aq
JOIN assessments a ON aq.assessment_id = a.id
JOIN training_modules tm ON a.module_id = tm.id
WHERE tm.module_code = 'systema-scout-orientation'
ORDER BY aq.question_number
LIMIT 5;

-- Check RLS policies on assessment_questions
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'assessment_questions';
