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
-- Module 1: Radio Communications
UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_name LIKE '%Radio%' OR module_name LIKE '%Communication%' LIMIT 1),
    category = 'Event Security Core',
    icon = COALESCE((SELECT icon FROM training_modules WHERE module_name LIKE '%Radio%' OR module_name LIKE '%Communication%' LIMIT 1), 'fa-clipboard')
WHERE assessment_name LIKE '%Radio%' OR assessment_name LIKE '%Communication%';

-- Module 2: Stop the Bleed
UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_name LIKE '%STOP THE BLEED%' OR module_name LIKE '%Emergency Medical%' LIMIT 1),
    category = 'Event Security Core',
    icon = COALESCE((SELECT icon FROM training_modules WHERE module_name LIKE '%STOP THE BLEED%' OR module_name LIKE '%Emergency Medical%' LIMIT 1), 'fa-first-aid')
WHERE assessment_name LIKE '%STOP THE BLEED%' OR assessment_name LIKE '%Emergency Medical%';

-- Module 3: Threat Assessment
UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_name LIKE '%Threat%' LIMIT 1),
    category = 'Event Security Core',
    icon = COALESCE((SELECT icon FROM training_modules WHERE module_name LIKE '%Threat%' LIMIT 1), 'fa-eye')
WHERE assessment_name LIKE '%Threat%';

-- Module 4: ICS-100
UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_name LIKE '%ICS%' OR module_name LIKE '%Incident Command%' LIMIT 1),
    category = 'Event Security Core',
    icon = COALESCE((SELECT icon FROM training_modules WHERE module_name LIKE '%ICS%' OR module_name LIKE '%Incident Command%' LIMIT 1), 'fa-sitemap')
WHERE assessment_name LIKE '%ICS%' OR assessment_name LIKE '%Emergency Response%';

-- Module 5: Diverse Populations
UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_name LIKE '%Diverse%' OR module_name LIKE '%Interacting%' LIMIT 1),
    category = 'Event Security Core',
    icon = COALESCE((SELECT icon FROM training_modules WHERE module_name LIKE '%Diverse%' OR module_name LIKE '%Interacting%' LIMIT 1), 'fa-people-group')
WHERE assessment_name LIKE '%Diverse%' OR assessment_name LIKE '%Interacting%';

-- Module 6: Crowd Management
UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_name LIKE '%Crowd%' LIMIT 1),
    category = 'Event Security Core',
    icon = COALESCE((SELECT icon FROM training_modules WHERE module_name LIKE '%Crowd%' LIMIT 1), 'fa-users')
WHERE assessment_name LIKE '%Crowd%';

-- Module 7: Use of Force
UPDATE assessments SET 
    module_id = (SELECT id FROM training_modules WHERE module_name LIKE '%Use of Force%' OR module_name LIKE '%Legal%' LIMIT 1),
    category = 'Event Security Core',
    icon = COALESCE((SELECT icon FROM training_modules WHERE module_name LIKE '%Use of Force%' OR module_name LIKE '%Legal%' LIMIT 1), 'fa-balance-scale')
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
