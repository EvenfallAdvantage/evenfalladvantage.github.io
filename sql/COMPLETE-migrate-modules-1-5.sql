-- COMPLETE MIGRATION: Modules 1-5 Assessment Questions
-- This migrates questions for the first 5 modules from student-portal.js
-- Run this AFTER running add-questions-json-column.sql

-- Using dollar-quote syntax ($$) to avoid escaping issues with single quotes

-- ============================================================================
-- MODULE 1: SECURITY RADIO COMMUNICATIONS (20 questions)
-- ============================================================================
UPDATE assessments
SET questions_json = $$[
    {"question": "What is the proper order of a SITREP (Situation Report)?", "options": ["What, Where, Who, When, What's Needed", "Who, What, Where, When, What's Needed", "Where, What, Who, What's Needed, When", "When, Where, What, Who, What's Needed"], "correctAnswer": 1, "explanation": "The proper SITREP order is: Who, What, Where, When, What's Needed."},
    {"question": "What should you say instead of \"Repeat\" on the radio?", "options": ["Again", "Say again", "Repeat that", "Come back"], "correctAnswer": 1, "explanation": "Use 'Say again' instead of 'Repeat' to avoid confusion with artillery commands."},
    {"question": "Who should you report to first in a non-emergency situation?", "options": ["Event Manager", "Security Manager", "Your immediate supervisor", "Any available supervisor"], "correctAnswer": 2, "explanation": "Always report to your immediate supervisor first in non-emergency situations."},
    {"question": "What does \"10-4\" mean on the radio?", "options": ["Emergency situation", "Message received and understood", "Out of service", "Need backup"], "correctAnswer": 1, "explanation": "10-4 means message received and understood."},
    {"question": "The Pause-Press-Speak formula means:", "options": ["Press PTT, pause, then speak immediately", "Think before keying, press PTT and wait 1 second, then speak", "Pause between each word while speaking", "Press PTT multiple times before speaking"], "correctAnswer": 1, "explanation": "Think before keying, press PTT, wait 1 second, then speak clearly."},
    {"question": "What should you do if your radio dies during your shift?", "options": ["Continue working and report it at end of shift", "Immediately notify supervisor using backup communication method", "Go home since you can't communicate", "Borrow another guard's radio"], "correctAnswer": 1, "explanation": "Immediately notify your supervisor using a backup communication method."},
    {"question": "What does \"10-33\" mean?", "options": ["Arrived on scene", "Emergency traffic - clear the channel", "Out of service", "What is your location?"], "correctAnswer": 1, "explanation": "10-33 means emergency traffic - clear the channel."},
    {"question": "When should you use face-to-face communication instead of radio?", "options": ["For all communications to be more personal", "For delivering sensitive information and resolving conflicts", "Never - radio is always preferred", "Only when your radio is broken"], "correctAnswer": 1, "explanation": "Use face-to-face for sensitive information and conflict resolution."},
    {"question": "What is the primary reason for regular radio check-ins during quiet periods?", "options": ["To keep yourself entertained", "To ensure your radio is working and team knows you're alert", "To practice your radio skills", "Because it's required by law"], "correctAnswer": 1, "explanation": "Check-ins ensure your radio works and the team knows you're alert."},
    {"question": "Code 3 indicates:", "options": ["Non-emergency situation", "Urgent but not emergency", "Emergency - immediate response needed", "End of shift"], "correctAnswer": 2, "explanation": "Code 3 indicates an emergency requiring immediate response."},
    {"question": "What should you include in a radio incident report?", "options": ["Your personal opinions about what happened", "Location, nature of incident, people involved, injuries, assistance needed", "Only the most dramatic details", "Wait and include everything in written report later"], "correctAnswer": 1, "explanation": "Include location, nature, people involved, injuries, and assistance needed."},
    {"question": "Why should you never use profanity on the radio?", "options": ["It might hurt someone's feelings", "Everything is recorded and can be used in legal proceedings", "Your supervisor might hear it", "It's just a suggestion, not a rule"], "correctAnswer": 1, "explanation": "Everything is recorded and can be used in legal proceedings."},
    {"question": "What does \"10-7\" mean?", "options": ["In service and available", "Out of service / on break", "Emergency", "Arrived on scene"], "correctAnswer": 1, "explanation": "10-7 means out of service or on break."},
    {"question": "When three units are trying to transmit at once causing confusion, what should happen?", "options": ["Everyone keeps trying until someone gets through", "The loudest person wins", "Supervisor takes control: \"All units standby, Command has the channel\"", "Switch to a different channel"], "correctAnswer": 2, "explanation": "Supervisor should take control and clear the channel."},
    {"question": "The chain of command helps to:", "options": ["Make sure everyone knows who the boss is", "Reduce radio clutter and ensure efficient operations", "Prevent guards from talking to each other", "Slow down emergency response"], "correctAnswer": 1, "explanation": "Chain of command reduces radio clutter and ensures efficiency."},
    {"question": "What is radio discipline?", "options": ["Punishing people who misuse radios", "Keeping radio channels clear and professional for operational effectiveness", "Only using radio during emergencies", "Speaking in a military tone"], "correctAnswer": 1, "explanation": "Radio discipline keeps channels clear and professional."},
    {"question": "An attendee is yelling at you about a policy. What should you do?", "options": ["Yell back to establish authority", "Immediately call for backup on radio", "Stay calm, listen, and explain the policy professionally", "Walk away and ignore them"], "correctAnswer": 2, "explanation": "Stay calm, listen, and explain the policy professionally."},
    {"question": "What does \"10-8\" mean?", "options": ["Out of service", "In service and available", "Emergency", "Need backup"], "correctAnswer": 1, "explanation": "10-8 means in service and available."},
    {"question": "When should you report an incident?", "options": ["Only if it's a major emergency", "Report early and report often", "Wait until you have all the details", "Only if someone asks you"], "correctAnswer": 1, "explanation": "Report early and report often."},
    {"question": "What is the main purpose of your radio in security work?", "options": ["To look professional", "Your lifeline for safety and coordination", "To communicate with friends", "Required equipment but rarely used"], "correctAnswer": 1, "explanation": "Your radio is your lifeline for safety and coordination."}
]$$::jsonb,
total_questions = 20
WHERE assessment_name LIKE '%Radio%' OR assessment_name LIKE '%Communication%';

