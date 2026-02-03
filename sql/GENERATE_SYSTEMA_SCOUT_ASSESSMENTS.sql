-- =====================================================
-- GENERATE SYSTEMA SCOUT ASSESSMENT QUESTIONS
-- =====================================================
-- Creates 20 assessment questions for each of the 6 Systema Scout modules
-- Questions test comprehension of key concepts from each module
-- =====================================================

-- =====================================================
-- MODULE 0: ORIENTATION & PHILOSOPHY
-- =====================================================

DO $$
DECLARE
    v_assessment_id UUID;
BEGIN
    -- Get assessment ID for Module 0
    SELECT a.id INTO v_assessment_id
    FROM assessments a
    JOIN training_modules tm ON a.module_id = tm.id
    WHERE tm.module_code = 'systema-scout-orientation';
    
    IF v_assessment_id IS NULL THEN
        RAISE EXCEPTION 'Assessment for systema-scout-orientation not found. Please create assessments first.';
    END IF;
    
    -- Insert questions for Module 0
    INSERT INTO assessment_questions (assessment_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer) VALUES
    (v_assessment_id, 1, 'What is the foundational cycle in Systema Scout?',
     'Breathe → Relax → Structure → Move',
     'Move → Structure → Relax → Breathe',
     'Structure → Move → Breathe → Relax',
     'Relax → Breathe → Move → Structure',
     'A'),
    
    (v_assessment_id, 'What is the primary goal of Systema Scout training?', 'multiple_choice',
     '["To learn combat techniques", "To build internal regulation and perceptual awareness", "To increase physical strength", "To memorize security protocols"]'::jsonb,
     1, 1, 2),
    
    (v_assessment_id, 'Systema Scout focuses on which aspect before proximity, contact, or force?', 'multiple_choice',
     '["Physical conditioning", "Weapon proficiency", "Internal regulation and self-accountability", "Team coordination"]'::jsonb,
     2, 1, 3),
    
    (v_assessment_id, 'What type of outcomes does Systema Scout emphasize?', 'multiple_choice',
     '["Quantitative metrics only", "Qualitative and experiential", "Competitive rankings", "Time-based achievements"]'::jsonb,
     1, 1, 4),
    
    (v_assessment_id, 'Who is the target audience for Systema Scout?', 'multiple_choice',
     '["Only military personnel", "Only law enforcement", "Anyone whose presence affects the safety of others", "Professional athletes only"]'::jsonb,
     2, 1, 5),
    
    (v_assessment_id, 'What noticeable change can participants expect from consistent Systema Scout practice?', 'multiple_choice',
     '["Increased muscle mass", "A shift in how stress affects them", "Faster reaction times", "Better memorization skills"]'::jsonb,
     1, 1, 6),
    
    (v_assessment_id, 'Systema Scout training is rooted in which principles?', 'multiple_choice',
     '["Karate principles", "Systema principles", "Boxing principles", "Judo principles"]'::jsonb,
     1, 1, 7),
    
    (v_assessment_id, 'What is the focus of the "Breathe" component in the foundational cycle?', 'multiple_choice',
     '["Holding your breath as long as possible", "Conscious breath control and awareness", "Breathing only through the nose", "Rapid shallow breathing"]'::jsonb,
     1, 1, 8),
    
    (v_assessment_id, 'What does "Relax" mean in the Systema Scout context?', 'multiple_choice',
     '["Complete physical inactivity", "Eliminating unnecessary tension while maintaining structure", "Sleeping or resting", "Avoiding all challenging situations"]'::jsonb,
     1, 1, 9),
    
    (v_assessment_id, 'The "Structure" component refers to:', 'multiple_choice',
     '["Building physical structures", "Maintaining proper body alignment and integrity", "Creating organizational charts", "Following strict rules"]'::jsonb,
     1, 1, 10),
    
    (v_assessment_id, 'What is the purpose of the "Move" component?', 'multiple_choice',
     '["To exercise vigorously", "To apply movement with awareness and efficiency", "To run as fast as possible", "To perform complex acrobatics"]'::jsonb,
     1, 1, 11),
    
    (v_assessment_id, 'Systema Scout emphasizes self-accountability through:', 'multiple_choice',
     '["Blaming others for mistakes", "External validation only", "Empathetic self-debrief and reflection", "Avoiding difficult situations"]'::jsonb,
     2, 1, 12),
    
    (v_assessment_id, 'What role does empathy play in Systema Scout?', 'multiple_choice',
     '["It is not important", "It is central to self-awareness and growth", "It only applies to others, not yourself", "It is a sign of weakness"]'::jsonb,
     1, 1, 13),
    
    (v_assessment_id, 'The training framework is described as:', 'multiple_choice',
     '["Theoretical and academic", "Foundational and experiential", "Competitive and aggressive", "Passive and observational only"]'::jsonb,
     1, 1, 14),
    
    (v_assessment_id, 'What is the expected outcome for professional work?', 'multiple_choice',
     '["Increased aggression", "Better paperwork skills", "Improved stress management and decision-making", "Faster physical responses only"]'::jsonb,
     2, 1, 15),
    
    (v_assessment_id, 'Systema Scout aims to make practitioners:', 'multiple_choice',
     '["More intimidating", "Someone whose presence makes situations safer", "More physically imposing", "Less involved in tense situations"]'::jsonb,
     1, 1, 16),
    
    (v_assessment_id, 'The course duration is approximately:', 'multiple_choice',
     '["1 hour", "5 hours", "20 hours", "50 hours"]'::jsonb,
     1, 1, 17),
    
    (v_assessment_id, 'What is the difficulty level of Systema Scout?', 'multiple_choice',
     '["Advanced only", "Beginner-friendly", "Expert level", "Requires prior martial arts experience"]'::jsonb,
     1, 1, 18),
    
    (v_assessment_id, 'The course price for Systema Scout is:', 'multiple_choice',
     '["$49.99", "$99.99", "$149.99", "$199.99"]'::jsonb,
     2, 1, 19),
    
    (v_assessment_id, 'What is the ultimate goal of developing perceptual awareness in Systema Scout?', 'multiple_choice',
     '["To win competitions", "To observe and respond appropriately to environmental cues", "To judge others", "To avoid all conflict"]'::jsonb,
     1, 1, 20);
    
    RAISE NOTICE 'Module 0 assessment questions created successfully';
