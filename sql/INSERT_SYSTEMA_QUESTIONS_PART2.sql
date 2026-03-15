-- =====================================================
-- INSERT SYSTEMA SCOUT ASSESSMENT QUESTIONS - PART 2
-- =====================================================
-- Modules 3, 4, and 5 (60 questions total)
-- Run this AFTER INSERT_SYSTEMA_QUESTIONS.sql
-- =====================================================

-- =====================================================
-- MODULE 3: GLOVE WORK (UNNECESSARY TENSION) (20 questions)
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
    
    INSERT INTO assessment_questions (assessment_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer) VALUES
    (v_assessment_id, 1, 'What is the primary focus of Module 3?', 'Building muscle tension', 'Identifying and eliminating unnecessary tension', 'Increasing grip strength', 'Learning boxing techniques', 'B'),
    (v_assessment_id, 2, 'Why is "glove work" used in this module?', 'To learn boxing', 'To create constrained movement that reveals tension patterns', 'To keep hands warm', 'To practice punching', 'B'),
    (v_assessment_id, 3, 'What is "unnecessary tension"?', 'All muscle engagement', 'Tension that does not contribute to the task and wastes energy', 'Feeling stressed', 'Being too relaxed', 'B'),
    (v_assessment_id, 4, 'How do you identify unnecessary tension?', 'By asking others', 'Through self-observation during constrained movement', 'By feeling pain', 'By measuring heart rate', 'B'),
    (v_assessment_id, 5, 'The goal of eliminating unnecessary tension is to:', 'Become completely limp', 'Move more efficiently with less wasted energy', 'Avoid all physical activity', 'Increase relaxation only', 'B'),
    (v_assessment_id, 6, 'What is the difficulty level of Module 3?', 'Beginner', 'Intermediate', 'Advanced', 'Expert', 'B'),
    (v_assessment_id, 7, 'The estimated time for Module 3 is:', '20-30 minutes', '30-45 minutes', '45-60 minutes', '90 minutes', 'C'),
    (v_assessment_id, 8, 'Constrained movement refers to:', 'Being tied up', 'Movement with limitations that highlight tension patterns', 'Moving in small spaces', 'Restricted breathing', 'B'),
    (v_assessment_id, 9, 'Self-observation in this module means:', 'Looking in a mirror', 'Paying attention to your internal state and tension patterns', 'Watching yourself on video', 'Judging your appearance', 'B'),
    (v_assessment_id, 10, 'Why is it important to eliminate unnecessary tension in security work?', 'It is not important', 'It conserves energy and allows for better response and endurance', 'It makes you look relaxed', 'It impresses others', 'B'),
    (v_assessment_id, 11, 'The module icon for Glove Work is:', 'fa-fist-raised', 'fa-hand-paper', 'fa-boxing-glove', 'fa-hand-rock', 'B'),
    (v_assessment_id, 12, 'What should you notice during glove work exercises?', 'How strong you are', 'Where you hold unnecessary tension and how it affects movement', 'How fast you can move', 'What others are doing', 'B'),
    (v_assessment_id, 13, 'Tension patterns are:', 'Random', 'Habitual ways you hold tension in your body', 'Always beneficial', 'Impossible to change', 'B'),
    (v_assessment_id, 14, 'How does eliminating unnecessary tension relate to the foundational cycle?', 'It does not relate', 'It supports the Relax component while maintaining Structure', 'It replaces the cycle', 'It only relates to Move', 'B'),
    (v_assessment_id, 15, 'What is the difference between relaxation and eliminating unnecessary tension?', 'They are the same', 'Eliminating tension maintains structure and readiness; relaxation may not', 'Relaxation is better', 'Tension elimination is passive', 'B'),
    (v_assessment_id, 16, 'Glove work exercises help you:', 'Punch harder', 'Become aware of habitual tension and learn to release it', 'Develop calluses', 'Practice self-defense', 'B'),
    (v_assessment_id, 17, 'Why is self-observation emphasized in this module?', 'To criticize yourself', 'Because only you can feel and identify your own tension patterns', 'To compare with others', 'To avoid external feedback', 'B'),
    (v_assessment_id, 18, 'What happens when you eliminate unnecessary tension?', 'You become weak', 'You move more efficiently and conserve energy', 'You lose all muscle tone', 'You cannot respond to threats', 'B'),
    (v_assessment_id, 19, 'How does unnecessary tension affect decision-making?', 'It improves decisions', 'It can cloud judgment and slow response', 'It has no effect', 'It only affects physical performance', 'B'),
    (v_assessment_id, 20, 'The key takeaway from Module 3 is:', 'Tension is always bad', 'Identifying and eliminating unnecessary tension improves efficiency and regulation', 'Relaxation is the only goal', 'Tension cannot be controlled', 'B');
    
    RAISE NOTICE 'Module 3: 20 questions inserted';
