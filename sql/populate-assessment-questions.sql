-- Populate assessments with placeholder questions
-- This creates 10 sample questions for each assessment that can be edited by admins

-- Update each assessment with placeholder questions
-- Module 1: Introduction to Event Security
UPDATE assessments
SET questions_json = '[
    {
        "question": "What is the primary role of an event security guard?",
        "options": ["To entertain guests", "To ensure safety and security", "To sell tickets", "To serve food"],
        "correctAnswer": 1,
        "explanation": "The primary role is to ensure the safety and security of all attendees and staff."
    },
    {
        "question": "Which of the following is a key responsibility of event security?",
        "options": ["Access control", "Cooking meals", "Designing the venue", "Selling merchandise"],
        "correctAnswer": 0,
        "explanation": "Access control is a fundamental security responsibility."
    },
    {
        "question": "What should you do if you notice suspicious behavior?",
        "options": ["Ignore it", "Report it immediately", "Take a photo", "Ask the person directly"],
        "correctAnswer": 1,
        "explanation": "Always report suspicious behavior to your supervisor immediately."
    },
    {
        "question": "Professional appearance is important because:",
        "options": ["It makes you look good", "It builds trust and authority", "It is required by law", "It helps you get promoted"],
        "correctAnswer": 1,
        "explanation": "Professional appearance builds trust with attendees and establishes authority."
    },
    {
        "question": "What is the first step in emergency response?",
        "options": ["Call the police", "Assess the situation", "Evacuate everyone", "Take photos"],
        "correctAnswer": 1,
        "explanation": "Always assess the situation first to determine the appropriate response."
    },
    {
        "question": "Which communication method is most effective for security teams?",
        "options": ["Shouting", "Two-way radio", "Text messages", "Hand signals only"],
        "correctAnswer": 1,
        "explanation": "Two-way radios provide instant, clear communication across the team."
    },
    {
        "question": "What does situational awareness mean?",
        "options": ["Knowing the weather", "Being aware of your surroundings", "Knowing all attendees", "Having a map"],
        "correctAnswer": 1,
        "explanation": "Situational awareness means being constantly aware of your environment and potential threats."
    },
    {
        "question": "When should you use force?",
        "options": ["Whenever you want", "Only as a last resort", "To intimidate people", "Never"],
        "correctAnswer": 1,
        "explanation": "Force should only be used as a last resort when necessary to protect life or property."
    },
    {
        "question": "What is the purpose of a security briefing?",
        "options": ["To waste time", "To coordinate team efforts", "To socialize", "To assign blame"],
        "correctAnswer": 1,
        "explanation": "Security briefings coordinate team efforts and ensure everyone understands their roles."
    },
    {
        "question": "How should you handle a medical emergency?",
        "options": ["Ignore it", "Call for medical assistance immediately", "Try to treat it yourself", "Wait and see"],
        "correctAnswer": 1,
        "explanation": "Always call for professional medical assistance immediately in a medical emergency."
    }
]'::jsonb,
total_questions = 10
WHERE assessment_name LIKE '%Introduction%';

-- Module 2: Security Radio Communications
UPDATE assessments
SET questions_json = '[
    {
        "question": "What is the NATO phonetic alphabet used for?",
        "options": ["Entertainment", "Clear radio communication", "Secret codes", "Military only"],
        "correctAnswer": 1,
        "explanation": "The NATO phonetic alphabet ensures clear communication over radio."
    },
    {
        "question": "What does ''10-4'' mean in radio communication?",
        "options": ["Emergency", "Acknowledged/Understood", "Repeat", "Out of service"],
        "correctAnswer": 1,
        "explanation": "10-4 means message received and understood."
    },
    {
        "question": "When should you use radio codes?",
        "options": ["Always", "When appropriate for clarity", "Never", "Only in emergencies"],
        "correctAnswer": 1,
        "explanation": "Radio codes should be used when they improve clarity and efficiency."
    },
    {
        "question": "What is proper radio etiquette?",
        "options": ["Talk as much as possible", "Keep messages brief and clear", "Use slang", "Interrupt others"],
        "correctAnswer": 1,
        "explanation": "Radio messages should be brief, clear, and professional."
    },
    {
        "question": "How do you spell ''David'' using the phonetic alphabet?",
        "options": ["Delta-Alpha-Victor-India-Delta", "Dog-Apple-Van-Ice-Dog", "David-Alpha-Victor-India-Delta", "Delta-Adam-Victor-India-Delta"],
        "correctAnswer": 0,
        "explanation": "D=Delta, A=Alpha, V=Victor, I=India, D=Delta"
    },
    {
        "question": "What should you do before transmitting?",
        "options": ["Just start talking", "Listen first to ensure channel is clear", "Yell", "Wait 5 minutes"],
        "correctAnswer": 1,
        "explanation": "Always listen first to avoid interrupting ongoing communications."
    },
    {
        "question": "What does ''10-20'' mean?",
        "options": ["Emergency", "Location", "Time", "Name"],
        "correctAnswer": 1,
        "explanation": "10-20 is a request for or statement of location."
    },
    {
        "question": "How should you end a radio transmission?",
        "options": ["Just stop talking", "Say your call sign", "Hang up", "Say goodbye"],
        "correctAnswer": 1,
        "explanation": "Always end with your call sign for identification."
    },
    {
        "question": "What is a ''Code 3'' typically used for?",
        "options": ["Lunch break", "Emergency response", "End of shift", "Bathroom break"],
        "correctAnswer": 1,
        "explanation": "Code 3 typically indicates an emergency requiring immediate response."
    },
    {
        "question": "Why is radio discipline important?",
        "options": ["To sound professional", "To keep channels clear for important communications", "To impress supervisors", "It is not important"],
        "correctAnswer": 1,
        "explanation": "Radio discipline ensures channels remain clear for critical communications."
    }
]'::jsonb,
total_questions = 10
WHERE assessment_name LIKE '%Radio%';