END $$;

-- =====================================================
-- MODULE 1: WALKING, BREATHING, AND CHOICE
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
    
    INSERT INTO assessment_questions (assessment_id, question_text, question_type, options, correct_answer, points, display_order) VALUES
    (v_assessment_id, 'What is the primary focus of Module 1?', 'multiple_choice',
     '["Running techniques", "Walking mechanics with varied breathing patterns", "Standing still", "Jumping exercises"]'::jsonb,
     1, 1, 1),
    
    (v_assessment_id, 'Why is walking used as a training tool in Systema Scout?', 'multiple_choice',
     '["It is the easiest exercise", "It integrates breath, structure, and movement awareness", "It burns the most calories", "It requires no equipment"]'::jsonb,
     1, 1, 2),
    
    (v_assessment_id, 'What does conscious breath control develop?', 'multiple_choice',
     '["Lung capacity only", "Awareness of internal state and stress regulation", "Faster breathing", "Ability to hold breath longer"]'::jsonb,
     1, 1, 3),
    
    (v_assessment_id, 'Varied breathing patterns during walking help with:', 'multiple_choice',
     '["Weight loss", "Adapting to different stress levels and situations", "Increasing speed", "Reducing need for oxygen"]'::jsonb,
     1, 1, 4),
    
    (v_assessment_id, 'Movement awareness in this module refers to:', 'multiple_choice',
     '["Watching others move", "Being conscious of your own movement quality and efficiency", "Memorizing dance steps", "Moving as fast as possible"]'::jsonb,
     1, 1, 5),
    
    (v_assessment_id, 'What is the relationship between breathing and walking in this practice?', 'multiple_choice',
     '["They are unrelated", "Breathing should be synchronized with steps for awareness", "Walking should stop when breathing", "Breathing should be held while walking"]'::jsonb,
     1, 1, 6),
    
    (v_assessment_id, 'The "choice" component in this module emphasizes:', 'multiple_choice',
     '["Random decisions", "Conscious decision-making about breath and movement", "Choosing the fastest path", "Avoiding choices"]'::jsonb,
     1, 1, 7),
    
    (v_assessment_id, 'What should you notice while practicing walking with breath awareness?', 'multiple_choice',
     '["Only external environment", "Your internal state, tension, and efficiency", "Other people walking", "The time of day"]'::jsonb,
     1, 1, 8),
    
    (v_assessment_id, 'How does varied breathing affect walking?', 'multiple_choice',
     '["It has no effect", "It changes your internal state and movement quality", "It only affects speed", "It makes walking harder"]'::jsonb,
     1, 1, 9),
    
    (v_assessment_id, 'What is the purpose of developing movement awareness?', 'multiple_choice',
     '["To look graceful", "To identify and eliminate inefficient patterns", "To impress others", "To move faster"]'::jsonb,
     1, 1, 10),
    
    (v_assessment_id, 'Conscious breath control during movement helps with:', 'multiple_choice',
     '["Showing off skills", "Maintaining calm and regulation under stress", "Breathing louder", "Holding breath longer"]'::jsonb,
     1, 1, 11),
    
    (v_assessment_id, 'The estimated time for Module 1 is:', 'multiple_choice',
     '["15-30 minutes", "30-45 minutes", "45-60 minutes", "60-90 minutes"]'::jsonb,
     2, 1, 12),
    
    (v_assessment_id, 'What difficulty level is Module 1?', 'multiple_choice',
     '["Advanced", "Beginner", "Expert", "Intermediate"]'::jsonb,
     1, 1, 13),
    
    (v_assessment_id, 'Walking practice should be done:', 'multiple_choice',
     '["As fast as possible", "With awareness and attention to breath and structure", "Only outdoors", "In a competitive manner"]'::jsonb,
     1, 1, 14),
    
    (v_assessment_id, 'What is the benefit of practicing walking with different breathing patterns?', 'multiple_choice',
     '["It makes walking harder", "It builds adaptability and stress tolerance", "It has no benefit", "It only improves lung capacity"]'::jsonb,
     1, 1, 15),
    
    (v_assessment_id, 'The module icon for Walking, Breathing, and Choice is:', 'multiple_choice',
     '["fa-running", "fa-walking", "fa-shoe-prints", "fa-person"]'::jsonb,
     1, 1, 16),
    
    (v_assessment_id, 'What should you focus on during walking practice?', 'multiple_choice',
     '["Speed and distance", "Quality of movement and breath awareness", "Competing with others", "Reaching a destination"]'::jsonb,
     1, 1, 17),
    
    (v_assessment_id, 'How does this module relate to security work?', 'multiple_choice',
     '["It does not relate", "It builds the foundation for maintaining calm presence in tense situations", "It only improves fitness", "It teaches combat techniques"]'::jsonb,
     1, 1, 18),
    
    (v_assessment_id, 'What is the key takeaway from Module 1?', 'multiple_choice',
     '["Walking is good exercise", "Conscious breath and movement control are foundational to regulation", "Breathing is automatic and needs no attention", "Walking should be avoided"]'::jsonb,
     1, 1, 19),
    
    (v_assessment_id, 'The practice of walking with breath awareness develops:', 'multiple_choice',
     '["Only physical endurance", "Mind-body connection and self-regulation", "Competitive advantage", "Faster reflexes only"]'::jsonb,
     1, 1, 20);
    
    RAISE NOTICE 'Module 1 assessment questions created successfully';
