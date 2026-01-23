-- =====================================================
-- SYSTEMA SCOUT MODULE SLIDES
-- =====================================================
-- Creates slides for all 6 Systema Scout modules
-- Run this after CREATE_SYSTEMA_SCOUT_COURSE.sql
-- Placeholder for images and voiceovers to be added later
-- =====================================================

-- =====================================================
-- MODULE 0: ORIENTATION & PHILOSOPHY
-- =====================================================

DO $$
DECLARE
    v_module_id UUID;
BEGIN
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'systema-scout-orientation';
    
    IF v_module_id IS NOT NULL THEN
        -- Slide 1: Welcome
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 1, 'title', 'Systema Scout', 
        '<h1>Systema Scout</h1><h2>Foundational Internal Training</h2><p>Welcome to a transformative journey in self-regulation and awareness.</p>');
        
        -- Slide 2: Orientation & Purpose
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 2, 'content', 'Orientation & Purpose', 
        '<h2>What is Systema Scout?</h2>
        <p>Systema Scout is a foundational, experiential training framework rooted in Systema principles.</p>
        <p><strong>The outcomes are qualitative and experiential</strong>, based on first-person awareness and observable behavioral changes rather than numerical metrics.</p>
        <h3>What to Expect:</h3>
        <ul>
            <li>A noticeable change in how stress affects you professionally and personally</li>
            <li>A shift in perception and decision-making</li>
            <li>A growing, evolving relationship with empathy</li>
            <li>Clearer relationship to personal and professional codes of behavior</li>
            <li>Increased self-accountability</li>
            <li>Ability to self-debrief after difficult situations in an empathetic, non-punitive way</li>
        </ul>');
        
        -- Slide 3: The Goal
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 3, 'content', 'The Goal', 
        '<h2>The Goal is Not Perfection</h2>
        <p class="emphasis">The goal is ongoing regulation, reflection, and responsibility.</p>
        <p>This training is about becoming, not arriving. It is a practice, not a destination.</p>');
        
        -- Slide 4: Axis & Audience
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 4, 'content', 'Axis & Audience', 
        '<h2>The Axis of Responsibility</h2>
        <p><strong>The axis of Systema Scout is responsibility, not profession.</strong></p>
        <h3>Primary Audience:</h3>
        <ul>
            <li>Security professionals</li>
            <li>Law enforcement</li>
            <li>Military personnel</li>
        </ul>
        <h3>Also For:</h3>
        <ul>
            <li>Parents and caregivers</li>
            <li>Educators working with children and adults</li>
            <li>Coaches</li>
            <li>Community members holding responsibility in tense situations</li>
        </ul>
        <p class="emphasis">This training is for people who want to become someone whose presence makes situations safer rather than more volatile.</p>');
        
        -- Slide 5: Training Orientation
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 5, 'content', 'Training Orientation', 
        '<h2>Our Approach</h2>
        <p><strong>Systema Scout does not diagnose people or situations.</strong></p>
        <p>Like everyone else present, practitioners recognize when something is wrong because the situation has already declared itself. That is why a call came in, or why help was requested. Rarely is the responder the first witness.</p>
        <p class="emphasis">The role is not to assign cause, but to regulate the situation.</p>
        <h3>Training Logic:</h3>
        <p>Internal exploration first, before proximity, contact, or force.</p>
        <p>Instinct is not suppressed. It is observed. Flinching may be appropriate. Keeping the head up and eyes open may be appropriate.</p>
        <p><strong>Training builds choice around instinct, a uniquely human quality.</strong></p>');
        
        -- Slide 6: The Foundational Cycle
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 6, 'content', 'The Foundational Cycle', 
        '<h2>Breathe → Relax → Structure → Move</h2>
        <p>A foundational cycle runs throughout the work:</p>
        <div class="cycle">
            <h3>Breathe</h3>
            <p>Breathing modulates state. Longer exhales bias relaxation. Shorter exhales bias activation.</p>
            <h3>Relax</h3>
            <p>Relaxation removes unnecessary tension, but without structure becomes collapse.</p>
            <h3>Structure</h3>
            <p>Structure is shaped by intent.</p>
            <h3>Move</h3>
            <p>Movement expresses intent, creates tension, alters breath, and returns the practitioner to the beginning of the cycle.</p>
        </div>
        <p class="emphasis">Self-observation is continuous.</p>');
        
        -- Slide 7: Safety & Scope
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 7, 'content', 'Safety & Scope', 
        '<h2>Training Principles</h2>
        <ul>
            <li>Most foundational work is solo and appropriate for online training</li>
            <li>Partner work is largely reserved for in-person instruction</li>
            <li><strong>No competitive effort</strong></li>
            <li><strong>No pushing through sharp pain</strong></li>
            <li>Breath always returns naturally</li>
            <li>Injury or limitation is treated as a constraint to work around, not something to ignore or overpower</li>
        </ul>
        <p class="emphasis">Even when movement is restricted by contact or control, options still exist.</p>
        <p><strong>Limitation is information.</strong></p>');
        
        -- Slide 8: Module Complete
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 8, 'completion', 'Orientation Complete', 
        '<h2>Foundation Established</h2>
        <p>You now understand the framework and principles of Systema Scout.</p>
        <p>In the next modules, you will begin the practical drills that develop these skills.</p>
        <p class="emphasis">Remember: The goal is ongoing regulation, reflection, and responsibility.</p>');
        
        RAISE NOTICE 'Created 8 slides for Module 0: Orientation & Philosophy';
    END IF;
