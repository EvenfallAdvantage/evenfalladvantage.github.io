-- =====================================================
-- INSERT SYSTEMA SCOUT ASSESSMENT QUESTIONS
-- =====================================================
-- Inserts 20 questions for each of the 6 Systema Scout modules
-- Matches the assessment_questions table schema:
-- (assessment_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer)
-- =====================================================

-- =====================================================
-- MODULE 0: ORIENTATION & PHILOSOPHY (20 questions)
-- =====================================================

DO $$
DECLARE
    v_assessment_id UUID;
BEGIN
    SELECT a.id INTO v_assessment_id
    FROM assessments a
    JOIN training_modules tm ON a.module_id = tm.id
    WHERE tm.module_code = 'systema-scout-orientation';
    
    IF v_assessment_id IS NULL THEN
        RAISE EXCEPTION 'Assessment for systema-scout-orientation not found.';
    END IF;
    
    INSERT INTO assessment_questions (assessment_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer) VALUES
    (v_assessment_id, 1, 'What is the foundational cycle in Systema Scout?', 'Breathe → Relax → Structure → Move', 'Move → Structure → Relax → Breathe', 'Structure → Move → Breathe → Relax', 'Relax → Breathe → Move → Structure', 'A'),
    (v_assessment_id, 2, 'What is the primary goal of Systema Scout training?', 'To learn combat techniques', 'To build internal regulation and perceptual awareness', 'To increase physical strength', 'To memorize security protocols', 'B'),
    (v_assessment_id, 3, 'Systema Scout focuses on which aspect before proximity, contact, or force?', 'Physical conditioning', 'Weapon proficiency', 'Internal regulation and self-accountability', 'Team coordination', 'C'),
    (v_assessment_id, 4, 'What type of outcomes does Systema Scout emphasize?', 'Quantitative metrics only', 'Qualitative and experiential', 'Competitive rankings', 'Time-based achievements', 'B'),
    (v_assessment_id, 5, 'Who is the target audience for Systema Scout?', 'Only military personnel', 'Only law enforcement', 'Anyone whose presence affects the safety of others', 'Professional athletes only', 'C'),
    (v_assessment_id, 6, 'What noticeable change can participants expect from consistent Systema Scout practice?', 'Increased muscle mass', 'A shift in how stress affects them', 'Faster reaction times', 'Better memorization skills', 'B'),
    (v_assessment_id, 7, 'Systema Scout training is rooted in which principles?', 'Karate principles', 'Systema principles', 'Boxing principles', 'Judo principles', 'B'),
    (v_assessment_id, 8, 'What is the focus of the "Breathe" component in the foundational cycle?', 'Holding your breath as long as possible', 'Conscious breath control and awareness', 'Breathing only through the nose', 'Rapid shallow breathing', 'B'),
    (v_assessment_id, 9, 'What does "Relax" mean in the Systema Scout context?', 'Complete physical inactivity', 'Eliminating unnecessary tension while maintaining structure', 'Sleeping or resting', 'Avoiding all challenging situations', 'B'),
    (v_assessment_id, 10, 'The "Structure" component refers to:', 'Building physical structures', 'Maintaining proper body alignment and integrity', 'Creating organizational charts', 'Following strict rules', 'B'),
    (v_assessment_id, 11, 'What is the purpose of the "Move" component?', 'To exercise vigorously', 'To apply movement with awareness and efficiency', 'To run as fast as possible', 'To perform complex acrobatics', 'B'),
    (v_assessment_id, 12, 'Systema Scout emphasizes self-accountability through:', 'Blaming others for mistakes', 'External validation only', 'Empathetic self-debrief and reflection', 'Avoiding difficult situations', 'C'),
    (v_assessment_id, 13, 'What role does empathy play in Systema Scout?', 'It is not important', 'It is central to self-awareness and growth', 'It only applies to others, not yourself', 'It is a sign of weakness', 'B'),
    (v_assessment_id, 14, 'The training framework is described as:', 'Theoretical and academic', 'Foundational and experiential', 'Competitive and aggressive', 'Passive and observational only', 'B'),
    (v_assessment_id, 15, 'What is the expected outcome for professional work?', 'Increased aggression', 'Better paperwork skills', 'Improved stress management and decision-making', 'Faster physical responses only', 'C'),
    (v_assessment_id, 16, 'Systema Scout aims to make practitioners:', 'More intimidating', 'Someone whose presence makes situations safer', 'More physically imposing', 'Less involved in tense situations', 'B'),
    (v_assessment_id, 17, 'The course duration is approximately:', '1 hour', '5 hours', '20 hours', '50 hours', 'B'),
    (v_assessment_id, 18, 'What is the difficulty level of Systema Scout?', 'Advanced only', 'Beginner-friendly', 'Expert level', 'Requires prior martial arts experience', 'B'),
    (v_assessment_id, 19, 'The course price for Systema Scout is:', '$49.99', '$99.99', '$149.99', '$199.99', 'C'),
    (v_assessment_id, 20, 'What is the ultimate goal of developing perceptual awareness in Systema Scout?', 'To win competitions', 'To observe and respond appropriately to environmental cues', 'To judge others', 'To avoid all conflict', 'B');
    
    RAISE NOTICE 'Module 0: 20 questions inserted';
