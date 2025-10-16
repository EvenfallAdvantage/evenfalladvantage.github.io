-- COMPLETE MIGRATION: Module 7 - Use of Force General Questions
-- This migrates the 8 general use-of-force questions that apply to all states
-- The 7 state-specific questions will remain dynamically generated
-- Run this AFTER running add-questions-json-column.sql

-- Using dollar-quote syntax ($$) to avoid escaping issues with single quotes

-- ============================================================================
-- MODULE 7: LEGAL ASPECTS & USE OF FORCE (8 General Questions)
-- ============================================================================
-- Note: These are the general questions that apply to all states.
-- State-specific questions (licensing, training hours, etc.) are generated dynamically.

UPDATE assessments
SET questions_json = $$[
    {"question": "What is the legal status of a security guard?", "options": ["A law enforcement officer with arrest powers", "A private citizen with the same authority as any citizen", "A government official with special legal authority", "An agent of the police department"], "correctAnswer": 1, "explanation": "Security guards are private citizens with the same legal authority as any other citizen."},
    {"question": "The use of force continuum starts with which level?", "options": ["Verbal commands", "Officer presence in uniform", "Physical control", "Defensive tactics"], "correctAnswer": 1, "explanation": "The use of force continuum starts with officer presence in uniform."},
    {"question": "When is a security guard legally allowed to use physical force?", "options": ["To enforce company rules", "Only for self-defense or defense of others from imminent harm", "Whenever someone refuses commands", "To detain suspects"], "correctAnswer": 1, "explanation": "Physical force is only allowed for self-defense or defense of others from imminent harm."},
    {"question": "What does \"reasonable force\" mean?", "options": ["Any force necessary to gain compliance", "Force that is proportional to the threat", "Maximum force allowed by policy", "Force approved by supervisor"], "correctAnswer": 1, "explanation": "Reasonable force is force that is proportional to the threat."},
    {"question": "What should you do if someone refuses to leave the property?", "options": ["Physically escort them off immediately", "Call police and let them handle it", "Use force to drag them out", "Threaten them with arrest"], "correctAnswer": 1, "explanation": "Call police and let them handle trespassing situations."},
    {"question": "What is the main risk of attempting a citizen's arrest?", "options": ["Complaint with management", "High liability for false arrest and assault lawsuits", "Temporary license suspension", "Extensive paperwork"], "correctAnswer": 1, "explanation": "Citizen's arrests carry high liability for false arrest and assault lawsuits."},
    {"question": "If you use excessive force, you could face:", "options": ["A written warning", "Criminal charges, civil lawsuits, and license revocation", "Mandatory retraining", "Suspension without pay"], "correctAnswer": 1, "explanation": "Excessive force can result in criminal charges, civil lawsuits, and license revocation."},
    {"question": "What is the most important thing to do after any use of force incident?", "options": ["Leave the scene immediately", "Document everything and notify supervisor", "Discuss with coworkers first", "Wait 24 hours before reporting"], "correctAnswer": 1, "explanation": "Always document everything and notify your supervisor immediately after any use of force incident."}
]$$::jsonb,
total_questions = 8,
updated_at = NOW()
WHERE assessment_name LIKE '%Use of Force%' OR assessment_name LIKE '%Legal Aspects%';

-- Add a note field to indicate this assessment uses hybrid questions
COMMENT ON COLUMN assessments.questions_json IS 'For Module 7 (Use of Force): Contains 8 general questions. 7 additional state-specific questions are generated dynamically based on user state selection.';

-- Verify Module 7
SELECT 
    tm.module_name,
    tm.display_order,
    a.assessment_name,
    a.total_questions,
    jsonb_array_length(a.questions_json) as actual_questions,
    CASE 
        WHEN jsonb_array_length(a.questions_json) = a.total_questions THEN '✓ Match'
        ELSE '✗ Mismatch'
    END as status
FROM assessments a
JOIN training_modules tm ON a.module_id = tm.id
WHERE tm.display_order = 7;
