-- Update existing Module 7 (Use of Force) assessment records to show Maryland (MD)
-- This is for records that were completed before the state_code feature was added

-- First, let's see which records will be updated
SELECT 
    ar.id,
    ar.student_id,
    s.email,
    ar.score,
    ar.passed,
    ar.completed_at,
    ar.state_code,
    a.assessment_name
FROM assessment_results ar
JOIN assessments a ON ar.assessment_id = a.id
JOIN training_modules tm ON a.module_id = tm.id
LEFT JOIN students s ON ar.student_id = s.id
WHERE tm.module_code = 'use-of-force'
AND ar.state_code IS NULL
ORDER BY ar.completed_at DESC;

-- Update all existing Module 7 records without a state_code to Maryland (MD)
UPDATE assessment_results
SET state_code = 'MD'
WHERE id IN (
    SELECT ar.id
    FROM assessment_results ar
    JOIN assessments a ON ar.assessment_id = a.id
    JOIN training_modules tm ON a.module_id = tm.id
    WHERE tm.module_code = 'use-of-force'
    AND ar.state_code IS NULL
);

-- Verify the update
SELECT 
    ar.id,
    ar.student_id,
    s.email,
    ar.score,
    ar.passed,
    ar.completed_at,
    ar.state_code,
    a.assessment_name
FROM assessment_results ar
JOIN assessments a ON ar.assessment_id = a.id
JOIN training_modules tm ON a.module_id = tm.id
LEFT JOIN students s ON ar.student_id = s.id
WHERE tm.module_code = 'use-of-force'
ORDER BY ar.completed_at DESC;

-- Summary
SELECT 
    COUNT(*) as total_module7_records,
    COUNT(CASE WHEN state_code = 'MD' THEN 1 END) as maryland_records,
    COUNT(CASE WHEN state_code IS NULL THEN 1 END) as records_without_state
FROM assessment_results ar
JOIN assessments a ON ar.assessment_id = a.id
JOIN training_modules tm ON a.module_id = tm.id
WHERE tm.module_code = 'use-of-force';
