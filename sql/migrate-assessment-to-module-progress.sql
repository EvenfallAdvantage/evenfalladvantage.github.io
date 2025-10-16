-- Migrate existing passed assessments to module progress
-- This creates module_progress records for all students who passed assessments
-- Run this in Supabase SQL Editor

-- STEP 1: Preview what will be created
SELECT 
    ar.student_id,
    s.email,
    a.module_id,
    tm.module_name,
    tm.display_order,
    MAX(ar.score) as best_score,
    MAX(ar.completed_at) as latest_completion
FROM assessment_results ar
JOIN students s ON ar.student_id = s.id
JOIN assessments a ON ar.assessment_id = a.id
JOIN training_modules tm ON a.module_id = tm.id
WHERE ar.passed = true
AND NOT EXISTS (
    -- Only create if module progress doesn't already exist
    SELECT 1 
    FROM student_module_progress smp 
    WHERE smp.student_id = ar.student_id 
    AND smp.module_id = a.module_id
    AND smp.status = 'completed'
)
GROUP BY ar.student_id, s.email, a.module_id, tm.module_name, tm.display_order
ORDER BY s.email, tm.display_order;

-- STEP 2: Create module progress records for passed assessments
-- ⚠️ Run this after reviewing STEP 1 results

INSERT INTO student_module_progress (
    student_id,
    module_id,
    status,
    progress_percentage,
    last_accessed,
    completed_at
)
SELECT 
    ar.student_id,
    a.module_id,
    'completed' as status,
    100 as progress_percentage,
    MAX(ar.completed_at) as last_accessed,
    MAX(ar.completed_at) as completed_at
FROM assessment_results ar
JOIN assessments a ON ar.assessment_id = a.id
WHERE ar.passed = true
AND NOT EXISTS (
    -- Only create if module progress doesn't already exist
    SELECT 1 
    FROM student_module_progress smp 
    WHERE smp.student_id = ar.student_id 
    AND smp.module_id = a.module_id
    AND smp.status = 'completed'
)
GROUP BY ar.student_id, a.module_id
ON CONFLICT (student_id, module_id) 
DO UPDATE SET
    status = 'completed',
    progress_percentage = 100,
    completed_at = EXCLUDED.completed_at,
    last_accessed = EXCLUDED.last_accessed;

-- STEP 3: Verify the migration
SELECT 
    s.email,
    s.first_name || ' ' || s.last_name as student_name,
    COUNT(DISTINCT CASE WHEN ar.passed = true THEN ar.assessment_id END) as passed_assessments,
    COUNT(DISTINCT CASE WHEN smp.status = 'completed' THEN smp.module_id END) as completed_modules
FROM students s
LEFT JOIN assessment_results ar ON s.id = ar.student_id
LEFT JOIN student_module_progress smp ON s.id = smp.student_id
GROUP BY s.id, s.email, s.first_name, s.last_name
ORDER BY s.email;