END $$;

-- =====================================================
-- MODULE 1: WALKING, BREATHING, AND CHOICE
-- =====================================================

DO $$
DECLARE
    v_module_id UUID;
BEGIN
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'systema-scout-walking';
    
    IF v_module_id IS NOT NULL THEN
        -- Slide 1: Introduction
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 1, 'title', 'Walking, Breathing, and Choice', 
        '<h1>Drill 1</h1><h2>Walking, Breathing, and Choice</h2><p>Exploring the relationship between movement, breath, and conscious awareness.</p>');
        
        -- Slide 2: First, Walk
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 2, 'content', 'First, Walk', 
        '<h2>Walk Freely</h2>
        <p>Find a space where you can walk safely.</p>
        <p><strong>Walk without destination. Wander. Observe the world.</strong></p>
        <p>If you''re in a room, pace around. If you''re outside, go wherever feels right.</p>
        <p>There is no correct way to do this. Just walk.</p>');
        
        -- Slide 3: Monitor Your Breathing
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 3, 'content', 'Monitor Your Breathing', 
        '<h2>Observe Your Breath</h2>
        <p>After you''ve been walking, monitor your breathing.</p>
        <p class="emphasis">Notice that as soon as you start monitoring your breathing, it will change.</p>
        <p>Breathing is like this. We can choose how to breathe or we can just let it happen. It is one of the few things the body can do consciously and subconsciously.</p>
        <h3>Ask Yourself:</h3>
        <ul>
            <li>How many steps are you inhaling for?</li>
            <li>How many steps are you exhaling for?</li>
        </ul>
        <p>Depending on your walking pace, your breathing will be different.</p>');
        
        -- Slide 4: Notice Your Natural Way
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 4, 'content', 'Your Natural Way', 
        '<h2>Observe Your Habits</h2>
        <p>Before moving on, notice your natural way of walking.</p>
        <p>Is it more like a slow vacation stroll, sand under your toes and waves in your ears?</p>
        <p>Or is it more like you''re late for work and the bus is coming down the block?</p>
        <p class="emphasis">Neither is wrong. Observe your habits and what you are not choosing.</p>');
        
        -- Slide 5: Breath Counts 1-3
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 5, 'content', 'Breath Counts: 1-3', 
        '<h2>Switch Your Breathing</h2>
        <p>Now consciously change your breath pattern:</p>
        <h3>One Step In, One Step Out</h3>
        <p>Inhale for one step, exhale for one step.</p>
        <p>This is faster than most people breathe.</p>
        <h3>Two Steps In, Two Steps Out</h3>
        <p>When ready, switch to two steps for each phase.</p>
        <h3>Three Steps In, Three Steps Out</h3>
        <p>Then three. Three is often very relaxed.</p>');
        
        -- Slide 6: Higher Numbers
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 6, 'content', 'Higher Numbers', 
        '<h2>Continue Upward</h2>
        <p>Continue with four, five, all the way up to ten, fifteen, or even twenty.</p>
        <p>Higher numbers are difficult. There are methods to make them easier, but for now just do whatever comes.</p>
        <p><strong>Notice:</strong></p>
        <ul>
            <li>How does your body respond to longer breath counts?</li>
            <li>What changes in your walking pace?</li>
            <li>Where does tension appear?</li>
        </ul>');
        
        -- Slide 7: Asymmetric Breathing
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 7, 'content', 'Asymmetric Breathing', 
        '<h2>Variations</h2>
        <p>As you go up in numbers, keep one number the same and reset the other.</p>
        <h3>Example 1:</h3>
        <p>Inhale for ten, exhale for one</p>
        <p>Gradually bring the exhale back to ten</p>
        <h3>Example 2:</h3>
        <p>Inhale for one, exhale for ten</p>
        <p class="emphasis">This can be done at any point in the sequence.</p>
        <p>Notice how asymmetric breathing affects your state and movement.</p>');
        
        -- Slide 8: Backward Walking
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 8, 'content', 'Backward Walking', 
        '<h2>Walking Backward</h2>
        <p><strong>Carefully.</strong> Looking behind you or not. You know where you are. Be safe.</p>
        <p>Monitor how the fear of not knowing what''s behind you affects your breathing and movement.</p>
        <h3>Observe:</h3>
        <ul>
            <li>Does your breath become shorter?</li>
            <li>Do you hold your breath?</li>
            <li>Where does tension appear in your body?</li>
            <li>How does uncertainty affect your movement quality?</li>
        </ul>');
        
        -- Slide 9: Practice Instructions
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 9, 'content', 'Practice Instructions', 
        '<h2>Your Practice</h2>
        <p>Take 15-20 minutes to practice this drill now.</p>
        <h3>Sequence:</h3>
        <ol>
            <li>Walk freely and observe natural breathing (3-5 minutes)</li>
            <li>Practice breath counts 1-10 (5-7 minutes)</li>
            <li>Explore asymmetric breathing (3-5 minutes)</li>
            <li>Try backward walking with breath awareness (3-5 minutes)</li>
        </ol>
        <p class="emphasis">Remember: This is observation, not performance. There is no correct outcome.</p>');
        
        -- Slide 10: Module Complete
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 10, 'completion', 'Drill Complete', 
        '<h2>Walking, Breathing, and Choice</h2>
        <p>You have completed the first foundational drill.</p>
        <p>This practice develops conscious choice around automatic processes.</p>
        <p>Continue to the next module when ready.</p>');
        
        RAISE NOTICE 'Created 10 slides for Module 1: Walking, Breathing, and Choice';
    END IF;
