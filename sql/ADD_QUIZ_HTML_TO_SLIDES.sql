-- =====================================================
-- ADD INTERACTIVE QUIZ HTML TO DATABASE SLIDES
-- =====================================================
-- The DB slides currently have quiz text as plain HTML
-- without the interactive slide-quiz-option classes.
-- This migration adds the proper interactive quiz HTML
-- so the embed-viewer can wire up click handlers.
--
-- Modules affected:
--   communication-protocols: 5 quizzes
--   stop-the-bleed: 1 quiz
--   threat-assessment: 5 quizzes
--
-- Run this on the LEGACY Supabase SQL Editor.
-- =====================================================

-- =====================================================
-- COMMUNICATION-PROTOCOLS: Knowledge Check 1
-- =====================================================
UPDATE module_slides
SET content = $$<h3>Quick Quiz Question 1</h3>
<div class="slide-quiz" data-quiz-id="comm-q1">
    <p class="slide-quiz-question">What is the proper order of a SITREP?</p>
    <div class="slide-quiz-options">
        <div class="slide-quiz-option" data-answer="0">What, Where, Who, When, What's Needed</div>
        <div class="slide-quiz-option" data-answer="1" data-correct="true">Who, What, Where, When, What's Needed</div>
        <div class="slide-quiz-option" data-answer="2">Where, What, Who, What's Needed, When</div>
        <div class="slide-quiz-option" data-answer="3">When, Where, What, Who, What's Needed</div>
    </div>
    <div class="slide-quiz-feedback"></div>
</div>$$
WHERE module_id = (SELECT id FROM training_modules WHERE module_code = 'communication-protocols')
  AND title ILIKE '%Knowledge Check 1%';

-- =====================================================
-- COMMUNICATION-PROTOCOLS: Knowledge Check 2
-- =====================================================
UPDATE module_slides
SET content = $$<h3>Quick Quiz Question 2</h3>
<div class="slide-quiz" data-quiz-id="comm-q2">
    <p class="slide-quiz-question">What should you say instead of "Repeat" on the radio?</p>
    <div class="slide-quiz-options">
        <div class="slide-quiz-option" data-answer="0">Again</div>
        <div class="slide-quiz-option" data-answer="1" data-correct="true">Say again</div>
        <div class="slide-quiz-option" data-answer="2">Repeat that</div>
        <div class="slide-quiz-option" data-answer="3">Come back</div>
    </div>
    <div class="slide-quiz-feedback"></div>
</div>
<p><strong>Why?</strong> "Repeat" is a military term meaning "fire again" and should never be used in radio communications.</p>$$
WHERE module_id = (SELECT id FROM training_modules WHERE module_code = 'communication-protocols')
  AND title ILIKE '%Knowledge Check 2%';

-- =====================================================
-- COMMUNICATION-PROTOCOLS: Knowledge Check 3
-- =====================================================
UPDATE module_slides
SET content = $$<h3>Quick Quiz Question 3</h3>
<div class="slide-quiz" data-quiz-id="comm-q3">
    <p class="slide-quiz-question">Who should you report to first in a non-emergency situation?</p>
    <div class="slide-quiz-options">
        <div class="slide-quiz-option" data-answer="0">Event Manager</div>
        <div class="slide-quiz-option" data-answer="1">Security Manager</div>
        <div class="slide-quiz-option" data-answer="2" data-correct="true">Your immediate supervisor</div>
        <div class="slide-quiz-option" data-answer="3">Any available supervisor</div>
    </div>
    <div class="slide-quiz-feedback"></div>
</div>
<p><strong>Remember:</strong> Follow the chain of command to reduce radio clutter and ensure efficient operations.</p>$$
WHERE module_id = (SELECT id FROM training_modules WHERE module_code = 'communication-protocols')
  AND title ILIKE '%Knowledge Check 3%';

