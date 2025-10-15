-- Check what icons are currently set for modules
SELECT 
    module_name,
    module_code,
    icon,
    display_order
FROM training_modules
ORDER BY display_order;

-- Check what icons are currently set for assessments
SELECT 
    assessment_name,
    icon,
    category,
    module_id
FROM assessments
ORDER BY assessment_name;

-- Check if assessments are linked to modules
SELECT 
    a.assessment_name,
    a.icon as assessment_icon,
    t.module_name,
    t.icon as module_icon,
    CASE 
        WHEN a.icon = t.icon THEN 'MATCH' 
        ELSE 'MISMATCH' 
    END as icon_status
FROM assessments a
LEFT JOIN training_modules t ON a.module_id = t.id
ORDER BY t.display_order;
