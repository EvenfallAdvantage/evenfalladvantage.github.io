-- Migrate hardcoded assessment questions from JavaScript to database
-- This extracts the questions from student-portal.js and populates the assessments table
-- Run this in Supabase SQL Editor AFTER running add-questions-json-column.sql

-- First, ensure the questions_json column exists
-- (Run add-questions-json-column.sql first if you haven't already)

-- Module 4: Crowd Management & Public Safety
UPDATE assessments
SET questions_json = '[
    {"question": "What is the primary goal of crowd management at events?", "options": ["To maximize revenue by allowing as many people as possible", "To maintain safety and order for all attendees", "To provide entertainment and enhance the guest experience", "To promote merchandise sales and concession purchases"], "correctAnswer": 1, "explanation": "The primary goal is to maintain safety and order for all attendees."},
    {"question": "What should you do if you notice overcrowding in a specific area?", "options": ["Ignore it and focus on your assigned duties only", "Alert supervisor and help redirect crowd flow away from the area", "Leave your post to personally investigate the situation", "Take a break and let someone else handle the problem"], "correctAnswer": 1, "explanation": "Alert your supervisor and help redirect crowd flow to prevent dangerous overcrowding."},
    {"question": "Which is a warning sign of potential crowd problems?", "options": ["People laughing and enjoying themselves at the event", "Sudden crowd surges or pushing in a specific direction", "People taking photos and videos with their phones", "Normal conversation and social interaction among guests"], "correctAnswer": 1, "explanation": "Sudden crowd surges or pushing indicate potential crowd control issues."},
    {"question": "What is the purpose of using barriers at events?", "options": ["To serve as decoration and enhance the venue aesthetics", "To control crowd flow and create safe pathways for movement", "To completely block all movement in certain directions", "To create obstacles that slow down crowd movement"], "correctAnswer": 1, "explanation": "Barriers control crowd flow and create safe pathways."},
    {"question": "When managing queues, you should:", "options": ["Let people push and shove to get through faster", "Maintain orderly lines and enforce fair access for everyone", "Allow friends and family members to cut in line together", "Ignore the situation and let people self-organize naturally"], "correctAnswer": 1, "explanation": "Maintain orderly lines and enforce fair access for everyone."},
    {"question": "If someone appears distressed in a crowd, you should:", "options": ["Ignore them and continue monitoring the larger crowd", "Assist them to a less crowded area and assess their condition", "Tell them to deal with it themselves and move along", "Walk away and radio for someone else to handle it"], "correctAnswer": 1, "explanation": "Assist distressed individuals to a safer area and assess their condition."},
    {"question": "What is crowd density?", "options": ["How loud the crowd is and the noise level", "The number of people per square meter in an area", "How happy and energetic the people are feeling", "The average age and demographics of attendees"], "correctAnswer": 1, "explanation": "Crowd density is the number of people per square meter."},
    {"question": "Emergency exits should be:", "options": ["Blocked for security purposes to prevent unauthorized access", "Kept clear and accessible at all times for safe evacuation", "Used for storage of equipment and supplies during events", "Locked during events to prevent people from leaving early"], "correctAnswer": 1, "explanation": "Emergency exits must always be kept clear and accessible."},
    {"question": "If you see aggressive behavior starting in a crowd, you should:", "options": ["Join in to help control the aggressive individuals physically", "Alert supervisor and attempt to de-escalate if safe to do so", "Ignore it unless someone specifically asks for your help", "Encourage people to resolve their differences on their own"], "correctAnswer": 1, "explanation": "Alert your supervisor and attempt to de-escalate if it is safe to do so."},
    {"question": "Preventive positioning means:", "options": ["Hiding from the crowd in a secure location backstage", "Strategically placing guards to deter problems before they start", "Standing in one spot all day without moving around", "Avoiding problem areas and staying in comfortable zones"], "correctAnswer": 1, "explanation": "Preventive positioning means strategically placing guards to deter problems."}
]'::jsonb,
total_questions = 10
WHERE assessment_name LIKE '%Crowd Management%';

