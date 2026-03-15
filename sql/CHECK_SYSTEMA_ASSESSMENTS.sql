-- Check if assessments are properly linked to modules
SELECT 
    tm.module_code,
    tm.module_name,
    tm.id as module_id,
    a.id as assessment_id,
    a.assessment_name,
    COUNT(aq.id) as question_count
FROM training_modules tm
LEFT JOIN assessments a ON a.module_id = tm.id
LEFT JOIN assessment_questions aq ON aq.assessment_id = a.id
WHERE tm.module_code LIKE 'systema-scout%'
GROUP BY tm.module_code, tm.module_name, tm.id, a.id, a.assessment_name, tm.display_order
ORDER BY tm.display_order;
