-- Update Systema Scout module descriptions to be shorter
-- Run this to update existing modules in the database

UPDATE training_modules SET description = 'Introduction to Systema Scout framework and foundational cycle: Breathe → Relax → Structure → Move.' WHERE module_code = 'systema-scout-orientation';

UPDATE training_modules SET description = 'Practice walking mechanics with varied breathing patterns. Develop conscious breath control and movement awareness.' WHERE module_code = 'systema-scout-walking';

UPDATE training_modules SET description = 'Build perceptual awareness through observation exercises and environmental assessment for security scenarios.' WHERE module_code = 'systema-scout-observation';

UPDATE training_modules SET description = 'Identify and eliminate unnecessary tension through constrained movement and self-observation exercises.' WHERE module_code = 'systema-scout-tension';

UPDATE training_modules SET description = 'Integrate walking, observation, and tension awareness. Develop self-accountability and apply skills to professional scenarios.' WHERE module_code = 'systema-scout-integration';

UPDATE training_modules SET description = 'Review course aims and establish a sustainable practice routine for continued growth and responsibility.' WHERE module_code = 'systema-scout-closing';

-- Verify updates
SELECT module_code, module_name, description 
FROM training_modules 
WHERE module_code LIKE 'systema-scout%'
ORDER BY module_code;