-- Module 5: Emergency Response Procedures  
UPDATE assessments
SET questions_json = '[
    {"question": "What does the \"A\" in the emergency response protocol \"5 A''s\" stand for?", "options": ["Attack the problem immediately without hesitation", "Assess the situation quickly and evaluate severity", "Avoid getting involved until backup arrives on scene", "Announce the emergency over the PA system first"], "correctAnswer": 1, "explanation": "Assess the situation quickly and evaluate severity."},
    {"question": "If you discover a medical emergency, your first action should be:", "options": ["Move the person to a more comfortable location immediately", "Call for medical assistance and alert your supervisor right away", "Give them water or other liquids to help them feel better", "Take a photo to document the incident for your records"], "correctAnswer": 1, "explanation": "Call for medical assistance and alert your supervisor immediately."},
    {"question": "During an evacuation, you should:", "options": ["Run and save yourself", "Remain calm, give clear directions, and assist attendees to exits", "Lock all doors", "Hide"], "correctAnswer": 1, "explanation": "Remain calm, give clear directions, and assist attendees to exits."},
    {"question": "What is Code 3 typically used for?", "options": ["Lunch break time and scheduled rest periods for staff", "Emergency situation requiring immediate response and assistance", "Normal patrol activities and routine security rounds", "End of shift procedures and signing out for the day"], "correctAnswer": 1, "explanation": "Code 3 indicates an emergency requiring immediate response."},
    {"question": "If someone is having a seizure, you should:", "options": ["Hold them down", "Clear the area, protect their head, and call for medical help", "Give them food", "Pour water on them"], "correctAnswer": 1, "explanation": "Clear the area, protect their head, and call for medical help."},
    {"question": "When guiding EMS to an emergency, you should:", "options": ["Let them find it themselves", "Meet them and provide fastest route, clearing path", "Give vague directions", "Tell them to wait"], "correctAnswer": 1, "explanation": "Meet EMS and provide the fastest route while clearing the path."},
    {"question": "What should you do if you smell smoke?", "options": ["Ignore it", "Investigate safely, alert supervisor, and be ready to evacuate", "Start filming", "Leave immediately without telling anyone"], "correctAnswer": 1, "explanation": "Investigate safely, alert supervisor, and be ready to evacuate."},
    {"question": "In an active threat situation, your priority is:", "options": ["Confront the threat alone", "Alert authorities, help people evacuate safely, follow Run-Hide-Fight protocol", "Take photos", "Do nothing"], "correctAnswer": 1, "explanation": "Alert authorities, help evacuate, and follow Run-Hide-Fight protocol."},
    {"question": "After an emergency, you must:", "options": ["Forget about it", "Complete an incident report with all details", "Tell your friends", "Change the story"], "correctAnswer": 1, "explanation": "Complete a detailed incident report."},
    {"question": "Heat exhaustion symptoms include:", "options": ["Feeling cold", "Heavy sweating, weakness, nausea, dizziness", "Increased energy", "Improved mood"], "correctAnswer": 1, "explanation": "Heat exhaustion causes heavy sweating, weakness, nausea, and dizziness."}
]'::jsonb,
total_questions = 10
WHERE assessment_name LIKE '%Emergency Response%';

-- Module 6: Access Control & Screening
UPDATE assessments
SET questions_json = '[
    {"question": "When checking tickets at entry, you should:", "options": ["Let everyone through quickly to avoid creating long lines", "Verify each ticket carefully and check for signs of tampering", "Only check some tickets randomly to save time and effort", "Ignore the tickets and just count people entering the venue"], "correctAnswer": 1, "explanation": "Verify each ticket carefully and check for signs of tampering."},
    {"question": "If someone refuses to allow a bag search, you should:", "options": ["Let them in anyway", "Politely explain policy and deny entry if they refuse, call supervisor", "Force them", "Argue with them"], "correctAnswer": 1, "explanation": "Politely explain the policy and deny entry if they refuse."},
    {"question": "Which item is typically prohibited at events?", "options": ["Cell phones and other personal electronic devices", "Weapons and glass containers that pose safety risks", "Clothing items with offensive logos or messages", "Shoes and footwear that don''t meet dress code"], "correctAnswer": 1, "explanation": "Weapons and glass containers are typically prohibited."},
    {"question": "When operating a metal detector, if it alarms you should:", "options": ["Let them through", "Conduct secondary screening with hand wand and ask about metal objects", "Send them away", "Ignore it"], "correctAnswer": 1, "explanation": "Conduct secondary screening with a hand wand."},
    {"question": "If you find a prohibited item, you should:", "options": ["Keep it for yourself", "Confiscate per policy, document it, and offer alternatives like returning to vehicle", "Throw it away secretly", "Give it back"], "correctAnswer": 1, "explanation": "Confiscate per policy, document it, and offer alternatives."},
    {"question": "VIP credentials should be:", "options": ["Ignored", "Verified against access list and checked for authenticity", "Accepted without checking", "Shared with friends"], "correctAnswer": 1, "explanation": "Verify VIP credentials against the access list."},
    {"question": "If someone tries to bribe you for entry, you should:", "options": ["Accept the money", "Refuse, deny entry, and report to supervisor", "Negotiate", "Let them in"], "correctAnswer": 1, "explanation": "Refuse the bribe, deny entry, and report to your supervisor."},
    {"question": "When denying entry, you should:", "options": ["Be rude and aggressive", "Be professional, explain reason clearly, and remain calm", "Argue loudly", "Push them away"], "correctAnswer": 1, "explanation": "Be professional, explain the reason clearly, and remain calm."},
    {"question": "Re-entry procedures typically include:", "options": ["No checks needed", "Hand stamps/wristbands verification and re-screening", "Just waving people through", "Denying all re-entry"], "correctAnswer": 1, "explanation": "Re-entry requires hand stamps/wristbands verification and re-screening."},
    {"question": "If you suspect a fake ticket, you should:", "options": ["Let them in", "Detain ticket, call supervisor, and verify with box office", "Accuse them loudly", "Ignore it"], "correctAnswer": 1, "explanation": "Detain the ticket, call supervisor, and verify with box office."}
]'::jsonb,
total_questions = 10
WHERE assessment_name LIKE '%Access%' OR assessment_name LIKE '%Screening%';

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
ORDER BY tm.display_order;