-- =====================================================
-- COMMUNICATION-PROTOCOLS: Knowledge Check 4
-- =====================================================
UPDATE module_slides
SET content = $$<h3>Quick Quiz Question 4</h3>
<div class="slide-quiz" data-quiz-id="comm-q4">
    <p class="slide-quiz-question">An attendee is yelling at you about a policy. What should you do?</p>
    <div class="slide-quiz-options">
        <div class="slide-quiz-option" data-answer="0">Yell back to establish authority</div>
        <div class="slide-quiz-option" data-answer="1">Immediately call for backup on radio</div>
        <div class="slide-quiz-option" data-answer="2" data-correct="true">Stay calm, listen, and explain the policy professionally</div>
        <div class="slide-quiz-option" data-answer="3">Walk away and ignore them</div>
    </div>
    <div class="slide-quiz-feedback"></div>
</div>
<p><strong>Key Point:</strong> De-escalation and professional communication can resolve most conflicts without backup.</p>$$
WHERE module_id = (SELECT id FROM training_modules WHERE module_code = 'communication-protocols')
  AND title ILIKE '%Knowledge Check 4%';

-- =====================================================
-- COMMUNICATION-PROTOCOLS: Knowledge Check 5
-- =====================================================
UPDATE module_slides
SET content = $$<h3>Quick Quiz Question 5</h3>
<div class="slide-quiz" data-quiz-id="comm-q5">
    <p class="slide-quiz-question">What should you do if your radio dies during your shift?</p>
    <div class="slide-quiz-options">
        <div class="slide-quiz-option" data-answer="0">Continue working and report it at end of shift</div>
        <div class="slide-quiz-option" data-answer="1" data-correct="true">Immediately notify supervisor using backup communication method</div>
        <div class="slide-quiz-option" data-answer="2">Go home since you can't communicate</div>
        <div class="slide-quiz-option" data-answer="3">Borrow another guard's radio</div>
    </div>
    <div class="slide-quiz-feedback"></div>
</div>
<p><strong>Remember:</strong> A working radio is essential for safety. Never operate without communication capability.</p>$$
WHERE module_id = (SELECT id FROM training_modules WHERE module_code = 'communication-protocols')
  AND title ILIKE '%Knowledge Check 5%';

-- =====================================================
-- STOP-THE-BLEED: Quiz
-- =====================================================
UPDATE module_slides
SET content = $$<h3>Knowledge Check</h3>
<div class="slide-quiz" data-quiz-id="stb-q1">
    <p class="slide-quiz-question">What are the 3 ways to stop bleeding?</p>
    <div class="slide-quiz-options">
        <div class="slide-quiz-option" data-answer="0">Call 911, wait, and watch</div>
        <div class="slide-quiz-option" data-answer="1" data-correct="true">Apply pressure, pack the wound, apply tourniquet</div>
        <div class="slide-quiz-option" data-answer="2">Elevate, ice, and bandage</div>
        <div class="slide-quiz-option" data-answer="3">Clean, cover, and transport</div>
    </div>
    <div class="slide-quiz-feedback"></div>
</div>$$
WHERE module_id = (SELECT id FROM training_modules WHERE module_code = 'stop-the-bleed')
  AND (title ILIKE '%STOP THE BLEED%Quiz%' OR title ILIKE '%Knowledge Check%');

-- =====================================================
-- THREAT-ASSESSMENT: Knowledge Check 1
-- =====================================================
UPDATE module_slides
SET content = $$<h3>Quiz Question 1</h3>
<div class="slide-quiz" data-quiz-id="threat-q1">
    <p class="slide-quiz-question">What does OODA stand for?</p>
    <div class="slide-quiz-options">
        <div class="slide-quiz-option" data-answer="0">Order, Organize, Deploy, Act</div>
        <div class="slide-quiz-option" data-answer="1" data-correct="true">Observe, Orient, Decide, Act</div>
        <div class="slide-quiz-option" data-answer="2">Observe, Operate, Defend, Assess</div>
        <div class="slide-quiz-option" data-answer="3">Organize, Orient, Direct, Activate</div>
    </div>
    <div class="slide-quiz-feedback"></div>
</div>$$
WHERE module_id = (SELECT id FROM training_modules WHERE module_code = 'threat-assessment')
  AND title ILIKE '%Knowledge Check 1%';

