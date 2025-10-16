-- Check the actual module order in the database
SELECT 
    tm.id,
    tm.display_order,
    tm.module_name,
    tm.module_code,
    a.assessment_name,
    a.id as assessment_id
FROM training_modules tm
LEFT JOIN assessments a ON a.module_id = tm.id
ORDER BY tm.display_order;