END $$;

-- =====================================================
-- MODULE 2: SECURITY ASSESSMENT (OBSERVATION & RECALL)
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
    
    INSERT INTO assessment_questions (assessment_id, question_text, question_type, options, correct_answer, points, display_order) VALUES
    (v_assessment_id, 'What is the primary focus of Module 2?', 'multiple_choice',
     '["Physical combat", "Perceptual awareness through observation and recall", "Weapon handling", "Report writing"]'::jsonb,
     1, 1, 1),
    
    (v_assessment_id, 'Why is observation important in security work?', 'multiple_choice',
     '["To judge people", "To identify potential threats and environmental factors early", "To gossip about others", "To avoid work"]'::jsonb,
     1, 1, 2),
    
    (v_assessment_id, 'What does "recall" refer to in this module?', 'multiple_choice',
     '["Remembering passwords", "The ability to remember and report observed details accurately", "Calling someone back", "Recalling products"]'::jsonb,
     1, 1, 3),
    
    (v_assessment_id, 'Perceptual awareness is built through:', 'multiple_choice',
     '["Ignoring surroundings", "Systematic observation exercises and practice", "Watching TV", "Avoiding eye contact"]'::jsonb,
     1, 1, 4),
    
    (v_assessment_id, 'Environmental assessment in security scenarios involves:', 'multiple_choice',
     '["Only looking at people", "Observing exits, hazards, crowd dynamics, and potential threats", "Staring at one spot", "Closing your eyes"]'::jsonb,
     1, 1, 5),
    
    (v_assessment_id, 'What is the difficulty level of Module 2?', 'multiple_choice',
     '["Beginner", "Intermediate", "Advanced", "Expert"]'::jsonb,
     1, 1, 6),
    
    (v_assessment_id, 'The estimated time for Module 2 is:', 'multiple_choice',
     '["15-20 minutes", "30-45 minutes", "60-90 minutes", "2 hours"]'::jsonb,
     1, 1, 7),
    
    (v_assessment_id, 'What should you observe in a security environment?', 'multiple_choice',
     '["Only suspicious people", "People, exits, hazards, lighting, crowd flow, and anomalies", "Just the entrance", "Nothing specific"]'::jsonb,
     1, 1, 8),
    
    (v_assessment_id, 'How does observation relate to the Breathe → Relax → Structure → Move cycle?', 'multiple_choice',
     '["It does not relate", "Observation requires a calm, regulated state to be effective", "Observation replaces the cycle", "They are opposite practices"]'::jsonb,
     1, 1, 9),
    
    (v_assessment_id, 'What is the benefit of practicing recall?', 'multiple_choice',
     '["To show off memory", "To provide accurate reports and maintain situational awareness", "To memorize trivia", "To avoid writing reports"]'::jsonb,
     1, 1, 10),
    
    (v_assessment_id, 'The module icon for Observation & Recall is:', 'multiple_choice',
     '["fa-brain", "fa-eye", "fa-camera", "fa-binoculars"]'::jsonb,
     1, 1, 11),
    
    (v_assessment_id, 'Effective observation requires:', 'multiple_choice',
     '["Staring intensely", "A relaxed, aware state without fixation", "Constant movement", "Closing one eye"]'::jsonb,
     1, 1, 12),
    
    (v_assessment_id, 'What is an "anomaly" in security observation?', 'multiple_choice',
     '["Normal behavior", "Something that stands out or does not fit the pattern", "A type of equipment", "A security badge"]'::jsonb,
     1, 1, 13),
    
    (v_assessment_id, 'Why is environmental assessment important before an incident occurs?', 'multiple_choice',
     '["It is not important", "It allows for proactive planning and faster response", "It wastes time", "It makes you paranoid"]'::jsonb,
     1, 1, 14),
    
    (v_assessment_id, 'Observation exercises help develop:', 'multiple_choice',
     '["Paranoia", "Perceptual accuracy and situational awareness", "Suspicion of everyone", "Avoidance behavior"]'::jsonb,
     1, 1, 15),
    
    (v_assessment_id, 'What should you do after observing an environment?', 'multiple_choice',
     '["Forget about it", "Practice recalling key details to strengthen memory", "Tell everyone immediately", "Leave the area"]'::jsonb,
     1, 1, 16),
    
    (v_assessment_id, 'How does this module apply to professional security work?', 'multiple_choice',
     '["It does not apply", "It builds the foundation for threat assessment and incident prevention", "It only applies to detectives", "It replaces physical training"]'::jsonb,
     1, 1, 17),
    
    (v_assessment_id, 'What is the relationship between observation and stress?', 'multiple_choice',
     '["Observation increases stress", "Effective observation requires managing your own stress first", "They are unrelated", "Stress improves observation"]'::jsonb,
     1, 1, 18),
    
    (v_assessment_id, 'The goal of observation training is to:', 'multiple_choice',
     '["See everything at once", "Develop systematic, reliable perceptual skills", "Judge people quickly", "Avoid looking at anything"]'::jsonb,
     1, 1, 19),
    
    (v_assessment_id, 'What makes observation "security-focused"?', 'multiple_choice',
     '["Looking only at security guards", "Identifying factors relevant to safety and threat assessment", "Observing only criminals", "Watching security cameras"]'::jsonb,
     1, 1, 20);
    
    RAISE NOTICE 'Module 2 assessment questions created successfully';