END $$;

-- =====================================================
-- MODULE 2: SECURITY ASSESSMENT (OBSERVATION AND RECALL)
-- =====================================================

DO $$
DECLARE
    v_module_id UUID;
BEGIN
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'systema-scout-observation';
    
    IF v_module_id IS NOT NULL THEN
        -- Slide 1: Introduction
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 1, 'title', 'Security Assessment', 
        '<h1>Drill 2</h1><h2>Security Assessment: Observation & Recall</h2><p>Developing perceptual awareness and environmental observation.</p>');
        
        -- Slide 2: After the Walk
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 2, 'content', 'After the Walk', 
        '<h2>Sit or Lie Down</h2>
        <p>After completing the walking drill, find a comfortable position.</p>
        <p>Close your eyes. Relax.</p>
        <p>This is the beginning of the recall process.</p>');
        
        -- Slide 3: Relive the Walk
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 3, 'content', 'Relive the Walk', 
        '<h2>Go Back in Memory</h2>
        <p>Go back in your memory to the beginning of the walk and try to relive it.</p>
        <p><strong>Try to feel in your body what it felt like.</strong></p>
        <p>Notice where your attention was.</p>
        <p>It''s okay if the replay is a little faster than the walk took. If you''re really doing this, it may also be exactly the same length.</p>');
        
        -- Slide 4: Record Everything
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 4, 'content', 'Record Everything', 
        '<h2>Concrete and Tangible</h2>
        <p>When the walk is complete in your memory, come back and record in a notebook everything you noticed outside of yourself.</p>
        <p class="emphasis">Everything concrete and tangible. Do not make anything up.</p>
        <h3>Examples:</h3>
        <ul>
            <li>Colors of objects</li>
            <li>Sounds you heard</li>
            <li>People you passed</li>
            <li>Vehicles you saw</li>
            <li>Temperature changes</li>
            <li>Textures underfoot</li>
        </ul>');
        
        -- Slide 5: Details Matter
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 5, 'content', 'Details Matter', 
        '<h2>How Many Details?</h2>
        <p>If you did this in your own house, see how many details you can remember.</p>
        <p>If you did it outside, what cars did you pass or see pass you?</p>
        <p><strong>Ask good questions and see if you can build a scenario.</strong></p>
        <h3>For Security Work:</h3>
        <p>This is part of incident awareness and reporting.</p>
        <h3>For Systema Scout:</h3>
        <p>This is the beginning of opening awareness all the time and practicing opening it further.</p>');
        
        -- Slide 6: Practice Instructions
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 6, 'content', 'Practice Instructions', 
        '<h2>Your Practice</h2>
        <p>Complete a 10-15 minute walk, then practice recall.</p>
        <h3>Sequence:</h3>
        <ol>
            <li>Walk for 10-15 minutes with open awareness</li>
            <li>Sit or lie down and close your eyes (2-3 minutes)</li>
            <li>Relive the walk in memory (5-10 minutes)</li>
            <li>Write down everything concrete you observed (5-10 minutes)</li>
        </ol>
        <p class="emphasis">Do not judge the quantity. Simply observe what you noticed and what you did not.</p>');
        
        -- Slide 7: Building Awareness
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 7, 'content', 'Building Awareness', 
        '<h2>Continuous Practice</h2>
        <p>This drill can be practiced anywhere, anytime.</p>
        <p>After any walk, any drive, any interaction, you can pause and recall:</p>
        <ul>
            <li>What did I see?</li>
            <li>What did I hear?</li>
            <li>What was the environment like?</li>
            <li>Who was present?</li>
            <li>What changed during the experience?</li>
        </ul>
        <p class="emphasis">The practice is not about perfect recall. It is about training attention.</p>');
        
        -- Slide 8: Module Complete
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 8, 'completion', 'Drill Complete', 
        '<h2>Observation & Recall</h2>
        <p>You have completed the second foundational drill.</p>
        <p>This practice develops perceptual awareness and environmental observation.</p>
        <p>Continue to the next module when ready.</p>');
        
        RAISE NOTICE 'Created 8 slides for Module 2: Security Assessment';
    END IF;