END $$;

-- =====================================================
-- MODULE 1: WALKING, BREATHING, AND CHOICE (20 questions)
-- =====================================================

DO $$
DECLARE
    v_assessment_id UUID;
BEGIN
    SELECT a.id INTO v_assessment_id
    FROM assessments a
    JOIN training_modules tm ON a.module_id = tm.id
    WHERE tm.module_code = 'systema-scout-walking';
    
    IF v_assessment_id IS NULL THEN
        RAISE EXCEPTION 'Assessment for systema-scout-walking not found.';
    END IF;
    
    INSERT INTO assessment_questions (assessment_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer) VALUES
    (v_assessment_id, 1, 'What is the primary focus of Module 1?', 'Running techniques', 'Walking mechanics with varied breathing patterns', 'Standing still', 'Jumping exercises', 'B'),
    (v_assessment_id, 2, 'Why is walking used as a training tool in Systema Scout?', 'It is the easiest exercise', 'It integrates breath, structure, and movement awareness', 'It burns the most calories', 'It requires no equipment', 'B'),
    (v_assessment_id, 3, 'What does conscious breath control develop?', 'Lung capacity only', 'Awareness of internal state and stress regulation', 'Faster breathing', 'Ability to hold breath longer', 'B'),
    (v_assessment_id, 4, 'Varied breathing patterns during walking help with:', 'Weight loss', 'Adapting to different stress levels and situations', 'Increasing speed', 'Reducing need for oxygen', 'B'),
    (v_assessment_id, 5, 'Movement awareness in this module refers to:', 'Watching others move', 'Being conscious of your own movement quality and efficiency', 'Memorizing dance steps', 'Moving as fast as possible', 'B'),
    (v_assessment_id, 6, 'What is the relationship between breathing and walking in this practice?', 'They are unrelated', 'Breathing should be synchronized with steps for awareness', 'Walking should stop when breathing', 'Breathing should be held while walking', 'B'),
    (v_assessment_id, 7, 'The "choice" component in this module emphasizes:', 'Random decisions', 'Conscious decision-making about breath and movement', 'Choosing the fastest path', 'Avoiding choices', 'B'),
    (v_assessment_id, 8, 'What should you notice while practicing walking with breath awareness?', 'Only external environment', 'Your internal state, tension, and efficiency', 'Other people walking', 'The time of day', 'B'),
    (v_assessment_id, 9, 'How does varied breathing affect walking?', 'It has no effect', 'It changes your internal state and movement quality', 'It only affects speed', 'It makes walking harder', 'B'),
    (v_assessment_id, 10, 'What is the purpose of developing movement awareness?', 'To look graceful', 'To identify and eliminate inefficient patterns', 'To impress others', 'To move faster', 'B'),
    (v_assessment_id, 11, 'Conscious breath control during movement helps with:', 'Showing off skills', 'Maintaining calm and regulation under stress', 'Breathing louder', 'Holding breath longer', 'B'),
    (v_assessment_id, 12, 'The estimated time for Module 1 is:', '15-30 minutes', '30-45 minutes', '45-60 minutes', '60-90 minutes', 'C'),
    (v_assessment_id, 13, 'What difficulty level is Module 1?', 'Advanced', 'Beginner', 'Expert', 'Intermediate', 'B'),
    (v_assessment_id, 14, 'Walking practice should be done:', 'As fast as possible', 'With awareness and attention to breath and structure', 'Only outdoors', 'In a competitive manner', 'B'),
    (v_assessment_id, 15, 'What is the benefit of practicing walking with different breathing patterns?', 'It makes walking harder', 'It builds adaptability and stress tolerance', 'It has no benefit', 'It only improves lung capacity', 'B'),
    (v_assessment_id, 16, 'The module icon for Walking, Breathing, and Choice is:', 'fa-running', 'fa-walking', 'fa-shoe-prints', 'fa-person', 'B'),
    (v_assessment_id, 17, 'What should you focus on during walking practice?', 'Speed and distance', 'Quality of movement and breath awareness', 'Competing with others', 'Reaching a destination', 'B'),
    (v_assessment_id, 18, 'How does this module relate to security work?', 'It does not relate', 'It builds the foundation for maintaining calm presence in tense situations', 'It only improves fitness', 'It teaches combat techniques', 'B'),
    (v_assessment_id, 19, 'What is the key takeaway from Module 1?', 'Walking is good exercise', 'Conscious breath and movement control are foundational to regulation', 'Breathing is automatic and needs no attention', 'Walking should be avoided', 'B'),
    (v_assessment_id, 20, 'The practice of walking with breath awareness develops:', 'Only physical endurance', 'Mind-body connection and self-regulation', 'Competitive advantage', 'Faster reflexes only', 'B');
    
    RAISE NOTICE 'Module 1: 20 questions inserted';