END $$;

-- =====================================================
-- MODULE 3: GLOVE WORK (UNNECESSARY TENSION)
-- =====================================================

DO $$
DECLARE
    v_assessment_id UUID;
BEGIN
    SELECT a.id INTO v_assessment_id
    FROM assessments a
    JOIN training_modules tm ON a.module_id = tm.id
    WHERE tm.module_code = 'systema-scout-tension';
    
    IF v_assessment_id IS NULL THEN
        RAISE EXCEPTION 'Assessment for systema-scout-tension not found.';
    END IF;
    
    INSERT INTO assessment_questions (assessment_id, question_text, question_type, options, correct_answer, points, display_order) VALUES
    (v_assessment_id, 'What is the primary focus of Module 3?', 'multiple_choice',
     '["Building muscle tension", "Identifying and eliminating unnecessary tension", "Increasing grip strength", "Learning boxing techniques"]'::jsonb,
     1, 1, 1),
    
    (v_assessment_id, 'Why is "glove work" used in this module?', 'multiple_choice',
     '["To learn boxing", "To create constrained movement that reveals tension patterns", "To keep hands warm", "To practice punching"]'::jsonb,
     1, 1, 2),
    
    (v_assessment_id, 'What is "unnecessary tension"?', 'multiple_choice',
     '["All muscle engagement", "Tension that does not contribute to the task and wastes energy", "Feeling stressed", "Being too relaxed"]'::jsonb,
     1, 1, 3),
    
    (v_assessment_id, 'How do you identify unnecessary tension?', 'multiple_choice',
     '["By asking others", "Through self-observation during constrained movement", "By feeling pain", "By measuring heart rate"]'::jsonb,
     1, 1, 4),
    
    (v_assessment_id, 'The goal of eliminating unnecessary tension is to:', 'multiple_choice',
     '["Become completely limp", "Move more efficiently with less wasted energy", "Avoid all physical activity", "Increase relaxation only"]'::jsonb,
     1, 1, 5),
    
    (v_assessment_id, 'What is the difficulty level of Module 3?', 'multiple_choice',
     '["Beginner", "Intermediate", "Advanced", "Expert"]'::jsonb,
     1, 1, 6),
    
    (v_assessment_id, 'The estimated time for Module 3 is:', 'multiple_choice',
     '["20-30 minutes", "30-45 minutes", "45-60 minutes", "90 minutes"]'::jsonb,
     2, 1, 7),
    
    (v_assessment_id, 'Constrained movement refers to:', 'multiple_choice',
     '["Being tied up", "Movement with limitations that highlight tension patterns", "Moving in small spaces", "Restricted breathing"]'::jsonb,
     1, 1, 8),
    
    (v_assessment_id, 'Self-observation in this module means:', 'multiple_choice',
     '["Looking in a mirror", "Paying attention to your internal state and tension patterns", "Watching yourself on video", "Judging your appearance"]'::jsonb,
     1, 1, 9),
    
    (v_assessment_id, 'Why is it important to eliminate unnecessary tension in security work?', 'multiple_choice',
     '["It is not important", "It conserves energy and allows for better response and endurance", "It makes you look relaxed", "It impresses others"]'::jsonb,
     1, 1, 10),
    
    (v_assessment_id, 'The module icon for Glove Work is:', 'multiple_choice',
     '["fa-fist-raised", "fa-hand-paper", "fa-boxing-glove", "fa-hand-rock"]'::jsonb,
     1, 1, 11),
    
    (v_assessment_id, 'What should you notice during glove work exercises?', 'multiple_choice',
     '["How strong you are", "Where you hold unnecessary tension and how it affects movement", "How fast you can move", "What others are doing"]'::jsonb,
     1, 1, 12),
    
    (v_assessment_id, 'Tension patterns are:', 'multiple_choice',
     '["Random", "Habitual ways you hold tension in your body", "Always beneficial", "Impossible to change"]'::jsonb,
     1, 1, 13),
    
    (v_assessment_id, 'How does eliminating unnecessary tension relate to the foundational cycle?', 'multiple_choice',
     '["It does not relate", "It supports the Relax component while maintaining Structure", "It replaces the cycle", "It only relates to Move"]'::jsonb,
     1, 1, 14),
    
    (v_assessment_id, 'What is the difference between relaxation and eliminating unnecessary tension?', 'multiple_choice',
     '["They are the same", "Eliminating tension maintains structure and readiness; relaxation may not", "Relaxation is better", "Tension elimination is passive"]'::jsonb,
     1, 1, 15),
    
    (v_assessment_id, 'Glove work exercises help you:', 'multiple_choice',
     '["Punch harder", "Become aware of habitual tension and learn to release it", "Develop calluses", "Practice self-defense"]'::jsonb,
     1, 1, 16),
    
    (v_assessment_id, 'Why is self-observation emphasized in this module?', 'multiple_choice',
     '["To criticize yourself", "Because only you can feel and identify your own tension patterns", "To compare with others", "To avoid external feedback"]'::jsonb,
     1, 1, 17),
    
    (v_assessment_id, 'What happens when you eliminate unnecessary tension?', 'multiple_choice',
     '["You become weak", "You move more efficiently and conserve energy", "You lose all muscle tone", "You cannot respond to threats"]'::jsonb,
     1, 1, 18),
    
    (v_assessment_id, 'How does unnecessary tension affect decision-making?', 'multiple_choice',
     '["It improves decisions", "It can cloud judgment and slow response", "It has no effect", "It only affects physical performance"]'::jsonb,
     1, 1, 19),
    
    (v_assessment_id, 'The key takeaway from Module 3 is:', 'multiple_choice',
     '["Tension is always bad", "Identifying and eliminating unnecessary tension improves efficiency and regulation", "Relaxation is the only goal", "Tension cannot be controlled"]'::jsonb,
     1, 1, 20);
    
    RAISE NOTICE 'Module 3 assessment questions created successfully';
