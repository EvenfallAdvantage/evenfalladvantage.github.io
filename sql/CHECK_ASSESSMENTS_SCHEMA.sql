-- Check the actual schema of the assessments table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'assessments'
ORDER BY ordinal_position;
