-- Direct fix for assessment icons to match module icons
-- Run this in Supabase SQL Editor

-- First, let's see what we have
SELECT 'BEFORE UPDATE:' as status;
SELECT 
    a.assessment_name,
    a.icon as assessment_icon,
    t.module_name,
    t.icon as module_icon
FROM assessments a
LEFT JOIN training_modules t ON a.module_id = t.id
ORDER BY t.display_order;

-- Update assessment icons to match their linked module icons
UPDATE assessments a
SET icon = t.icon
FROM training_modules t
WHERE a.module_id = t.id
AND a.icon != t.icon;

-- Verify the fix
SELECT 'AFTER UPDATE:' as status;
SELECT 
    a.assessment_name,
    a.icon as assessment_icon,
    t.module_name,
    t.icon as module_icon,
    CASE 
        WHEN a.icon = t.icon THEN '✓ MATCH' 
        ELSE '✗ MISMATCH' 
    END as status
FROM assessments a
LEFT JOIN training_modules t ON a.module_id = t.id
ORDER BY t.display_order;

SELECT 'Assessment icons updated successfully!' as result;