-- ============================================================================
-- MODULE 2: STOP THE BLEED (13 questions)
-- ============================================================================
UPDATE assessments
SET questions_json = $$[
    {"question": "What are the 3 steps to stop bleeding?", "options": ["Call 911, wait, and watch", "Apply pressure, pack the wound, apply tourniquet", "Elevate, ice, and bandage", "Clean, cover, and transport"], "correctAnswer": 1, "explanation": "The 3 steps are: Apply pressure, pack the wound, apply tourniquet."},
    {"question": "How quickly can severe bleeding cause death?", "options": ["Within 30 minutes", "Within 5 minutes or less", "Within 15-20 minutes", "Within 1 hour"], "correctAnswer": 1, "explanation": "Severe bleeding can cause death within 5 minutes or less."},
    {"question": "What does the ABC acronym stand for in identifying life-threatening bleeding?", "options": ["Airway, Breathing, Circulation", "Alert, Bleeding, Compress", "Assess, Bandage, Call", "Arterial, Blood, Capillary"], "correctAnswer": 0, "explanation": "ABC stands for Airway, Breathing, Circulation."},
    {"question": "What is the FIRST priority before providing bleeding control?", "options": ["Call 911", "Ensure scene safety", "Put on gloves", "Locate the bleeding"], "correctAnswer": 1, "explanation": "Always ensure scene safety first."},
    {"question": "What is the primary tool for stopping bleeding?", "options": ["Tourniquet", "Direct pressure", "Wound packing", "Elevation"], "correctAnswer": 1, "explanation": "Direct pressure is the primary tool for stopping bleeding."},
    {"question": "When should you pack a wound?", "options": ["For all bleeding wounds", "For deep wounds in junctional areas (neck, groin, armpit)", "Only for arm and leg wounds", "Never - always use tourniquets"], "correctAnswer": 1, "explanation": "Pack deep wounds in junctional areas where tourniquets can't be used."},
    {"question": "Where should a tourniquet be placed?", "options": ["Directly on the wound", "2-3 inches above the wound, never on a joint", "On the nearest joint", "As close to the body as possible"], "correctAnswer": 1, "explanation": "Place tourniquet 2-3 inches above the wound, never on a joint."},
    {"question": "How tight should a tourniquet be?", "options": ["Tight enough to slow bleeding", "Tight enough to stop bleeding completely", "Just snug, not too tight", "As tight as possible regardless of bleeding"], "correctAnswer": 1, "explanation": "Tourniquet must be tight enough to stop bleeding completely."},
    {"question": "What should you do after applying a tourniquet?", "options": ["Loosen it every 5 minutes", "Write the exact time on the tourniquet or victim's forehead", "Remove it once bleeding stops", "Apply a second one for safety"], "correctAnswer": 1, "explanation": "Write the exact time on the tourniquet or victim's forehead."},
    {"question": "Can you remove a tourniquet once applied?", "options": ["Yes, after 10 minutes", "No, only trained medical professionals can remove it", "Yes, once bleeding stops", "Yes, if the victim complains of pain"], "correctAnswer": 1, "explanation": "Only trained medical professionals can remove a tourniquet."},
    {"question": "Why is a belt NOT a good tourniquet?", "options": ["It's too short", "It's too wide and won't provide enough pressure", "It's too expensive", "It's too uncomfortable"], "correctAnswer": 1, "explanation": "Belts are too wide and won't provide enough pressure."},
    {"question": "When calling for help, what should you say?", "options": ["Someone is hurt", "Life-threatening bleeding at [specific location]", "Send an ambulance", "We need help now"], "correctAnswer": 1, "explanation": "Be specific: 'Life-threatening bleeding at [specific location]'."},
    {"question": "What critical rule applies when calling for help?", "options": ["Call quietly so you don't panic the victim", "Don't assume someone else called - delegate out loud", "Wait until you've stopped the bleeding", "Only call if the victim asks you to"], "correctAnswer": 1, "explanation": "Don't assume someone else called - delegate out loud."}
]$$::jsonb,
total_questions = 13
WHERE assessment_name LIKE '%BLEED%' OR assessment_name LIKE '%Medical%';

-- Verify the migration
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
WHERE tm.display_order IN (1, 2)
ORDER BY tm.display_order;
