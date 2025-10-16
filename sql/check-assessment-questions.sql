-- Check current assessment questions data
-- Run this in Supabase SQL Editor to see what's in the database

SELECT 
    a.id,
    a.assessment_name,
    tm.module_name,
    tm.display_order,
    a.total_questions,
    a.passing_score,
    CASE 
        WHEN a.questions_json IS NULL THEN 'NULL'
        WHEN a.questions_json::text = '[]' THEN 'EMPTY ARRAY'
        WHEN a.questions_json::text = 'null' THEN 'NULL STRING'
        ELSE 'HAS DATA'
    END as questions_status,
    jsonb_array_length(a.questions_json) as actual_question_count
FROM assessments a
JOIN training_modules tm ON a.module_id = tm.id
ORDER BY tm.display_order;
