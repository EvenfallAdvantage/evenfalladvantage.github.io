-- Setup Assessments Table with Categories
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Add category and icon fields to assessments table
-- ============================================

ALTER TABLE assessments 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Miscellaneous',
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'fa-clipboard-check',
ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES training_modules(id) ON DELETE CASCADE;

-- Create index for module_id
CREATE INDEX IF NOT EXISTS idx_assessments_module_id ON assessments(module_id);
CREATE INDEX IF NOT EXISTS idx_assessments_category ON assessments(category);

-- ============================================
-- 2. Update existing assessments to link to modules and set categories
-- ============================================

-- Link existing assessments to their modules and set to "Event Security Core"
UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_code = 'communication-protocols' LIMIT 1),
    category = 'Event Security Core',
    icon = (SELECT icon FROM training_modules WHERE module_code = 'communication-protocols' LIMIT 1)
WHERE assessment_name LIKE '%Radio%' OR assessment_name LIKE '%Communication%';

UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_code = 'stop-the-bleed' LIMIT 1),
    category = 'Event Security Core',
    icon = (SELECT icon FROM training_modules WHERE module_code = 'stop-the-bleed' LIMIT 1)
WHERE assessment_name LIKE '%STOP THE BLEED%' OR assessment_name LIKE '%Emergency Medical%';

UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_code = 'threat-assessment' LIMIT 1),
    category = 'Event Security Core',
    icon = (SELECT icon FROM training_modules WHERE module_code = 'threat-assessment' LIMIT 1)
WHERE assessment_name LIKE '%Threat%';

UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_code = 'ics-100' LIMIT 1),
    category = 'Event Security Core',
    icon = (SELECT icon FROM training_modules WHERE module_code = 'ics-100' LIMIT 1)
WHERE assessment_name LIKE '%ICS%';

UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_code = 'diverse-population' LIMIT 1),
    category = 'Event Security Core',
    icon = (SELECT icon FROM training_modules WHERE module_code = 'diverse-population' LIMIT 1)
WHERE assessment_name LIKE '%Diverse%' OR assessment_name LIKE '%Interacting%';

UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_code = 'crowd-management' LIMIT 1),
    category = 'Event Security Core',
    icon = (SELECT icon FROM training_modules WHERE module_code = 'crowd-management' LIMIT 1)
WHERE assessment_name LIKE '%Crowd%';

UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_code = 'use-of-force' LIMIT 1),
    category = 'Event Security Core',
    icon = (SELECT icon FROM training_modules WHERE module_code = 'use-of-force' LIMIT 1)
WHERE assessment_name LIKE '%Use of Force%' OR assessment_name LIKE '%Legal%';

-- ============================================
-- 3. Verify the updates
-- ============================================

SELECT 
    a.assessment_name,
    a.category,
    a.icon,
    t.module_name,
    t.module_code
FROM assessments a
LEFT JOIN training_modules t ON a.module_id = t.id
ORDER BY a.category, a.assessment_name;

SELECT 'Assessments table updated successfully!' as status;
