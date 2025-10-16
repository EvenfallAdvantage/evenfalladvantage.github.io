-- COMPLETE MIGRATION: Modules 3-5 Assessment Questions
-- This migrates questions for modules 3-5 from student-portal.js
-- Run this AFTER running add-questions-json-column.sql and the previous migrations

-- Using dollar-quote syntax ($$) to avoid escaping issues with single quotes

-- ============================================================================
-- MODULE 3: THREAT ASSESSMENT & SITUATIONAL AWARENESS (20 questions)
-- ============================================================================
UPDATE assessments
SET questions_json = $$[
    {"question": "What is situational awareness?", "options": ["Being aware of your schedule and appointments", "The ability to identify, process, and comprehend critical information about your environment", "Knowing where all exits are located", "Watching security cameras constantly"], "correctAnswer": 1, "explanation": "Situational awareness is the ability to identify, process, and comprehend critical information about your environment."},
    {"question": "In Cooper's Color Codes, what does \"Condition Yellow\" mean?", "options": ["Unaware of surroundings - avoid this state", "Relaxed alert - aware of surroundings, no specific threats (normal for security)", "Specific threat identified, assessing options", "Immediate threat, taking action"], "correctAnswer": 1, "explanation": "Condition Yellow is relaxed alert - aware of surroundings with no specific threats."},
    {"question": "What is de-escalation?", "options": ["Using force to control a situation", "Techniques used to prevent a situation from escalating to violence", "Calling for backup immediately", "Removing yourself from any conflict"], "correctAnswer": 1, "explanation": "De-escalation uses techniques to prevent situations from escalating to violence."},
    {"question": "The \"21-Foot Rule\" states that:", "options": ["You must stay 21 feet away from all threats", "A person with a knife can close 21 feet in about 1.5 seconds", "You should maintain 21 feet of personal space", "Backup must arrive within 21 seconds"], "correctAnswer": 1, "explanation": "A person with a knife can close 21 feet in about 1.5 seconds."},
    {"question": "What does the \"L\" in the LEAPS de-escalation model stand for?", "options": ["Look for weapons", "Listen actively to their concerns", "Leave the area if unsafe", "Lock down the perimeter"], "correctAnswer": 1, "explanation": "L stands for Listen actively to their concerns."},
    {"question": "Which phrase should you AVOID when de-escalating?", "options": ["\"I want to help you\"", "\"Calm down\" or \"Relax\"", "\"I understand this is frustrating\"", "\"Let's work together to find a solution\""], "correctAnswer": 1, "explanation": "Avoid saying 'Calm down' or 'Relax' as it can escalate the situation."},
    {"question": "What is the difference between cover and concealment?", "options": ["There is no difference, they mean the same thing", "Cover stops bullets, concealment only hides you", "Concealment stops bullets, cover only hides you", "Cover is for active shooters, concealment is for fights"], "correctAnswer": 1, "explanation": "Cover stops bullets, concealment only hides you."},
    {"question": "Pre-attack indicators include all of the following EXCEPT:", "options": ["Surveillance of security procedures", "Asking unusual questions about security", "Wearing appropriate clothing for the weather", "Testing security by probing for weaknesses"], "correctAnswer": 2, "explanation": "Wearing appropriate clothing for the weather is normal behavior, not a pre-attack indicator."},
    {"question": "When is de-escalation NOT appropriate?", "options": ["When someone is frustrated or angry", "When a weapon is displayed or there's imminent threat to life", "When someone is intoxicated", "When someone is arguing loudly"], "correctAnswer": 1, "explanation": "De-escalation is not appropriate when there's a weapon or imminent threat to life."},
    {"question": "What is the recommended distance to maintain during a tense interaction?", "options": ["1-2 feet to show you're not afraid", "6-10 feet when possible", "15-20 feet minimum", "As close as needed to hear them"], "correctAnswer": 1, "explanation": "Maintain 6-10 feet when possible during tense interactions."},
    {"question": "The OODA Loop stands for:", "options": ["Observe, Operate, Decide, Act", "Observe, Orient, Decide, Act", "Order, Orient, Deploy, Assess", "Observe, Organize, Defend, Alert"], "correctAnswer": 1, "explanation": "OODA Loop: Observe, Orient, Decide, Act."},
    {"question": "What should you do if de-escalation fails and the situation becomes violent?", "options": ["Continue trying to talk them down", "Disengage if possible, call law enforcement, use only necessary force to protect life", "Immediately use maximum force", "Wait for the person to calm down on their own"], "correctAnswer": 1, "explanation": "Disengage if possible, call law enforcement, and use only necessary force."},
    {"question": "A threat is defined as:", "options": ["Any dangerous situation", "Intent + Capability", "Only physical violence", "Something that scares you"], "correctAnswer": 1, "explanation": "A threat is defined as Intent + Capability."},
    {"question": "What are the 3 stages of the threat assessment cycle?", "options": ["See, Report, Act", "Detection, Evaluation, Response", "Observe, Decide, Execute", "Identify, Contain, Resolve"], "correctAnswer": 1, "explanation": "The 3 stages are Detection, Evaluation, Response."},
    {"question": "What does \"baseline vs. anomaly\" mean?", "options": ["Comparing different security posts", "Knowing normal behavior to spot abnormal behavior", "Measuring crowd sizes", "Checking equipment standards"], "correctAnswer": 1, "explanation": "Knowing normal behavior helps you spot abnormal behavior."},
    {"question": "The risk formula is:", "options": ["Risk = Threat + Vulnerability", "Risk = Threat × Vulnerability × Consequence", "Risk = Threat - Protection", "Risk = Danger × Time"], "correctAnswer": 1, "explanation": "Risk = Threat × Vulnerability × Consequence."},
    {"question": "What is the \"25-50-100 Rule\"?", "options": ["Maximum crowd capacity limits", "Know your 25, 50, and 100-foot environment", "Response time standards", "Radio check intervals"], "correctAnswer": 1, "explanation": "Know your 25, 50, and 100-foot environment."},
    {"question": "Weapon pre-indicators include:", "options": ["Smiling and waving", "Blading body, adjusting waistband, hand near pocket", "Walking slowly", "Making eye contact"], "correctAnswer": 1, "explanation": "Weapon pre-indicators include blading body, adjusting waistband, hand near pocket."},
    {"question": "The Ask-Tell-Command progression means:", "options": ["Always command first to show authority", "Start with asking, escalate to telling, then commanding if needed", "Never ask, only tell and command", "Ask three times before giving up"], "correctAnswer": 1, "explanation": "Start with asking, escalate to telling, then commanding if needed."},
    {"question": "What critical mindset should you have about reporting threats?", "options": ["Only report if you're 100% certain", "You don't have to be right—you just have to speak up", "Wait for someone else to report it", "Never report unless supervisor asks"], "correctAnswer": 1, "explanation": "You don't have to be right—you just have to speak up."}
]$$::jsonb,
total_questions = 20
WHERE assessment_name LIKE '%Threat%' OR assessment_name LIKE '%Situational%';

-- Verify Module 3
SELECT 
    tm.module_name,
    tm.display_order,
    a.assessment_name,
    a.total_questions,
    jsonb_array_length(a.questions_json) as actual_questions
FROM assessments a
JOIN training_modules tm ON a.module_id = tm.id
WHERE tm.display_order = 3;
