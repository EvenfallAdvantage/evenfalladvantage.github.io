-- Check for duplicate assessment results across all students
-- Run this in Supabase SQL Editor

-- Summary: Count duplicates by student
SELECT 
    s.email,
    s.first_name,
    s.last_name,
    COUNT(DISTINCT ar.assessment_id) as unique_assessments,
    COUNT(*) as total_attempts,
    COUNT(*) - COUNT(DISTINCT ar.assessment_id) as duplicate_count
FROM assessment_results ar
JOIN students s ON ar.student_id = s.id
GROUP BY s.id, s.email, s.first_name, s.last_name
HAVING COUNT(*) > COUNT(DISTINCT ar.assessment_id)
ORDER BY duplicate_count DESC;

-- Detailed view: Show all duplicate groups
SELECT 
    s.email,
    s.first_name || ' ' || s.last_name as student_name,
    a.assessment_name,
    COUNT(*) as attempt_count,
    MAX(ar.score) as best_score,
    MIN(ar.score) as worst_score,
    AVG(ar.score)::numeric(5,2) as avg_score
FROM assessment_results ar
JOIN students s ON ar.student_id = s.id
JOIN assessments a ON ar.assessment_id = a.id
GROUP BY s.email, s.first_name, s.last_name, a.assessment_name
HAVING COUNT(*) > 1
ORDER BY attempt_count DESC, s.email;

-- Total statistics
SELECT 
    COUNT(*) as total_results,
    COUNT(DISTINCT student_id || '_' || assessment_id) as unique_combinations,
    COUNT(*) - COUNT(DISTINCT student_id || '_' || assessment_id) as total_duplicates,
    ROUND(
        100.0 * (COUNT(*) - COUNT(DISTINCT student_id || '_' || assessment_id)) / COUNT(*), 
        2
    ) as duplicate_percentage
FROM assessment_results;

-- Find the worst offenders (most duplicates for a single student/assessment)
SELECT 
    s.email,
    a.assessment_name,
    COUNT(*) as duplicate_count,
    array_agg(ar.score ORDER BY ar.completed_at) as all_scores,
    array_agg(ar.completed_at ORDER BY ar.completed_at) as all_dates
FROM assessment_results ar
JOIN students s ON ar.student_id = s.id
JOIN assessments a ON ar.assessment_id = a.id
GROUP BY s.email, a.assessment_name, ar.student_id, ar.assessment_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;
