-- Check student progress data
-- Run this in Supabase SQL Editor

-- Check assessment results
SELECT 
    s.email,
    s.first_name || ' ' || s.last_name as student_name,
    a.assessment_name,
    ar.score,
    ar.passed,
    ar.completed_at
FROM assessment_results ar
JOIN students s ON ar.student_id = s.id
JOIN assessments a ON ar.assessment_id = a.id
ORDER BY s.email, ar.completed_at DESC;

-- Check module progress
SELECT 
    s.email,
    s.first_name || ' ' || s.last_name as student_name,
    tm.module_name,
    smp.status,
    smp.progress_percentage,
    smp.completed_at
FROM student_module_progress smp
JOIN students s ON smp.student_id = s.id
JOIN training_modules tm ON smp.module_id = tm.id
ORDER BY s.email, tm.display_order;

-- Summary by student
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
