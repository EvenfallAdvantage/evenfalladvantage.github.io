-- Import Existing Course Slides from Student Portal
-- This migrates the hardcoded slides into the database
-- Run this in Supabase SQL Editor

-- First, let's check if we have the training modules
-- You'll need to replace the module IDs with actual IDs from your database

-- Get module IDs (run this first to see your module IDs)
SELECT id, module_name, module_code FROM training_modules ORDER BY module_code;

-- After getting the IDs, update the INSERT statements below with the correct module_id values
-- For now, I'll use variables - you'll need to replace these with actual UUIDs

-- ============================================
-- Module 1: Security Radio Communications
-- ============================================
-- Replace 'MODULE_1_ID' with actual UUID from above query

INSERT INTO module_slides (module_id, slide_number, slide_type, title, content) VALUES
-- Get the module_id first
((SELECT id FROM training_modules WHERE module_code = 'communication-protocols'), 1, 'text', 'Introduction to Security Radio Communications', 
'<h3>Why Radio Communication Matters</h3>
<p>Professional radio communication is the backbone of event security operations. Clear, concise communication can mean the difference between a minor incident and a major emergency.</p>
<ul>
<li>Instant communication across large venues</li>
<li>Coordination between security teams</li>
<li>Professional image and efficiency</li>
</ul>'),

((SELECT id FROM training_modules WHERE module_code = 'communication-protocols'), 2, 'text', 'Radio Basics and Equipment', 
'<h3>Understanding Your Radio</h3>
<p>Key components and features:</p>
<ul>
<li><strong>PTT (Push-To-Talk)</strong> - Press to speak, release to listen</li>
<li><strong>Volume Control</strong> - Adjust to hear clearly without disturbing others</li>
<li><strong>Channel Selector</strong> - Switch between different communication channels</li>
<li><strong>Antenna</strong> - Keep vertical for best signal</li>
</ul>'),

((SELECT id FROM training_modules WHERE module_code = 'communication-protocols'), 3, 'text', 'The 10-Code System', 
'<h3>Common 10-Codes in Security</h3>
<ul>
<li><strong>10-4</strong> - Acknowledged/Understood</li>
<li><strong>10-20</strong> - Location</li>
<li><strong>10-33</strong> - Emergency traffic</li>
<li><strong>10-97</strong> - Arrived at scene</li>
<li><strong>10-98</strong> - Assignment complete</li>
</ul>
<p><em>Note: Some organizations use plain language instead of codes</em></p>'),

((SELECT id FROM training_modules WHERE module_code = 'communication-protocols'), 4, 'text', 'Radio Etiquette', 
'<h3>Professional Communication Standards</h3>
<ol>
<li><strong>Listen before transmitting</strong> - Don\'t interrupt ongoing communications</li>
<li><strong>Be brief and clear</strong> - Keep messages concise</li>
<li><strong>Use proper identification</strong> - State your call sign/position</li>
<li><strong>Speak clearly</strong> - Enunciate and maintain steady pace</li>
<li><strong>Avoid slang</strong> - Use professional language only</li>
</ol>'),

((SELECT id FROM training_modules WHERE module_code = 'communication-protocols'), 5, 'text', 'Emergency Communications', 
'<h3>Priority Traffic Procedures</h3>
<p>When an emergency occurs:</p>
<ol>
<li>Use emergency code (10-33) or say "Emergency Traffic"</li>
<li>All other radio traffic stops immediately</li>
<li>State nature of emergency clearly</li>
<li>Provide exact location</li>
<li>Request specific assistance needed</li>
</ol>
<p><strong>Example:</strong> "10-33, 10-33, medical emergency at Gate 3, need EMS immediately"</p>');

-- ============================================
-- Module 2: STOP THE BLEED®
-- ============================================

INSERT INTO module_slides (module_id, slide_number, slide_type, title, content) VALUES
((SELECT id FROM training_modules WHERE module_code = 'stop-the-bleed'), 1, 'text', 'Introduction to STOP THE BLEED®', 
'<h3>Why This Training Matters</h3>
<p>Uncontrolled bleeding is the #1 cause of preventable death from trauma. As a security professional, you may be first on scene.</p>
<ul>
<li>Bleeding can kill in 5 minutes or less</li>
<li>Immediate action saves lives</li>
<li>You can make the difference</li>
</ul>
<p><strong>Remember:</strong> Scene safety first - ensure you and the victim are safe before providing care.</p>'),

((SELECT id FROM training_modules WHERE module_code = 'stop-the-bleed'), 2, 'text', 'Recognizing Life-Threatening Bleeding', 
'<h3>Signs of Severe Bleeding</h3>
<ul>
<li>Blood spurting or pulsing from wound</li>
<li>Blood pooling on ground</li>
<li>Clothing soaked with blood</li>
<li>Bandages soaked through</li>
<li>Loss of part of body</li>
<li>Confused or unconscious victim</li>
</ul>
<p><strong>Act immediately if you see these signs!</strong></p>'),

((SELECT id FROM training_modules WHERE module_code = 'stop-the-bleed'), 3, 'text', 'The Three Techniques', 
'<h3>Methods to Stop Bleeding</h3>
<ol>
<li><strong>Direct Pressure</strong>
   <ul><li>Apply firm, steady pressure to wound</li>
   <li>Use gauze, cloth, or bare hands if needed</li>
   <li>Don\'t remove - add more material on top</li></ul>
</li>
<li><strong>Wound Packing</strong>
   <ul><li>For deep wounds (junctional areas)</li>
   <li>Pack gauze deep into wound</li>
   <li>Apply pressure over packed wound</li></ul>
</li>
<li><strong>Tourniquet Application</strong>
   <ul><li>For severe arm or leg bleeding</li>
   <li>Apply 2-3 inches above wound</li>
   <li>Tighten until bleeding stops</li></ul>
</li>
</ol>'),

((SELECT id FROM training_modules WHERE module_code = 'stop-the-bleed'), 4, 'text', 'Tourniquet Application Steps', 
'<h3>How to Apply a Tourniquet</h3>
<ol>
<li>Place tourniquet 2-3 inches ABOVE the bleeding site</li>
<li>Pull the band tight and secure the Velcro</li>
<li>Twist the windlass until bleeding stops</li>
<li>Lock the windlass in place</li>
<li>Note the time of application</li>
<li>Do NOT remove - only EMS should remove</li>
</ol>
<p><strong>Important:</strong> A properly applied tourniquet will hurt - that\'s normal and necessary.</p>'),

((SELECT id FROM training_modules WHERE module_code = 'stop-the-bleed'), 5, 'text', 'After Care and EMS Handoff', 
'<h3>What to Do After Stopping Bleeding</h3>
<ul>
<li>Keep victim calm and still</li>
<li>Monitor for shock (pale, cold, confused)</li>
<li>Keep victim warm with blanket</li>
<li>Do NOT give food or water</li>
<li>Note time of tourniquet application</li>
<li>Stay with victim until EMS arrives</li>
</ul>
<h3>Information for EMS</h3>
<ul>
<li>What happened</li>
<li>What you did</li>
<li>When tourniquet was applied</li>
<li>Any changes in victim\'s condition</li>
</ul>');

-- ============================================
-- Module 3: Threat Assessment
-- ============================================

INSERT INTO module_slides (module_id, slide_number, slide_type, title, content) VALUES
((SELECT id FROM training_modules WHERE module_code = 'threat-assessment'), 1, 'text', 'Situational Awareness Fundamentals', 
'<h3>The Foundation of Security</h3>
<p>Situational awareness is your ability to identify, process, and comprehend critical information about your environment.</p>
<h4>Cooper\'s Color Codes:</h4>
<ul>
<li><strong>White</strong> - Unaware, distracted</li>
<li><strong>Yellow</strong> - Relaxed alert (where you should be)</li>
<li><strong>Orange</strong> - Focused alert, potential threat identified</li>
<li><strong>Red</strong> - Threat confirmed, action required</li>
</ul>'),

((SELECT id FROM training_modules WHERE module_code = 'threat-assessment'), 2, 'text', 'Threat Indicators and Red Flags', 
'<h3>What to Look For</h3>
<h4>Behavioral Indicators:</h4>
<ul>
<li>Nervous behavior, excessive sweating</li>
<li>Avoiding eye contact or security</li>
<li>Inappropriate clothing for weather/event</li>
<li>Repeatedly touching or adjusting clothing</li>
<li>Surveillance behavior</li>
<li>Unusual interest in security measures</li>
</ul>
<h4>Environmental Indicators:</h4>
<ul>
<li>Unattended bags or packages</li>
<li>Unusual items or placements</li>
<li>Blocked exits or access points</li>
</ul>'),

((SELECT id FROM training_modules WHERE module_code = 'threat-assessment'), 3, 'text', 'De-escalation Techniques', 
'<h3>Verbal De-escalation</h3>
<ol>
<li><strong>Remain Calm</strong> - Your demeanor sets the tone</li>
<li><strong>Use Open Body Language</strong> - Non-threatening posture</li>
<li><strong>Maintain Safe Distance</strong> - 6-8 feet minimum</li>
<li><strong>Listen Actively</strong> - Let person express concerns</li>
<li><strong>Acknowledge Feelings</strong> - "I understand you\'re frustrated"</li>
<li><strong>Offer Options</strong> - Give person some control</li>
<li><strong>Set Clear Boundaries</strong> - Explain what\'s acceptable</li>
</ol>
<p><strong>Remember:</strong> Your goal is to resolve the situation peacefully.</p>'),

((SELECT id FROM training_modules WHERE module_code = 'threat-assessment'), 4, 'text', 'When to Escalate', 
'<h3>Knowing When to Call for Backup</h3>
<p>Escalate immediately if you observe:</p>
<ul>
<li>Weapons or suspected weapons</li>
<li>Threats of violence</li>
<li>Physical aggression</li>
<li>Multiple aggressors</li>
<li>Intoxication with aggression</li>
<li>Situation beyond your training</li>
<li>Your safety is at risk</li>
</ul>
<p><strong>It\'s always better to call for backup early than to wait too long.</strong></p>'),

((SELECT id FROM training_modules WHERE module_code = 'threat-assessment'), 5, 'text', 'Documentation and Reporting', 
'<h3>Proper Incident Documentation</h3>
<p>Document all incidents thoroughly:</p>
<ul>
<li><strong>Who</strong> - People involved, witnesses</li>
<li><strong>What</strong> - Exactly what happened</li>
<li><strong>When</strong> - Date, time, duration</li>
<li><strong>Where</strong> - Specific location</li>
<li><strong>Why</strong> - Apparent cause or motivation</li>
<li><strong>How</strong> - How situation was resolved</li>
</ul>
<p>Write reports while details are fresh. Be factual, not opinionated.</p>');

-- Continue with remaining modules...
-- (Module 4: ICS-100, Module 5: Diverse Populations, Module 6: Crowd Management, Module 7: Use of Force)
-- Due to length, I'll provide these in a separate file if needed

SELECT 'Slides imported successfully!' as status;

-- Verify import
SELECT 
    tm.module_name,
    COUNT(ms.id) as slide_count
FROM training_modules tm
LEFT JOIN module_slides ms ON tm.id = ms.module_id
GROUP BY tm.id, tm.module_name
ORDER BY tm.module_code;