END $$;

-- =====================================================
-- MODULE 3: GLOVE WORK (UNNECESSARY TENSION)
-- =====================================================

DO $$
DECLARE
    v_module_id UUID;
BEGIN
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'systema-scout-tension';
    
    IF v_module_id IS NOT NULL THEN
        -- Slide 1: Introduction
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 1, 'title', 'Glove Work', 
        '<h1>Drill 3</h1><h2>Glove Work: Unnecessary Tension</h2><p>Identifying and eliminating unnecessary tension through constrained movement.</p>');
        
        -- Slide 2: Get a Glove
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 2, 'content', 'Get a Glove', 
        '<h2>Materials Needed</h2>
        <p>Go get a glove. Put it on.</p>
        <p><strong>Recommended gloves:</strong></p>
        <ul>
            <li>Latex or nitrile gloves</li>
            <li>Tight leather driving gloves</li>
            <li>Golf gloves</li>
            <li>Any tight-fitting glove</li>
        </ul>
        <p>The tighter the fit, the more challenging the drill.</p>');
        
        -- Slide 3: The Task
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 3, 'content', 'The Task', 
        '<h2>Remove the Glove</h2>
        <p>Now get the glove off your hand:</p>
        <ul>
            <li><strong>Without</strong> rubbing your hand against your body</li>
            <li><strong>Without</strong> shaking your arm or hand</li>
            <li><strong>Only</strong> using your fingers and hand mobility</li>
        </ul>
        <p class="emphasis">Do it now. Observe yourself. Then come back.</p>');
        
        -- Slide 4: What Shows Up
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 4, 'content', 'What Shows Up', 
        '<h2>Notice What Appears</h2>
        <p>As you work to remove the glove, observe:</p>
        <ul>
            <li>Jaw tension</li>
            <li>Mouth or cheek movement</li>
            <li>A foot flexing on the same side</li>
            <li>Breath shifting almost instantly</li>
        </ul>
        <p class="emphasis">All of that is unnecessary.</p>
        <p>Why do these physical responses show up? What about your psychological state? A bit of stress.</p>
        <p><strong>Why does effort show itself as tension?</strong></p>');
        
        -- Slide 5: Compartmentalized Brain
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 5, 'content', 'The Compartmentalized Brain', 
        '<h2>Internal Communication</h2>
        <p>The brain is often compartmentalized.</p>
        <p>One part gives the order. Another part reacts to how hard it feels and makes sure the first part knows.</p>
        <p class="emphasis">It''s comical when you notice it.</p>
        <h3>Ask Yourself:</h3>
        <ul>
            <li>Is the part giving the order you?</li>
            <li>Is the part reacting to effort you?</li>
            <li>Or can you step back and observe the whole system?</li>
        </ul>');
        
        -- Slide 6: The Constraint
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 6, 'content', 'The Constraint', 
        '<h2>Intentional Difficulty</h2>
        <p>Under these constraints, removing the glove is, for all intents and purposes, impossible.</p>
        <p class="emphasis">That is intentional.</p>
        <p>The drill is not about successfully removing the glove.</p>
        <p>The drill is about observing what happens in your system when faced with a difficult, constrained task.</p>');
        
        -- Slide 7: Variations
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 7, 'content', 'Variations', 
        '<h2>Explore Different Conditions</h2>
        <p>Try removing the glove under different conditions:</p>
        <ul>
            <li><strong>Eyes closed</strong> - How does removing visual feedback change the experience?</li>
            <li><strong>Lying down</strong> - Does this increase or decrease physical tension?</li>
            <li><strong>Walking</strong> - Can you maintain the task while moving?</li>
            <li><strong>Two gloves at once</strong> - Increased complexity and constraint</li>
        </ul>
        <p>Notice whether lying down increases or decreases physical tension. Notice the psychological tension as well.</p>');
        
        -- Slide 8: Optional Humility Drill
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 8, 'content', 'Optional Humility Drill', 
        '<h2>Advanced Challenge</h2>
        <p class="emphasis">Try removing your clothes without touching them.</p>
        <p>Good luck.</p>
        <p>(This is intentionally impossible and serves to highlight the absurdity of some constraints.)</p>');
        
        -- Slide 9: Practice Instructions
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 9, 'content', 'Practice Instructions', 
        '<h2>Your Practice</h2>
        <p>Spend 15-20 minutes with this drill.</p>
        <h3>Sequence:</h3>
        <ol>
            <li>Basic glove removal (5 minutes)</li>
            <li>Eyes closed variation (3-5 minutes)</li>
            <li>Lying down variation (3-5 minutes)</li>
            <li>Walking variation (3-5 minutes)</li>
        </ol>
        <p class="emphasis">Focus on observation, not success. What tension appears? Where? Why?</p>');
        
        -- Slide 10: Module Complete
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 10, 'completion', 'Drill Complete', 
        '<h2>Unnecessary Tension</h2>
        <p>You have completed the third foundational drill.</p>
        <p>This practice develops awareness of unnecessary tension and the relationship between effort and stress.</p>
        <p>Continue to the next module when ready.</p>');
        
        RAISE NOTICE 'Created 10 slides for Module 3: Glove Work';
    END IF;