END $$;

-- =====================================================
-- MODULE 2: SECURITY ASSESSMENT (OBSERVATION & RECALL) (20 questions)
-- =====================================================

DO $$
DECLARE
    v_assessment_id UUID;
BEGIN
    SELECT a.id INTO v_assessment_id
    FROM assessments a
    JOIN training_modules tm ON a.module_id = tm.id
    WHERE tm.module_code = 'systema-scout-observation';
    
    IF v_assessment_id IS NULL THEN
        RAISE EXCEPTION 'Assessment for systema-scout-observation not found.';
    END IF;
    
    INSERT INTO assessment_questions (assessment_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer) VALUES
    (v_assessment_id, 1, 'What is the primary focus of Module 2?', 'Physical combat', 'Perceptual awareness through observation and recall', 'Weapon handling', 'Report writing', 'B'),
    (v_assessment_id, 2, 'Why is observation important in security work?', 'To judge people', 'To identify potential threats and environmental factors early', 'To gossip about others', 'To avoid work', 'B'),
    (v_assessment_id, 3, 'What does "recall" refer to in this module?', 'Remembering passwords', 'The ability to remember and report observed details accurately', 'Calling someone back', 'Recalling products', 'B'),
    (v_assessment_id, 4, 'Perceptual awareness is built through:', 'Ignoring surroundings', 'Systematic observation exercises and practice', 'Watching TV', 'Avoiding eye contact', 'B'),
    (v_assessment_id, 5, 'Environmental assessment in security scenarios involves:', 'Only looking at people', 'Observing exits, hazards, crowd dynamics, and potential threats', 'Staring at one spot', 'Closing your eyes', 'B'),
    (v_assessment_id, 6, 'What is the difficulty level of Module 2?', 'Beginner', 'Intermediate', 'Advanced', 'Expert', 'B'),
    (v_assessment_id, 7, 'The estimated time for Module 2 is:', '15-20 minutes', '30-45 minutes', '60-90 minutes', '2 hours', 'B'),
    (v_assessment_id, 8, 'What should you observe in a security environment?', 'Only suspicious people', 'People, exits, hazards, lighting, crowd flow, and anomalies', 'Just the entrance', 'Nothing specific', 'B'),
    (v_assessment_id, 9, 'How does observation relate to the Breathe → Relax → Structure → Move cycle?', 'It does not relate', 'Observation requires a calm, regulated state to be effective', 'Observation replaces the cycle', 'They are opposite practices', 'B'),
    (v_assessment_id, 10, 'What is the benefit of practicing recall?', 'To show off memory', 'To provide accurate reports and maintain situational awareness', 'To memorize trivia', 'To avoid writing reports', 'B'),
    (v_assessment_id, 11, 'The module icon for Observation & Recall is:', 'fa-brain', 'fa-eye', 'fa-camera', 'fa-binoculars', 'B'),
    (v_assessment_id, 12, 'Effective observation requires:', 'Staring intensely', 'A relaxed, aware state without fixation', 'Constant movement', 'Closing one eye', 'B'),
    (v_assessment_id, 13, 'What is an "anomaly" in security observation?', 'Normal behavior', 'Something that stands out or does not fit the pattern', 'A type of equipment', 'A security badge', 'B'),
    (v_assessment_id, 14, 'Why is environmental assessment important before an incident occurs?', 'It is not important', 'It allows for proactive planning and faster response', 'It wastes time', 'It makes you paranoid', 'B'),
    (v_assessment_id, 15, 'Observation exercises help develop:', 'Paranoia', 'Perceptual accuracy and situational awareness', 'Suspicion of everyone', 'Avoidance behavior', 'B'),
    (v_assessment_id, 16, 'What should you do after observing an environment?', 'Forget about it', 'Practice recalling key details to strengthen memory', 'Tell everyone immediately', 'Leave the area', 'B'),
    (v_assessment_id, 17, 'How does this module apply to professional security work?', 'It does not apply', 'It builds the foundation for threat assessment and incident prevention', 'It only applies to detectives', 'It replaces physical training', 'B'),
    (v_assessment_id, 18, 'What is the relationship between observation and stress?', 'Observation increases stress', 'Effective observation requires managing your own stress first', 'They are unrelated', 'Stress improves observation', 'B'),
    (v_assessment_id, 19, 'The goal of observation training is to:', 'See everything at once', 'Develop systematic, reliable perceptual skills', 'Judge people quickly', 'Avoid looking at anything', 'B'),
    (v_assessment_id, 20, 'What makes observation "security-focused"?', 'Looking only at security guards', 'Identifying factors relevant to safety and threat assessment', 'Observing only criminals', 'Watching security cameras', 'B');
    
    RAISE NOTICE 'Module 2: 20 questions inserted';
    RAISE NOTICE 'First 3 modules complete. Run part 2 for modules 3-5.';
END $$;
