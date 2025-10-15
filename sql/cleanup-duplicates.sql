-- Cleanup duplicate assessment results
-- This keeps only the BEST SCORE for each student/assessment combination
-- Run this in Supabase SQL Editor

-- STEP 1: Preview what will be deleted (RUN THIS FIRST!)
WITH ranked_results AS (
    SELECT 
        ar.*,
        s.email,
        a.assessment_name,
        ROW_NUMBER() OVER (
            PARTITION BY ar.student_id, ar.assessment_id 
            ORDER BY ar.score DESC, ar.completed_at DESC
        ) as rank
    FROM assessment_results ar
    JOIN students s ON ar.student_id = s.id
    JOIN assessments a ON ar.assessment_id = a.id
)
SELECT 
    email,
    assessment_name,
    score,
    completed_at,
    CASE WHEN rank = 1 THEN '✅ KEEP' ELSE '❌ DELETE' END as action
FROM ranked_results
WHERE student_id IN (
    SELECT student_id 
    FROM assessment_results 
    GROUP BY student_id, assessment_id 
    HAVING COUNT(*) > 1
)
ORDER BY email, assessment_name, rank;

-- STEP 2: Count how many will be deleted
WITH ranked_results AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY student_id, assessment_id 
            ORDER BY score DESC, completed_at DESC
        ) as rank
    FROM assessment_results
)
SELECT 
    COUNT(*) as records_to_delete,
    (SELECT COUNT(*) FROM assessment_results) as total_records,
    (SELECT COUNT(*) FROM assessment_results) - COUNT(*) as records_after_cleanup
FROM ranked_results
WHERE rank > 1;

-- STEP 3: DELETE DUPLICATES (RUN THIS AFTER REVIEWING ABOVE)
-- ⚠️ WARNING: This will permanently delete data!
-- Make sure you've reviewed the preview above first!

/*
WITH ranked_results AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY student_id, assessment_id 
            ORDER BY score DESC, completed_at DESC
        ) as rank
    FROM assessment_results
)
DELETE FROM assessment_results
WHERE id IN (
    SELECT id 
    FROM ranked_results 
    WHERE rank > 1
);
*/

-- STEP 4: Verify cleanup (run after deletion)
SELECT 
    s.email,
    COUNT(DISTINCT ar.assessment_id) as unique_assessments,
    COUNT(*) as total_records
FROM assessment_results ar
JOIN students s ON ar.student_id = s.id
GROUP BY s.email
ORDER BY s.email;

-- Should show: unique_assessments = total_records for all students
