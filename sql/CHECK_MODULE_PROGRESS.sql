-- =====================================================
-- CHECK MODULE PROGRESS FOR DEBUGGING
-- =====================================================
-- This script checks the student_module_progress table
-- to see what completion data exists
-- =====================================================

-- Show all progress records for Systema Scout modules
SELECT 
    smp.id,
    s.email as student_email,
    tm.module_code,
    tm.module_name,
    smp.progress_percentage,
    smp.completed_at,
    smp.started_at,
    smp.updated_at
FROM student_module_progress smp
JOIN students s ON smp.student_id = s.id
JOIN training_modules tm ON smp.module_id = tm.id
WHERE tm.module_code LIKE 'systema-scout%'
ORDER BY s.email, tm.module_code;

-- Count completed vs incomplete modules
SELECT 
    CASE 
        WHEN smp.completed_at IS NOT NULL THEN 'Completed'
        ELSE 'In Progress'
    END as status,
    COUNT(*) as count
FROM student_module_progress smp
JOIN training_modules tm ON smp.module_id = tm.id
WHERE tm.module_code LIKE 'systema-scout%'
GROUP BY CASE WHEN smp.completed_at IS NOT NULL THEN 'Completed' ELSE 'In Progress' END;