END $$;

-- =====================================================
-- MODULE 4: INTEGRATION & SELF-REGULATION (20 questions)
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
    
    INSERT INTO assessment_questions (assessment_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer) VALUES
    (v_assessment_id, 1, 'What is the primary focus of Module 4?', 'Learning new techniques', 'Integrating walking, observation, and tension awareness', 'Physical conditioning', 'Memorizing procedures', 'B'),
    (v_assessment_id, 2, 'Integration in this module means:', 'Combining different martial arts', 'Bringing together breath, movement, observation, and tension awareness', 'Joining a team', 'Mixing training methods randomly', 'B'),
    (v_assessment_id, 3, 'What is self-regulation?', 'Following rules', 'The ability to manage your internal state and responses', 'Regulating others', 'Setting schedules', 'B'),
    (v_assessment_id, 4, 'Why is self-accountability emphasized in this module?', 'To blame yourself', 'To take responsibility for your state and choices', 'To avoid help from others', 'To judge yourself harshly', 'B'),
    (v_assessment_id, 5, 'How do you apply Systema Scout skills to professional scenarios?', 'By fighting more', 'By maintaining regulation and awareness in real situations', 'By avoiding work', 'By teaching others only', 'B'),
    (v_assessment_id, 6, 'What is the difficulty level of Module 4?', 'Beginner', 'Intermediate', 'Advanced', 'Expert', 'C'),
    (v_assessment_id, 7, 'The estimated time for Module 4 is:', '30 minutes', '45 minutes', '60 minutes', '90 minutes', 'C'),
    (v_assessment_id, 8, 'Integration requires:', 'Forgetting previous modules', 'Practicing all components together with awareness', 'Choosing only one skill', 'Avoiding complexity', 'B'),
    (v_assessment_id, 9, 'What does "self-accountability" mean in Systema Scout?', 'Blaming yourself for everything', 'Taking ownership of your internal state and responses', 'Keeping detailed records', 'Reporting to supervisors', 'B'),
    (v_assessment_id, 10, 'The module icon for Integration & Self-Regulation is:', 'fa-link', 'fa-puzzle-piece', 'fa-cog', 'fa-brain', 'B'),
    (v_assessment_id, 11, 'How do walking, observation, and tension awareness work together?', 'They do not work together', 'They create a comprehensive approach to self-regulation and awareness', 'Only one is needed at a time', 'They conflict with each other', 'B'),
    (v_assessment_id, 12, 'Applying skills to professional scenarios means:', 'Only practicing in class', 'Using regulation and awareness in real security situations', 'Demonstrating techniques', 'Teaching others', 'B'),
    (v_assessment_id, 13, 'What is the goal of self-regulation in security work?', 'To control others', 'To maintain your own calm and effective presence', 'To suppress all emotions', 'To avoid all stress', 'B'),
    (v_assessment_id, 14, 'Integration practice helps you:', 'Forget basics', 'Apply multiple skills simultaneously in complex situations', 'Specialize in one area only', 'Avoid difficult scenarios', 'B'),
    (v_assessment_id, 15, 'Why is Module 4 considered "Advanced"?', 'It requires special equipment', 'It integrates multiple skills and applies them to real scenarios', 'It is physically demanding', 'It has more rules', 'B'),
    (v_assessment_id, 16, 'Self-accountability includes:', 'Blaming circumstances', 'Honest self-assessment and taking responsibility for your state', 'Avoiding mistakes', 'Judging others', 'B'),
    (v_assessment_id, 17, 'How does integration relate to the foundational cycle?', 'It replaces the cycle', 'It applies the cycle to complex, real-world situations', 'It contradicts the cycle', 'It is unrelated', 'B'),
    (v_assessment_id, 18, 'What makes this module "professional application"?', 'It teaches job skills', 'It applies Systema Scout principles to actual security work', 'It provides certifications', 'It focuses on career advancement', 'B'),
    (v_assessment_id, 19, 'The key benefit of integration is:', 'Simplifying practice', 'Creating a comprehensive, adaptable approach to regulation', 'Reducing training time', 'Avoiding complexity', 'B'),
    (v_assessment_id, 20, 'Self-regulation in professional scenarios means:', 'Controlling the situation', 'Managing your own state to respond effectively', 'Following protocols rigidly', 'Avoiding responsibility', 'B');
    
    RAISE NOTICE 'Module 4: 20 questions inserted';
END $$;