END $$;

-- =====================================================
-- MODULE 4: INTEGRATION & SELF-REGULATION
-- =====================================================

DO $$
DECLARE
    v_assessment_id UUID;
BEGIN
    SELECT a.id INTO v_assessment_id
    FROM assessments a
    JOIN training_modules tm ON a.module_id = tm.id
    WHERE tm.module_code = 'systema-scout-integration';
    
    IF v_assessment_id IS NULL THEN
        RAISE EXCEPTION 'Assessment for systema-scout-integration not found.';
    END IF;
    
    INSERT INTO assessment_questions (assessment_id, question_text, question_type, options, correct_answer, points, display_order) VALUES
    (v_assessment_id, 'What is the primary focus of Module 4?', 'multiple_choice',
     '["Learning new techniques", "Integrating walking, observation, and tension awareness", "Physical conditioning", "Memorizing procedures"]'::jsonb,
     1, 1, 1),
    
    (v_assessment_id, 'Integration in this module means:', 'multiple_choice',
     '["Combining different martial arts", "Bringing together breath, movement, observation, and tension awareness", "Joining a team", "Mixing training methods randomly"]'::jsonb,
     1, 1, 2),
    
    (v_assessment_id, 'What is self-regulation?', 'multiple_choice',
     '["Following rules", "The ability to manage your internal state and responses", "Regulating others", "Setting schedules"]'::jsonb,
     1, 1, 3),
    
    (v_assessment_id, 'Why is self-accountability emphasized in this module?', 'multiple_choice',
     '["To blame yourself", "To take responsibility for your state and choices", "To avoid help from others", "To judge yourself harshly"]'::jsonb,
     1, 1, 4),
    
    (v_assessment_id, 'How do you apply Systema Scout skills to professional scenarios?', 'multiple_choice',
     '["By fighting more", "By maintaining regulation and awareness in real situations", "By avoiding work", "By teaching others only"]'::jsonb,
     1, 1, 5),
    
    (v_assessment_id, 'What is the difficulty level of Module 4?', 'multiple_choice',
     '["Beginner", "Intermediate", "Advanced", "Expert"]'::jsonb,
     2, 1, 6),
    
    (v_assessment_id, 'The estimated time for Module 4 is:', 'multiple_choice',
     '["30 minutes", "45 minutes", "60 minutes", "90 minutes"]'::jsonb,
     2, 1, 7),
    
    (v_assessment_id, 'Integration requires:', 'multiple_choice',
     '["Forgetting previous modules", "Practicing all components together with awareness", "Choosing only one skill", "Avoiding complexity"]'::jsonb,
     1, 1, 8),
    
    (v_assessment_id, 'What does "self-accountability" mean in Systema Scout?', 'multiple_choice',
     '["Blaming yourself for everything", "Taking ownership of your internal state and responses", "Keeping detailed records", "Reporting to supervisors"]'::jsonb,
     1, 1, 9),
    
    (v_assessment_id, 'The module icon for Integration & Self-Regulation is:', 'multiple_choice',
     '["fa-link", "fa-puzzle-piece", "fa-cog", "fa-brain"]'::jsonb,
     1, 1, 10),
    
    (v_assessment_id, 'How do walking, observation, and tension awareness work together?', 'multiple_choice',
     '["They do not work together", "They create a comprehensive approach to self-regulation and awareness", "Only one is needed at a time", "They conflict with each other"]'::jsonb,
     1, 1, 11),
    
    (v_assessment_id, 'Applying skills to professional scenarios means:', 'multiple_choice',
     '["Only practicing in class", "Using regulation and awareness in real security situations", "Demonstrating techniques", "Teaching others"]'::jsonb,
     1, 1, 12),
    
    (v_assessment_id, 'What is the goal of self-regulation in security work?', 'multiple_choice',
     '["To control others", "To maintain your own calm and effective presence", "To suppress all emotions", "To avoid all stress"]'::jsonb,
     1, 1, 13),
    
    (v_assessment_id, 'Integration practice helps you:', 'multiple_choice',
     '["Forget basics", "Apply multiple skills simultaneously in complex situations", "Specialize in one area only", "Avoid difficult scenarios"]'::jsonb,
     1, 1, 14),
    
    (v_assessment_id, 'Why is Module 4 considered "Advanced"?', 'multiple_choice',
     '["It requires special equipment", "It integrates multiple skills and applies them to real scenarios", "It is physically demanding", "It has more rules"]'::jsonb,
     1, 1, 15),
    
    (v_assessment_id, 'Self-accountability includes:', 'multiple_choice',
     '["Blaming circumstances", "Honest self-assessment and taking responsibility for your state", "Avoiding mistakes", "Judging others"]'::jsonb,
     1, 1, 16),
    
    (v_assessment_id, 'How does integration relate to the foundational cycle?', 'multiple_choice',
     '["It replaces the cycle", "It applies the cycle to complex, real-world situations", "It contradicts the cycle", "It is unrelated"]'::jsonb,
     1, 1, 17),
    
    (v_assessment_id, 'What makes this module "professional application"?', 'multiple_choice',
     '["It teaches job skills", "It applies Systema Scout principles to actual security work", "It provides certifications", "It focuses on career advancement"]'::jsonb,
     1, 1, 18),
    
    (v_assessment_id, 'The key benefit of integration is:', 'multiple_choice',
     '["Simplifying practice", "Creating a comprehensive, adaptable approach to regulation", "Reducing training time", "Avoiding complexity"]'::jsonb,
     1, 1, 19),
    
    (v_assessment_id, 'Self-regulation in professional scenarios means:', 'multiple_choice',
     '["Controlling the situation", "Managing your own state to respond effectively", "Following protocols rigidly", "Avoiding responsibility"]'::jsonb,
     1, 1, 20);
    
    RAISE NOTICE 'Module 4 assessment questions created successfully';
