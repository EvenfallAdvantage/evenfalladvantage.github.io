-- Update Module Display Order
-- This sets the correct order for modules in the student portal
-- Run this in Supabase SQL Editor

-- Set display order for modules based on training sequence
UPDATE training_modules SET display_order = 1 WHERE module_name LIKE '%Radio%' OR module_name LIKE '%Communication%';
UPDATE training_modules SET display_order = 2 WHERE module_name LIKE '%STOP THE BLEED%' OR module_name LIKE '%Emergency Medical%';
UPDATE training_modules SET display_order = 3 WHERE module_name LIKE '%Threat Assessment%' OR module_name LIKE '%Situational Awareness%';
UPDATE training_modules SET display_order = 4 WHERE module_name LIKE '%ICS%' OR module_name LIKE '%Incident Command%';
UPDATE training_modules SET display_order = 5 WHERE module_name LIKE '%Diverse%' OR module_name LIKE '%Interacting%';
UPDATE training_modules SET display_order = 6 WHERE module_name LIKE '%Crowd%';
UPDATE training_modules SET display_order = 7 WHERE module_name LIKE '%Use of Force%' OR module_name LIKE '%Legal Aspects%';

-- Set higher order numbers for any other modules (emergency-response, access-screening, etc.)
UPDATE training_modules SET display_order = 8 WHERE module_name LIKE '%Emergency Response%';
UPDATE training_modules SET display_order = 9 WHERE module_name LIKE '%Access%' OR module_name LIKE '%Screening%';

-- Verify the new order
SELECT module_code, module_name, display_order 
FROM training_modules 
ORDER BY display_order;
