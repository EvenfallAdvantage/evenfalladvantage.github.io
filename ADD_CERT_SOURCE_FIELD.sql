-- Add field to distinguish instructor-issued vs student-uploaded certificates
-- Run this in Supabase SQL Editor

-- Add source column to certifications table
ALTER TABLE certifications 
ADD COLUMN IF NOT EXISTS issued_by_admin BOOLEAN DEFAULT false;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_certifications_issued_by_admin 
ON certifications(issued_by_admin);

-- Update existing certificates
-- Assume certificates with 'Evenfall Advantage' as issuing_organization are admin-issued
UPDATE certifications 
SET issued_by_admin = true 
WHERE issuing_organization ILIKE '%evenfall%' 
   OR issuing_organization ILIKE '%advantage%';

-- All others are student-uploaded
UPDATE certifications 
SET issued_by_admin = false 
WHERE issued_by_admin IS NULL;

-- Make the column NOT NULL now that we've set values
ALTER TABLE certifications 
ALTER COLUMN issued_by_admin SET NOT NULL;

-- Verify the update
SELECT 
    issued_by_admin,
    COUNT(*) as count,
    STRING_AGG(DISTINCT issuing_organization, ', ') as organizations
FROM certifications 
GROUP BY issued_by_admin;

SELECT 'Certificate source field added successfully!' as status;
