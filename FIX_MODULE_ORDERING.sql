-- Fix module ordering to ensure core modules stay in positions 1-7
-- and new modules go to position 8+

-- First, set the TEST module to display_order 8 (after the 7 core modules)
UPDATE training_modules 
SET display_order = 8 
WHERE module_name = 'TEST' OR module_code = 'test';

-- Ensure the 7 core modules have correct display_order (1-7)
UPDATE training_modules SET display_order = 1 
WHERE module_name LIKE '%Radio%' OR module_name LIKE '%Communication%';

UPDATE training_modules SET display_order = 2 
WHERE module_name LIKE '%STOP THE BLEED%' OR module_name LIKE '%Emergency Medical%';

UPDATE training_modules SET display_order = 3 
WHERE module_name LIKE '%Threat%';

UPDATE training_modules SET display_order = 4 
WHERE module_name LIKE '%ICS%' OR module_name LIKE '%Incident Command%';

UPDATE training_modules SET display_order = 5 
WHERE module_name LIKE '%Diverse%' OR module_name LIKE '%Interacting%';

UPDATE training_modules SET display_order = 6 
WHERE module_name LIKE '%Crowd%';

UPDATE training_modules SET display_order = 7 
WHERE module_name LIKE '%Use of Force%' OR module_name LIKE '%Legal%';

-- Verify the order
SELECT 
    display_order,
    module_name,
    module_code
FROM training_modules
ORDER BY display_order;
