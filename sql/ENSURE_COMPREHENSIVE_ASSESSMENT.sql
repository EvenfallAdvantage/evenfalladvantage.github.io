-- Ensure Comprehensive Guard Certification assessment exists
-- Run this in Supabase SQL Editor

-- Check if comprehensive assessment exists
SELECT * FROM assessments WHERE assessment_name LIKE '%Comprehensive%';

-- If it doesn't exist, create it
INSERT INTO assessments (
    assessment_name,
    category,
    icon,
    total_questions,
    passing_score,
    time_limit_minutes,
    module_id
)
SELECT 
    'Comprehensive Guard Certification',
    'Comprehensive',
    'fa-certificate',
    50,
    80,
    75,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM assessments WHERE assessment_name LIKE '%Comprehensive%'
);

-- If it exists, update its category to ensure it shows up
UPDATE assessments 
SET 
    category = 'Comprehensive',
    icon = 'fa-certificate'
WHERE assessment_name LIKE '%Comprehensive%';

-- Verify
SELECT 
    assessment_name,
    category,
    icon,
    total_questions,
    time_limit_minutes
FROM assessments
WHERE assessment_name LIKE '%Comprehensive%';