-- =====================================================
-- THREAT-ASSESSMENT: Knowledge Check 2
-- =====================================================
UPDATE module_slides
SET content = $$<h3>Quiz Question 2</h3>
<div class="slide-quiz" data-quiz-id="threat-q2">
    <p class="slide-quiz-question">Name two signs of escalation:</p>
    <div class="slide-quiz-options">
        <div class="slide-quiz-option" data-answer="0">Smiling and waving</div>
        <div class="slide-quiz-option" data-answer="1" data-correct="true">Raised voice and clenched fists</div>
        <div class="slide-quiz-option" data-answer="2">Sitting quietly and waiting</div>
        <div class="slide-quiz-option" data-answer="3">Walking away calmly</div>
    </div>
    <div class="slide-quiz-feedback"></div>
</div>$$
WHERE module_id = (SELECT id FROM training_modules WHERE module_code = 'threat-assessment')
  AND title ILIKE '%Knowledge Check 2%';

-- =====================================================
-- THREAT-ASSESSMENT: Knowledge Check 3
-- =====================================================
UPDATE module_slides
SET content = $$<h3>Quiz Question 3</h3>
<div class="slide-quiz" data-quiz-id="threat-q3">
    <p class="slide-quiz-question">What's the difference between risk and threat?</p>
    <div class="slide-quiz-options">
        <div class="slide-quiz-option" data-answer="0">They mean the same thing</div>
        <div class="slide-quiz-option" data-answer="1" data-correct="true">Threat = intent + capability; Risk = potential for harm</div>
        <div class="slide-quiz-option" data-answer="2">Risk is more dangerous than threat</div>
        <div class="slide-quiz-option" data-answer="3">Threat is imaginary, risk is real</div>
    </div>
    <div class="slide-quiz-feedback"></div>
</div>$$
WHERE module_id = (SELECT id FROM training_modules WHERE module_code = 'threat-assessment')
  AND title ILIKE '%Knowledge Check 3%';

-- =====================================================
-- THREAT-ASSESSMENT: Knowledge Check 4
-- =====================================================
UPDATE module_slides
SET content = $$<h3>Quiz Question 4</h3>
<div class="slide-quiz" data-quiz-id="threat-q4">
    <p class="slide-quiz-question">What's the purpose of de-escalation?</p>
    <div class="slide-quiz-options">
        <div class="slide-quiz-option" data-answer="0">To show you're in charge</div>
        <div class="slide-quiz-option" data-answer="1" data-correct="true">To disrupt emotional momentum and prevent violence</div>
        <div class="slide-quiz-option" data-answer="2">To make friends with everyone</div>
        <div class="slide-quiz-option" data-answer="3">To delay calling for backup</div>
    </div>
    <div class="slide-quiz-feedback"></div>
</div>$$
WHERE module_id = (SELECT id FROM training_modules WHERE module_code = 'threat-assessment')
  AND title ILIKE '%Knowledge Check 4%';

-- =====================================================
-- THREAT-ASSESSMENT: Knowledge Check 5
-- =====================================================
UPDATE module_slides
SET content = $$<h3>Quiz Question 5</h3>
<div class="slide-quiz" data-quiz-id="threat-q5">
    <p class="slide-quiz-question">What are the 3 components of the tactical de-escalation framework?</p>
    <div class="slide-quiz-options">
        <div class="slide-quiz-option" data-answer="0">Talk, Listen, Act</div>
        <div class="slide-quiz-option" data-answer="1" data-correct="true">Time, Distance, and Cover</div>
        <div class="slide-quiz-option" data-answer="2">Observe, Report, Respond</div>
        <div class="slide-quiz-option" data-answer="3">Assess, Engage, Retreat</div>
    </div>
    <div class="slide-quiz-feedback"></div>
</div>$$
WHERE module_id = (SELECT id FROM training_modules WHERE module_code = 'threat-assessment')
  AND title ILIKE '%Knowledge Check 5%';

-- =====================================================
-- VERIFY: Check how many slides were updated
-- =====================================================
SELECT 
  tm.module_code,
  tm.module_name,
  COUNT(*) FILTER (WHERE ms.content LIKE '%slide-quiz%') as slides_with_quizzes
FROM training_modules tm
JOIN module_slides ms ON tm.id = ms.module_id
WHERE tm.module_code IN ('communication-protocols', 'stop-the-bleed', 'threat-assessment')
GROUP BY tm.id, tm.module_code, tm.module_name
ORDER BY tm.module_code;
