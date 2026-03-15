-- Add state_code column to assessment_results table
-- This allows tracking which state a Module 7 assessment was completed for

-- Add the state_code column (nullable for backwards compatibility with existing records)
ALTER TABLE assessment_results
ADD COLUMN IF NOT EXISTS state_code VARCHAR(2);

-- Add an index for faster queries by state
CREATE INDEX IF NOT EXISTS idx_assessment_results_state_code 
ON assessment_results(state_code);

-- Add a composite index for student + assessment + state lookups
CREATE INDEX IF NOT EXISTS idx_assessment_results_student_assessment_state 
ON assessment_results(student_id, assessment_id, state_code);

-- Add a comment explaining the column
COMMENT ON COLUMN assessment_results.state_code IS 'For Module 7 (Use of Force) assessments: stores the 2-letter state code (e.g., CA, NY, FL) that the assessment was completed for. NULL for other modules.';

-- Verify the changes
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'assessment_results'
AND column_name = 'state_code';