-- =====================================================
-- MODULE 5: CLOSING AIM & CONTINUED PRACTICE (20 questions)
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
    
    INSERT INTO assessment_questions (assessment_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer) VALUES
    (v_assessment_id, 1, 'What is the primary focus of Module 5?', 'Learning new techniques', 'Reviewing course aims and establishing continued practice', 'Final exam preparation', 'Advanced combat training', 'B'),
    (v_assessment_id, 2, 'Why is continued practice important?', 'To pass the course', 'To maintain and deepen the skills and awareness developed', 'To compete with others', 'To earn certifications', 'B'),
    (v_assessment_id, 3, 'What does "sustainable practice routine" mean?', 'Practicing every day for hours', 'A realistic, maintainable approach to ongoing development', 'Only practicing when convenient', 'Practicing only in class', 'B'),
    (v_assessment_id, 4, 'The closing aim emphasizes:', 'Ending the course', 'Ongoing regulation, reflection, and responsibility', 'Getting a certificate', 'Moving to advanced courses', 'B'),
    (v_assessment_id, 5, 'What is the estimated time for Module 5?', '10-15 minutes', '20-30 minutes', '45-60 minutes', '90 minutes', 'B'),
    (v_assessment_id, 6, 'What difficulty level is Module 5?', 'Beginner', 'Intermediate', 'Advanced', 'Expert', 'A'),
    (v_assessment_id, 7, 'The module icon for Closing Aim is:', 'fa-door-open', 'fa-flag-checkered', 'fa-trophy', 'fa-graduation-cap', 'B'),
    (v_assessment_id, 8, 'What should you review in this module?', 'Only the first module', 'All course aims and how they apply to your practice', 'Nothing, the course is over', 'Only the hardest parts', 'B'),
    (v_assessment_id, 9, 'Continued growth in Systema Scout requires:', 'No further practice', 'Ongoing practice and self-reflection', 'Only attending classes', 'Competing with others', 'B'),
    (v_assessment_id, 10, 'What is the role of responsibility in continued practice?', 'It is not important', 'Taking ownership of your ongoing development and application', 'Blaming others for lack of progress', 'Avoiding difficult practice', 'B'),
    (v_assessment_id, 11, 'The course aims include:', 'Only physical skills', 'Internal regulation, perceptual awareness, and self-accountability', 'Competitive achievements', 'Memorizing techniques', 'B'),
    (v_assessment_id, 12, 'How should you approach continued practice?', 'Randomly', 'With intention, reflection, and consistency', 'Only when motivated', 'By copying others', 'B'),
    (v_assessment_id, 13, 'What is the ultimate goal of Systema Scout?', 'To win fights', 'To become someone whose presence makes situations safer', 'To earn rank', 'To teach others', 'B'),
    (v_assessment_id, 14, 'Reflection in continued practice means:', 'Looking in a mirror', 'Honest self-assessment of your state and progress', 'Thinking about the past only', 'Avoiding difficult truths', 'B'),
    (v_assessment_id, 15, 'What makes a practice routine sustainable?', 'Practicing 8 hours daily', 'It fits your life and can be maintained long-term', 'It is easy and requires no effort', 'It impresses others', 'B'),
    (v_assessment_id, 16, 'The foundational cycle (Breathe → Relax → Structure → Move) should be:', 'Forgotten after the course', 'Integrated into ongoing practice and daily life', 'Only used in emergencies', 'Taught to others immediately', 'B'),
    (v_assessment_id, 17, 'What is the relationship between course completion and continued practice?', 'Completion ends practice', 'Completion is the beginning of independent practice', 'They are unrelated', 'Practice should stop after completion', 'B'),
    (v_assessment_id, 18, 'How does Systema Scout define "growth"?', 'Physical strength only', 'Ongoing development of regulation, awareness, and responsibility', 'Rank advancement', 'Collecting certifications', 'B'),
    (v_assessment_id, 19, 'What should you take away from Systema Scout?', 'A certificate', 'Practical skills for self-regulation and a framework for continued growth', 'Combat techniques only', 'A new hobby', 'B'),
    (v_assessment_id, 20, 'The closing aim emphasizes that Systema Scout is:', 'A one-time course', 'A foundation for ongoing practice and development', 'Only for security professionals', 'A competitive system', 'B');
    
    RAISE NOTICE 'Module 5: 20 questions inserted';
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'All Systema Scout assessment questions inserted successfully!';
END $$;

-- Count total questions per module
SELECT 
    tm.module_name,
    COUNT(aq.id) as question_count
FROM assessments a
JOIN training_modules tm ON a.module_id = tm.id
LEFT JOIN assessment_questions aq ON a.id = aq.assessment_id
WHERE tm.module_code LIKE 'systema-scout%'
GROUP BY tm.module_name, tm.display_order
ORDER BY tm.display_order;

-- Total count across all modules
SELECT COUNT(*) as total_systema_questions
FROM assessment_questions aq
JOIN assessments a ON aq.assessment_id = a.id
JOIN training_modules tm ON a.module_id = tm.id
WHERE tm.module_code LIKE 'systema-scout%';
