-- Clean up module progress records where assessment was not passed
-- This removes any module_progress records where the student didn't pass the assessment

-- STEP 1: Preview what will be deleted
SELECT 
    s.email,
    s.first_name || ' ' || s.last_name as student_name,
    tm.module_name,
    smp.status,
    smp.completed_at,
    COALESCE(bool_or(ar.passed), false) as assessment_passed,
    COALESCE(MAX(ar.score), 0) as best_score
FROM student_module_progress smp
JOIN students s ON smp.student_id = s.id
JOIN training_modules tm ON smp.module_id = tm.id
LEFT JOIN assessments a ON a.module_id = tm.id
LEFT JOIN assessment_results ar ON ar.assessment_id = a.id AND ar.student_id = s.id
WHERE smp.status = 'completed'
GROUP BY s.email, s.first_name, s.last_name, tm.module_name, smp.status, smp.completed_at, smp.student_id, smp.module_id
HAVING COALESCE(bool_or(ar.passed), false) = false
ORDER BY s.email, tm.display_order;

-- STEP 2: Delete module progress where assessment was not passed
-- ⚠️ Run this after reviewing STEP 1 results

DELETE FROM student_module_progress
WHERE id IN (
    SELECT smp.id
    FROM student_module_progress smp
    JOIN training_modules tm ON smp.module_id = tm.id
    LEFT JOIN assessments a ON a.module_id = tm.id
    LEFT JOIN assessment_results ar ON ar.assessment_id = a.id AND ar.student_id = smp.student_id
    WHERE smp.status = 'completed'
    GROUP BY smp.id, smp.student_id, smp.module_id
    HAVING COALESCE(bool_or(ar.passed), false) = false
);

-- STEP 3: Verify the cleanup
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
