-- Find the TEST module
SELECT 
    tm.id,
    tm.module_code,
    tm.module_name,
    tm.display_order,
    COUNT(ms.id) as slide_count
FROM training_modules tm
LEFT JOIN module_slides ms ON tm.id = ms.module_id
WHERE tm.module_name LIKE '%TEST%' OR tm.display_order = 8
GROUP BY tm.id, tm.module_code, tm.module_name, tm.display_order
ORDER BY tm.display_order;

-- Get slides for the TEST module
SELECT 
    ms.slide_number,
    ms.title,
    ms.content,
    ms.notes
FROM module_slides ms
JOIN training_modules tm ON ms.module_id = tm.id
WHERE tm.module_name LIKE '%TEST%' OR tm.display_order = 8
ORDER BY ms.slide_number;