END $$;

-- =====================================================
-- MODULE 4: INTEGRATION & SELF-REGULATION
-- =====================================================

DO $$
DECLARE
    v_module_id UUID;
BEGIN
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'systema-scout-integration';
    
    IF v_module_id IS NOT NULL THEN
        -- Slide 1: Introduction
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 1, 'title', 'Integration & Self-Regulation', 
        '<h1>Module 4</h1><h2>Integration & Self-Regulation</h2><p>Combining all practices into daily life and professional work.</p>');
        
        -- Slide 2: The Three Drills
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 2, 'content', 'The Three Drills', 
        '<h2>What You''ve Learned</h2>
        <h3>Drill 1: Walking, Breathing, and Choice</h3>
        <p>Conscious modulation of breath and movement</p>
        <h3>Drill 2: Security Assessment</h3>
        <p>Perceptual awareness and environmental observation</p>
        <h3>Drill 3: Glove Work</h3>
        <p>Recognition and elimination of unnecessary tension</p>
        <p class="emphasis">Now we integrate these practices.</p>');
        
        -- Slide 3: Combined Practice
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 3, 'content', 'Combined Practice', 
        '<h2>All Three Together</h2>
        <p>Practice all three drills in sequence:</p>
        <ol>
            <li>Walk with breath awareness (10 minutes)</li>
            <li>Sit and recall the walk (5 minutes)</li>
            <li>Practice glove work while maintaining breath awareness (10 minutes)</li>
        </ol>
        <p>Notice how each drill informs the others.</p>
        <p>Does breath awareness help with tension? Does observation change your walking? Does constraint affect your breath?</p>');
        
        -- Slide 4: Daily Life Application
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 4, 'content', 'Daily Life Application', 
        '<h2>Beyond Formal Practice</h2>
        <p>These skills apply to everyday situations:</p>
        <ul>
            <li><strong>Stressful conversations:</strong> Notice your breath, relax unnecessary tension</li>
            <li><strong>Commuting:</strong> Practice environmental observation</li>
            <li><strong>Physical tasks:</strong> Identify and eliminate excess effort</li>
            <li><strong>Difficult decisions:</strong> Use breath to modulate your state</li>
        </ul>
        <p class="emphasis">The practice is always available.</p>');
        
        -- Slide 5: Professional Application
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 5, 'content', 'Professional Application', 
        '<h2>In Security Work</h2>
        <p>For security professionals, law enforcement, and military:</p>
        <ul>
            <li><strong>Pre-shift:</strong> Walking drill to establish baseline regulation</li>
            <li><strong>During patrol:</strong> Continuous environmental observation</li>
            <li><strong>Tense situations:</strong> Breath modulation to maintain composure</li>
            <li><strong>Physical intervention:</strong> Eliminate unnecessary tension</li>
            <li><strong>Post-incident:</strong> Self-debrief with empathy</li>
        </ul>');
        
        -- Slide 6: Self-Debrief
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 6, 'content', 'Self-Debrief', 
        '<h2>Empathetic Self-Reflection</h2>
        <p>After difficult situations, practice self-debrief:</p>
        <ol>
            <li><strong>Observe:</strong> What happened? (Concrete facts only)</li>
            <li><strong>Notice:</strong> What did I feel? (Physical and emotional)</li>
            <li><strong>Reflect:</strong> What choices did I make?</li>
            <li><strong>Consider:</strong> What options existed?</li>
            <li><strong>Learn:</strong> What would I do differently?</li>
        </ol>
        <p class="emphasis">This is non-punitive. The goal is learning, not judgment.</p>');
        
        -- Slide 7: Self-Accountability
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 7, 'content', 'Self-Accountability', 
        '<h2>Responsibility Without Punishment</h2>
        <p>Self-accountability means:</p>
        <ul>
            <li>Acknowledging your actions and their effects</li>
            <li>Recognizing when you could have done better</li>
            <li>Committing to improvement without self-punishment</li>
            <li>Understanding that mistakes are information</li>
        </ul>
        <p class="emphasis">The goal is not perfection. The goal is ongoing regulation, reflection, and responsibility.</p>');
        
        -- Slide 8: Building a Practice
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 8, 'content', 'Building a Practice', 
        '<h2>Sustainable Routine</h2>
        <p>Create a practice that fits your life:</p>
        <h3>Minimal Daily Practice (10-15 minutes):</h3>
        <ul>
            <li>5-minute walking drill</li>
            <li>5-minute glove work</li>
            <li>Brief observation recall</li>
        </ul>
        <h3>Full Practice (30-45 minutes):</h3>
        <ul>
            <li>15-minute walking drill with varied breath counts</li>
            <li>10-minute observation and recall</li>
            <li>15-minute glove work with variations</li>
        </ul>
        <p class="emphasis">Consistency matters more than duration.</p>');
        
        -- Slide 9: Module Complete
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 9, 'completion', 'Integration Complete', 
        '<h2>Skills Integrated</h2>
        <p>You have learned to combine all three foundational drills.</p>
        <p>You understand how to apply these skills in daily life and professional work.</p>
        <p>Continue to the final module.</p>');
        
        RAISE NOTICE 'Created 9 slides for Module 4: Integration & Self-Regulation';
    END IF;