END $$;

-- =====================================================
-- MODULE 5: CLOSING AIM & CONTINUED PRACTICE
-- =====================================================

DO $$
DECLARE
    v_assessment_id UUID;
BEGIN
    SELECT a.id INTO v_assessment_id
    FROM assessments a
    JOIN training_modules tm ON a.module_id = tm.id
    WHERE tm.module_code = 'systema-scout-closing';
    
    IF v_assessment_id IS NULL THEN
        RAISE EXCEPTION 'Assessment for systema-scout-closing not found.';
    END IF;
    
    INSERT INTO assessment_questions (assessment_id, question_text, question_type, options, correct_answer, points, display_order) VALUES
    (v_assessment_id, 'What is the primary focus of Module 5?', 'multiple_choice',
     '["Learning new techniques", "Reviewing course aims and establishing continued practice", "Final exam preparation", "Advanced combat training"]'::jsonb,
     1, 1, 1),
    
    (v_assessment_id, 'Why is continued practice important?', 'multiple_choice',
     '["To pass the course", "To maintain and deepen the skills and awareness developed", "To compete with others", "To earn certifications"]'::jsonb,
     1, 1, 2),
    
    (v_assessment_id, 'What does "sustainable practice routine" mean?', 'multiple_choice',
     '["Practicing every day for hours", "A realistic, maintainable approach to ongoing development", "Only practicing when convenient", "Practicing only in class"]'::jsonb,
     1, 1, 3),
    
    (v_assessment_id, 'The closing aim emphasizes:', 'multiple_choice',
     '["Ending the course", "Ongoing regulation, reflection, and responsibility", "Getting a certificate", "Moving to advanced courses"]'::jsonb,
     1, 1, 4),
    
    (v_assessment_id, 'What is the estimated time for Module 5?', 'multiple_choice',
     '["10-15 minutes", "20-30 minutes", "45-60 minutes", "90 minutes"]'::jsonb,
     1, 1, 5),
    
    (v_assessment_id, 'What difficulty level is Module 5?', 'multiple_choice',
     '["Beginner", "Intermediate", "Advanced", "Expert"]'::jsonb,
     0, 1, 6),
    
    (v_assessment_id, 'The module icon for Closing Aim is:', 'multiple_choice',
     '["fa-door-open", "fa-flag-checkered", "fa-trophy", "fa-graduation-cap"]'::jsonb,
     1, 1, 7),
    
    (v_assessment_id, 'What should you review in this module?', 'multiple_choice',
     '["Only the first module", "All course aims and how they apply to your practice", "Nothing, the course is over", "Only the hardest parts"]'::jsonb,
     1, 1, 8),
    
    (v_assessment_id, 'Continued growth in Systema Scout requires:', 'multiple_choice',
     '["No further practice", "Ongoing practice and self-reflection", "Only attending classes", "Competing with others"]'::jsonb,
     1, 1, 9),
    
    (v_assessment_id, 'What is the role of responsibility in continued practice?', 'multiple_choice',
     '["It is not important", "Taking ownership of your ongoing development and application", "Blaming others for lack of progress", "Avoiding difficult practice"]'::jsonb,
     1, 1, 10),
    
    (v_assessment_id, 'The course aims include:', 'multiple_choice',
     '["Only physical skills", "Internal regulation, perceptual awareness, and self-accountability", "Competitive achievements", "Memorizing techniques"]'::jsonb,
     1, 1, 11),
    
    (v_assessment_id, 'How should you approach continued practice?', 'multiple_choice',
     '["Randomly", "With intention, reflection, and consistency", "Only when motivated", "By copying others"]'::jsonb,
     1, 1, 12),
    
    (v_assessment_id, 'What is the ultimate goal of Systema Scout?', 'multiple_choice',
     '["To win fights", "To become someone whose presence makes situations safer", "To earn rank", "To teach others"]'::jsonb,
     1, 1, 13),
    
    (v_assessment_id, 'Reflection in continued practice means:', 'multiple_choice',
     '["Looking in a mirror", "Honest self-assessment of your state and progress", "Thinking about the past only", "Avoiding difficult truths"]'::jsonb,
     1, 1, 14),
    
    (v_assessment_id, 'What makes a practice routine sustainable?', 'multiple_choice',
     '["Practicing 8 hours daily", "It fits your life and can be maintained long-term", "It is easy and requires no effort", "It impresses others"]'::jsonb,
     1, 1, 15),
    
    (v_assessment_id, 'The foundational cycle (Breathe → Relax → Structure → Move) should be:', 'multiple_choice',
     '["Forgotten after the course", "Integrated into ongoing practice and daily life", "Only used in emergencies", "Taught to others immediately"]'::jsonb,
     1, 1, 16),
    
    (v_assessment_id, 'What is the relationship between course completion and continued practice?', 'multiple_choice',
     '["Completion ends practice", "Completion is the beginning of independent practice", "They are unrelated", "Practice should stop after completion"]'::jsonb,
     1, 1, 17),
    
    (v_assessment_id, 'How does Systema Scout define "growth"?', 'multiple_choice',
     '["Physical strength only", "Ongoing development of regulation, awareness, and responsibility", "Rank advancement", "Collecting certifications"]'::jsonb,
     1, 1, 18),
    
    (v_assessment_id, 'What should you take away from Systema Scout?', 'multiple_choice',
     '["A certificate", "Practical skills for self-regulation and a framework for continued growth", "Combat techniques only", "A new hobby"]'::jsonb,
     1, 1, 19),
    
    (v_assessment_id, 'The closing aim emphasizes that Systema Scout is:', 'multiple_choice',
     '["A one-time course", "A foundation for ongoing practice and development", "Only for security professionals", "A competitive system"]'::jsonb,
     1, 1, 20);
    
    RAISE NOTICE 'Module 5 assessment questions created successfully';
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Count questions per assessment
SELECT 
    tm.module_name,
    tm.module_code,
    a.assessment_name,
    COUNT(aq.id) as question_count
FROM assessments a
JOIN training_modules tm ON a.module_id = tm.id
LEFT JOIN assessment_questions aq ON a.id = aq.assessment_id
WHERE tm.module_code LIKE 'systema-scout-%'
GROUP BY tm.module_name, tm.module_code, a.assessment_name
ORDER BY tm.display_order;

-- Show sample questions from each module
SELECT 
    tm.module_name,
    aq.question_text,
    aq.display_order
FROM assessment_questions aq
JOIN assessments a ON aq.assessment_id = a.id
JOIN training_modules tm ON a.module_id = tm.id
WHERE tm.module_code LIKE 'systema-scout-%'
  AND aq.display_order <= 3
ORDER BY tm.display_order, aq.display_order;