-- Module 3: Conflict Resolution & De-escalation
UPDATE assessments
SET questions_json = '[
    {
        "question": "What is the first step in de-escalation?",
        "options": ["Use force", "Remain calm", "Call police", "Yell louder"],
        "correctAnswer": 1,
        "explanation": "Remaining calm is the foundation of effective de-escalation."
    },
    {
        "question": "Active listening means:",
        "options": ["Interrupting", "Fully concentrating on what is being said", "Thinking about your response", "Looking at your phone"],
        "correctAnswer": 1,
        "explanation": "Active listening involves fully concentrating and understanding the speaker."
    },
    {
        "question": "What is verbal judo?",
        "options": ["Physical fighting", "Using words to de-escalate situations", "Martial arts", "Yelling"],
        "correctAnswer": 1,
        "explanation": "Verbal judo is the art of using words to prevent or de-escalate conflicts."
    },
    {
        "question": "When dealing with an angry person, you should:",
        "options": ["Match their energy", "Stay calm and speak softly", "Ignore them", "Get angry too"],
        "correctAnswer": 1,
        "explanation": "Staying calm and speaking softly helps de-escalate the situation."
    },
    {
        "question": "What is empathy in conflict resolution?",
        "options": ["Agreeing with everyone", "Understanding another person''s feelings", "Being weak", "Giving in"],
        "correctAnswer": 1,
        "explanation": "Empathy is understanding and acknowledging another person''s feelings."
    },
    {
        "question": "Body language accounts for what percentage of communication?",
        "options": ["10%", "50%", "Over 50%", "90%"],
        "correctAnswer": 2,
        "explanation": "Body language accounts for over 50% of communication."
    },
    {
        "question": "What should you avoid during de-escalation?",
        "options": ["Eye contact", "Threatening gestures", "Calm voice", "Active listening"],
        "correctAnswer": 1,
        "explanation": "Threatening gestures escalate rather than de-escalate situations."
    },
    {
        "question": "When should you call for backup?",
        "options": ["Never", "When the situation exceeds your ability to control", "Always", "Only if injured"],
        "correctAnswer": 1,
        "explanation": "Call for backup when a situation exceeds your ability to safely control it."
    },
    {
        "question": "What is the goal of conflict resolution?",
        "options": ["To win", "To find a peaceful solution", "To prove you are right", "To punish"],
        "correctAnswer": 1,
        "explanation": "The goal is to find a peaceful solution that resolves the conflict."
    },
    {
        "question": "Personal space is important because:",
        "options": ["It looks professional", "It prevents escalation and shows respect", "It is required by law", "It does not matter"],
        "correctAnswer": 1,
        "explanation": "Respecting personal space prevents escalation and shows respect."
    }
]'::jsonb,
total_questions = 10
WHERE assessment_name LIKE '%Conflict%' OR assessment_name LIKE '%De-escalation%';

-- Add similar updates for remaining modules...
-- For now, let's add a generic template for any remaining assessments

UPDATE assessments
SET questions_json = '[
    {
        "question": "Edit this question to match your module content",
        "options": ["Option A", "Option B (Correct)", "Option C", "Option D"],
        "correctAnswer": 1,
        "explanation": "Edit this explanation to explain why this is the correct answer."
    },
    {
        "question": "Question 2 - Edit this",
        "options": ["Option A", "Option B", "Option C (Correct)", "Option D"],
        "correctAnswer": 2,
        "explanation": "Add your explanation here."
    },
    {
        "question": "Question 3 - Edit this",
        "options": ["Option A (Correct)", "Option B", "Option C", "Option D"],
        "correctAnswer": 0,
        "explanation": "Add your explanation here."
    },
    {
        "question": "Question 4 - Edit this",
        "options": ["Option A", "Option B", "Option C", "Option D (Correct)"],
        "correctAnswer": 3,
        "explanation": "Add your explanation here."
    },
    {
        "question": "Question 5 - Edit this",
        "options": ["Option A", "Option B (Correct)", "Option C", "Option D"],
        "correctAnswer": 1,
        "explanation": "Add your explanation here."
    },
    {
        "question": "Question 6 - Edit this",
        "options": ["Option A", "Option B", "Option C (Correct)", "Option D"],
        "correctAnswer": 2,
        "explanation": "Add your explanation here."
    },
    {
        "question": "Question 7 - Edit this",
        "options": ["Option A (Correct)", "Option B", "Option C", "Option D"],
        "correctAnswer": 0,
        "explanation": "Add your explanation here."
    },
    {
        "question": "Question 8 - Edit this",
        "options": ["Option A", "Option B", "Option C", "Option D (Correct)"],
        "correctAnswer": 3,
        "explanation": "Add your explanation here."
    },
    {
        "question": "Question 9 - Edit this",
        "options": ["Option A", "Option B (Correct)", "Option C", "Option D"],
        "correctAnswer": 1,
        "explanation": "Add your explanation here."
    },
    {
        "question": "Question 10 - Edit this",
        "options": ["Option A", "Option B", "Option C (Correct)", "Option D"],
        "correctAnswer": 2,
        "explanation": "Add your explanation here."
    }
]'::jsonb,
total_questions = 10
WHERE questions_json IS NULL OR questions_json::text = '[]' OR questions_json::text = 'null';

-- Verify the update
SELECT 
    tm.module_name,
    a.assessment_name,
    a.total_questions,
    jsonb_array_length(a.questions_json) as actual_questions
FROM assessments a
JOIN training_modules tm ON a.module_id = tm.id
ORDER BY tm.display_order;