END $$;

-- =====================================================
-- MODULE 5: CLOSING AIM & CONTINUED PRACTICE
-- =====================================================

DO $$
DECLARE
    v_module_id UUID;
BEGIN
    SELECT id INTO v_module_id FROM training_modules WHERE module_code = 'systema-scout-closing';
    
    IF v_module_id IS NOT NULL THEN
        -- Slide 1: Introduction
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 1, 'title', 'Closing Aim', 
        '<h1>Module 5</h1><h2>Closing Aim & Continued Practice</h2><p>Understanding the path forward.</p>');
        
        -- Slide 2: The Aim
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 2, 'content', 'The Aim', 
        '<h2>What Systema Scout Builds</h2>
        <p>Systema Scout builds internal regulation, perceptual awareness, and self-accountability before proximity, contact, or force.</p>
        <p class="emphasis">The aim is not to create fighters, controllers, or enforcers.</p>
        <p><strong>The aim is to develop reliable, regulated humans who can operate under pressure while maintaining awareness, empathy, and responsibility.</strong></p>');
        
        -- Slide 3: Not Perfection
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 3, 'content', 'Not Perfection', 
        '<h2>The Goal Is Not Perfection</h2>
        <p class="emphasis">The goal is ongoing regulation, reflection, and responsibility.</p>
        <p>You will have days when:</p>
        <ul>
            <li>Your breath is short and tense</li>
            <li>You miss obvious details in your environment</li>
            <li>Unnecessary tension fills your body</li>
            <li>You react instead of respond</li>
        </ul>
        <p><strong>This is normal. This is human.</strong></p>
        <p>The practice is noticing, not judging.</p>');
        
        -- Slide 4: Continued Practice
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 4, 'content', 'Continued Practice', 
        '<h2>The Path Forward</h2>
        <p>These drills are not one-time exercises. They are ongoing practices.</p>
        <h3>Recommendations:</h3>
        <ul>
            <li>Practice at least 3-4 times per week</li>
            <li>Vary the drills to maintain engagement</li>
            <li>Apply the principles in daily situations</li>
            <li>Return to this course periodically to refresh</li>
            <li>Seek in-person instruction when available</li>
        </ul>
        <p>The skills deepen with time and repetition.</p>');
        
        -- Slide 5: Your Presence
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 5, 'content', 'Your Presence', 
        '<h2>Making Situations Safer</h2>
        <p>With consistent practice, your presence changes.</p>
        <p>People around you will notice:</p>
        <ul>
            <li>You remain calmer under pressure</li>
            <li>You notice more in your environment</li>
            <li>You respond rather than react</li>
            <li>You bring regulation to tense situations</li>
        </ul>
        <p class="emphasis">This is the mark of a Systema Scout practitioner: someone whose presence makes situations safer rather than more volatile.</p>');
        
        -- Slide 6: Course Complete
        INSERT INTO module_slides (module_id, slide_number, slide_type, title, content)
        VALUES (v_module_id, 6, 'completion', 'Systema Scout Complete', 
        '<h2>Congratulations</h2>
        <p>You have completed Systema Scout: Foundational Internal Training.</p>
        <p>You now have the tools for:</p>
        <ul>
            <li>Internal regulation through breath</li>
            <li>Perceptual awareness through observation</li>
            <li>Tension management through constraint</li>
            <li>Self-accountability through empathetic reflection</li>
        </ul>
        <p class="emphasis">The practice continues. The journey has just begun.</p>
        <p><strong>Thank you for your commitment to becoming a regulated, responsible practitioner.</strong></p>');
        
        RAISE NOTICE 'Created 6 slides for Module 5: Closing Aim';
    END IF;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Count slides per module
SELECT 
    tm.module_name,
    COUNT(ms.id) as slide_count
FROM training_modules tm
LEFT JOIN module_slides ms ON tm.id = ms.module_id
WHERE tm.category = 'systema-scout'
GROUP BY tm.module_name, tm.display_order
ORDER BY tm.display_order;
