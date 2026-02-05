-- =====================================================
-- MODULES 6-8: OPSEC, Documentation, Response Strategies
-- =====================================================

-- =====================================================
-- MODULE 6: OPSEC & Personal Security
-- =====================================================

INSERT INTO training_modules (
    module_code,
    module_name,
    description,
    content,
    icon,
    estimated_duration_minutes,
    display_order,
    is_required,
    default_course_id
) VALUES (
    'opsec-personal-security',
    'OPSEC & Personal Security',
    'Learn operational security principles, routine analysis, pattern breaking, and creating effective security protocols.',
    '<h2>OPSEC & Personal Security</h2>

<h3>Learning Objectives</h3>
<ul>
    <li>Understand OPSEC fundamentals and the 5-step process</li>
    <li>Analyze and break predictable patterns</li>
    <li>Implement social media security best practices</li>
    <li>Develop personal security protocols</li>
    <li>Practice information compartmentalization</li>
</ul>

<h3>What is OPSEC?</h3>
<p>Operations Security (OPSEC) is a process that identifies critical information and analyzes friendly actions to prevent adversaries from detecting information that could be used against you. Originally developed by the military, OPSEC principles apply equally to personal security.</p>

<h3>The 5-Step OPSEC Process</h3>

<h4>Step 1: Identify Critical Information</h4>
<p>What information, if obtained by adversaries, could harm you?</p>
<ul>
    <li>Home address and layout</li>
    <li>Daily routines and schedules</li>
    <li>Travel plans</li>
    <li>Family member information</li>
    <li>Workplace details</li>
    <li>Security measures in place</li>
    <li>Vulnerabilities and weaknesses</li>
</ul>

<h4>Step 2: Analyze Threats</h4>
<p>Who might want this information and why?</p>
<ul>
    <li>Former partners</li>
    <li>Criminals</li>
    <li>Competitors</li>
    <li>Stalkers</li>
    <li>Identity thieves</li>
</ul>

<h4>Step 3: Analyze Vulnerabilities</h4>
<p>How could adversaries obtain critical information?</p>
<ul>
    <li>Social media posts</li>
    <li>Predictable routines</li>
    <li>Public records</li>
    <li>Unsecured communications</li>
    <li>Loose talk</li>
    <li>Visible patterns</li>
</ul>

<h4>Step 4: Assess Risk</h4>
<p>What is the likelihood and impact of information compromise?</p>
<ul>
    <li>High risk: Immediate safety threat</li>
    <li>Medium risk: Potential for harm</li>
    <li>Low risk: Minimal impact</li>
</ul>

<h4>Step 5: Apply Countermeasures</h4>
<p>Implement measures to protect critical information:</p>
<ul>
    <li>Limit information sharing</li>
    <li>Vary routines</li>
    <li>Enhance physical security</li>
    <li>Improve digital hygiene</li>
    <li>Train family members</li>
</ul>

<h3>Routine Analysis and Pattern Breaking</h3>

<h4>Common Predictable Patterns:</h4>
<ul>
    <li>Same route to work daily</li>
    <li>Regular gym/shopping times</li>
    <li>Predictable lunch locations</li>
    <li>Consistent social activities</li>
    <li>Fixed travel schedules</li>
</ul>

<h4>Pattern Breaking Techniques:</h4>
<ul>
    <li>Vary departure times by 15-30 minutes</li>
    <li>Use different routes (maintain 3-4 alternatives)</li>
    <li>Change parking locations</li>
    <li>Alternate service providers</li>
    <li>Randomize routine activities</li>
    <li>Avoid announcing plans publicly</li>
</ul>

<h3>Social Media Best Practices</h3>

<h4>What NOT to Post:</h4>
<ul>
    <li>Real-time location updates</li>
    <li>Vacation plans (before or during)</li>
    <li>Photos showing home address</li>
    <li>Vehicle license plates</li>
    <li>Children''s school information</li>
    <li>Daily routines</li>
    <li>Security system details</li>
    <li>Expensive purchases</li>
</ul>

<h4>Safe Posting Guidelines:</h4>
<ul>
    <li>Post about events AFTER they occur</li>
    <li>Disable location tagging</li>
    <li>Review photos for identifying details</li>
    <li>Limit audience to trusted connections</li>
    <li>Use privacy settings effectively</li>
    <li>Think before you share</li>
</ul>

<h3>Travel Security Awareness</h3>

<h4>Before Travel:</h4>
<ul>
    <li>Don''t announce travel plans publicly</li>
    <li>Arrange mail/package hold</li>
    <li>Set timers for lights</li>
    <li>Inform trusted neighbors only</li>
    <li>Secure valuables</li>
</ul>

<h4>During Travel:</h4>
<ul>
    <li>Vary hotel arrival/departure times</li>
    <li>Use different entrances/exits</li>
    <li>Don''t advertise room number</li>
    <li>Be aware of surveillance in hotels</li>
    <li>Secure devices and documents</li>
</ul>

<h3>Home and Vehicle Security</h3>

<h4>Home Security Measures:</h4>
<ul>
    <li>Quality locks on all entry points</li>
    <li>Security system with monitoring</li>
    <li>Exterior lighting</li>
    <li>Trim bushes near windows</li>
    <li>Reinforce door frames</li>
    <li>Window security film</li>
    <li>Safe room considerations</li>
</ul>

<h4>Vehicle Security:</h4>
<ul>
    <li>Park in well-lit areas</li>
    <li>Check for tracking devices regularly</li>
    <li>Vary parking locations</li>
    <li>Keep valuables out of sight</li>
    <li>Maintain situational awareness</li>
    <li>Have emergency supplies</li>
</ul>

<h3>Information Compartmentalization</h3>
<p>The principle of "need to know" - limit information sharing based on necessity.</p>

<h4>Compartmentalization Strategies:</h4>
<ul>
    <li>Use different email addresses for different purposes</li>
    <li>Separate work and personal communications</li>
    <li>Limit who knows your full schedule</li>
    <li>Don''t share all details with everyone</li>
    <li>Use code words for sensitive information</li>
    <li>Maintain operational security in conversations</li>
</ul>

<h3>Creating Personal Security Protocols</h3>

<h4>Daily Security Checklist:</h4>
<ul>
    <li>Morning: Check for signs of tampering</li>
    <li>Vary routine: Different route/timing</li>
    <li>Maintain awareness: Yellow alert baseline</li>
    <li>Evening: Secure home perimeter</li>
    <li>Night: Verify locks, set alarms</li>
</ul>

<h4>Communication Security:</h4>
<ul>
    <li>Use encrypted messaging for sensitive topics</li>
    <li>Verify identity before sharing information</li>
    <li>Be cautious on phone calls in public</li>
    <li>Use secure networks only</li>
    <li>Avoid discussing security measures publicly</li>
</ul>

<h3>Family Security Training</h3>
<p>Everyone in household should understand:</p>
<ul>
    <li>What information not to share</li>
    <li>How to recognize suspicious behavior</li>
    <li>Emergency procedures</li>
    <li>Code words for danger</li>
    <li>Safe people to contact</li>
</ul>

<div class="key-takeaway">
    <h4>Key Takeaway</h4>
    <p>OPSEC is not about paranoia - it''s about being smart with information. By identifying what''s critical, understanding threats, and implementing practical countermeasures, you significantly reduce your vulnerability to surveillance and stalking. The key is consistency: security protocols only work if practiced regularly. Make OPSEC a habit, not an afterthought.</p>
</div>',
    'fa-shield-alt',
    90,
    6,
    true,
    (SELECT id FROM courses WHERE course_code = 'surveillance-detection')
);

-- =====================================================
-- MODULE 7: Documentation, Reporting & Legal Considerations
-- =====================================================

INSERT INTO training_modules (
    module_code,
    module_name,
    description,
    content,
    icon,
    estimated_duration_minutes,
    display_order,
    is_required,
    default_course_id
) VALUES (
    'documentation-reporting',
    'Documentation, Reporting & Legal Considerations',
    'Learn proper evidence collection, documentation procedures, legal reporting, and working with law enforcement.',
    '<h2>Documentation, Reporting & Legal Considerations</h2>

<h3>Learning Objectives</h3>
<ul>
    <li>Understand proper evidence collection and preservation</li>
    <li>Maintain effective documentation logs</li>
    <li>Know how to report to law enforcement</li>
    <li>Understand legal protections available</li>
    <li>Work effectively with prosecutors and victim services</li>
</ul>

<h3>Why Documentation Matters</h3>
<p>Stalking and surveillance cases require establishing a "course of conduct" - a pattern of behavior over time. Detailed documentation is critical for:</p>
<ul>
    <li>Proving the pattern to law enforcement</li>
    <li>Obtaining restraining orders</li>
    <li>Supporting criminal prosecution</li>
    <li>Civil litigation</li>
    <li>Demonstrating reasonable fear</li>
</ul>

<h3>Evidence Collection and Preservation</h3>

<h4>Types of Evidence:</h4>
<ul>
    <li><strong>Physical Evidence:</strong> Letters, gifts, objects left behind</li>
    <li><strong>Digital Evidence:</strong> Emails, texts, social media messages</li>
    <li><strong>Photographic Evidence:</strong> Photos of stalker, vehicle, damage</li>
    <li><strong>Video Evidence:</strong> Security footage, recordings</li>
    <li><strong>Audio Evidence:</strong> Voicemails, recorded threats</li>
    <li><strong>Documentary Evidence:</strong> Police reports, medical records</li>
</ul>

<h4>Evidence Collection Best Practices:</h4>
<ul>
    <li>Don''t delete messages or emails</li>
    <li>Take screenshots with dates/times visible</li>
    <li>Save original files, make copies for working</li>
    <li>Photograph physical evidence with ruler for scale</li>
    <li>Note date, time, location for all incidents</li>
    <li>Preserve chain of custody</li>
    <li>Store evidence securely</li>
</ul>

<h4>Digital Evidence Preservation:</h4>
<ul>
    <li>Screenshot entire conversations, not just parts</li>
    <li>Include headers showing sender information</li>
    <li>Save to multiple locations (cloud, external drive)</li>
    <li>Don''t edit or alter evidence</li>
    <li>Preserve metadata when possible</li>
    <li>Document how evidence was obtained</li>
</ul>

<h3>Documentation Logs</h3>

<h4>What to Document:</h4>
<ul>
    <li>Date and time of each incident</li>
    <li>Location where incident occurred</li>
    <li>Detailed description of what happened</li>
    <li>What was said (exact quotes when possible)</li>
    <li>Names of witnesses</li>
    <li>Your response/actions taken</li>
    <li>Emotional/physical impact</li>
    <li>Photos or evidence collected</li>
    <li>Police report numbers if filed</li>
</ul>

<h4>Documentation Log Template:</h4>
<pre>
Date: _______________  Time: _______________
Location: _________________________________
Incident Description:
_________________________________________
_________________________________________
What was said/done:
_________________________________________
_________________________________________
Witnesses: ________________________________
Evidence collected: ________________________
Police contacted: Yes / No  Report #: ______
My response: ______________________________
Impact: ___________________________________
</pre>

<h3>Photography and Video Evidence</h3>

<h4>Best Practices:</h4>
<ul>
    <li>Use timestamp feature if available</li>
    <li>Take multiple angles</li>
    <li>Include context (surrounding area)</li>
    <li>Photograph damage, vehicles, people</li>
    <li>Don''t confront while photographing</li>
    <li>Maintain safe distance</li>
    <li>Note camera settings and conditions</li>
</ul>

<h4>Video Recording Considerations:</h4>
<ul>
    <li>Know your state''s recording laws</li>
    <li>One-party consent vs. two-party consent</li>
    <li>Public vs. private spaces</li>
    <li>Expectation of privacy</li>
    <li>Admissibility in court</li>
</ul>

<h3>Witness Statements</h3>

<h4>Obtaining Witness Information:</h4>
<ul>
    <li>Get full name and contact information</li>
    <li>Ask what they observed</li>
    <li>Request written statement if willing</li>
    <li>Note their relationship to you</li>
    <li>Document when/where they witnessed incident</li>
</ul>

<h3>Reporting to Law Enforcement</h3>

<h4>When to Report:</h4>
<ul>
    <li>Immediately for threats or violence</li>
    <li>After establishing pattern (2+ incidents)</li>
    <li>When fear for safety is reasonable</li>
    <li>When restraining order is needed</li>
    <li>When evidence is collected</li>
</ul>

<h4>How to Report Effectively:</h4>
<ul>
    <li>Bring documentation log</li>
    <li>Provide all evidence</li>
    <li>Be specific and factual</li>
    <li>Explain the pattern of behavior</li>
    <li>Describe impact on your life</li>
    <li>Request report number</li>
    <li>Ask about next steps</li>
    <li>Follow up regularly</li>
</ul>

<h4>What to Expect:</h4>
<ul>
    <li>Officer will take statement</li>
    <li>Evidence will be collected</li>
    <li>Report will be filed</li>
    <li>Investigation may be opened</li>
    <li>Detective may be assigned</li>
    <li>You may need to provide additional information</li>
</ul>

<h3>Restraining Orders and Legal Protections</h3>

<h4>Types of Orders:</h4>
<ul>
    <li><strong>Emergency Protective Order:</strong> Immediate, short-term</li>
    <li><strong>Temporary Restraining Order:</strong> Pending hearing</li>
    <li><strong>Permanent Restraining Order:</strong> After hearing, long-term</li>
    <li><strong>Criminal Protective Order:</strong> Part of criminal case</li>
</ul>

<h4>What Orders Can Require:</h4>
<ul>
    <li>No contact (direct or indirect)</li>
    <li>Stay-away distance (typically 100-500 yards)</li>
    <li>No harassment or surveillance</li>
    <li>Surrender firearms</li>
    <li>Move out of shared residence</li>
</ul>

<h4>Obtaining a Restraining Order:</h4>
<ol>
    <li>File petition with court</li>
    <li>Provide evidence of harassment/stalking</li>
    <li>Attend hearing</li>
    <li>Testify about incidents</li>
    <li>Present evidence and witnesses</li>
    <li>Receive order if granted</li>
    <li>Ensure proper service on respondent</li>
</ol>

<h3>Working with Prosecutors</h3>

<h4>Your Role:</h4>
<ul>
    <li>Provide complete documentation</li>
    <li>Be available for interviews</li>
    <li>Testify if case goes to trial</li>
    <li>Inform prosecutor of new incidents</li>
    <li>Attend court proceedings</li>
</ul>

<h4>What Prosecutors Need:</h4>
<ul>
    <li>Clear pattern of behavior</li>
    <li>Credible evidence</li>
    <li>Witness testimony</li>
    <li>Demonstration of fear</li>
    <li>Proof of unwanted contact</li>
</ul>

<h3>Victim Support Resources</h3>

<h4>Organizations That Can Help:</h4>
<ul>
    <li>National Domestic Violence Hotline: 1-800-799-7233</li>
    <li>Stalking Resource Center</li>
    <li>Local victim advocacy programs</li>
    <li>Legal aid societies</li>
    <li>Counseling services</li>
    <li>Safety planning assistance</li>
</ul>

<h4>Victim Advocates Can:</h4>
<ul>
    <li>Explain legal process</li>
    <li>Accompany you to court</li>
    <li>Help with safety planning</li>
    <li>Connect you with resources</li>
    <li>Provide emotional support</li>
    <li>Assist with documentation</li>
</ul>

<div class="key-takeaway">
    <h4>Key Takeaway</h4>
    <p>Documentation is your most powerful tool in stalking and surveillance cases. Detailed, consistent records establish the pattern of behavior required for legal action. Start documenting from the first incident, preserve all evidence, and don''t hesitate to report to law enforcement. Remember: you are not alone - victim advocates and support services are available to help you through the process.</p>
</div>',
    'fa-file-alt',
    90,
    7,
    true,
    (SELECT id FROM courses WHERE course_code = 'surveillance-detection')
);

-- =====================================================
-- MODULE 8: Response Strategies & Safety Planning
-- =====================================================

INSERT INTO training_modules (
    module_code,
    module_name,
    description,
    content,
    icon,
    estimated_duration_minutes,
    display_order,
    is_required,
    default_course_id
) VALUES (
    'response-safety-planning',
    'Response Strategies & Safety Planning',
    'Develop comprehensive response strategies, emergency action plans, and long-term safety protocols.',
    '<h2>Response Strategies & Safety Planning</h2>

<h3>Learning Objectives</h3>
<ul>
    <li>Develop immediate response strategies to surveillance detection</li>
    <li>Create comprehensive emergency action plans</li>
    <li>Establish safe rooms and escape routes</li>
    <li>Implement effective communication protocols</li>
    <li>Build long-term safety plans</li>
</ul>

<h3>Immediate Response to Surveillance Detection</h3>

<h4>If You Detect Surveillance:</h4>
<ol>
    <li><strong>Don''t Panic:</strong> Maintain composure</li>
    <li><strong>Don''t Confront:</strong> Never approach suspected surveillance</li>
    <li><strong>Document:</strong> Note details (description, vehicle, location)</li>
    <li><strong>Change Plans:</strong> Don''t proceed to sensitive locations</li>
    <li><strong>Seek Safety:</strong> Go to public, well-lit areas</li>
    <li><strong>Call for Help:</strong> Contact law enforcement if threatened</li>
    <li><strong>Inform Others:</strong> Alert security team or trusted contacts</li>
</ol>

<h4>Evasion Techniques:</h4>
<ul>
    <li>Enter crowded public spaces</li>
    <li>Use multiple entrances/exits</li>
    <li>Change transportation methods</li>
    <li>Seek assistance from security personnel</li>
    <li>Don''t go home if being followed</li>
    <li>Drive to police station if in vehicle</li>
</ul>

<h3>De-escalation When Confronted</h3>

<h4>Verbal De-escalation Techniques:</h4>
<ul>
    <li>Remain calm and composed</li>
    <li>Use non-threatening body language</li>
    <li>Maintain appropriate distance</li>
    <li>Speak in calm, even tone</li>
    <li>Acknowledge their feelings without agreeing</li>
    <li>Set clear boundaries</li>
    <li>Look for escape opportunities</li>
</ul>

<h4>What to Say:</h4>
<ul>
    <li>"I understand you''re upset, but I need you to step back"</li>
    <li>"I''m not comfortable with this conversation"</li>
    <li>"I''m going to leave now"</li>
    <li>"Please don''t contact me again"</li>
    <li>"I will call the police if you don''t leave"</li>
</ul>

<h4>What NOT to Do:</h4>
<ul>
    <li>Don''t escalate with threats</li>
    <li>Don''t engage in arguments</li>
    <li>Don''t show fear (if possible)</li>
    <li>Don''t turn your back</li>
    <li>Don''t allow yourself to be cornered</li>
</ul>

<h3>Emergency Action Plans</h3>

<h4>Components of an Effective Plan:</h4>
<ul>
    <li>Immediate threat response</li>
    <li>Evacuation procedures</li>
    <li>Communication protocols</li>
    <li>Rally points</li>
    <li>Emergency contacts</li>
    <li>Go-bag preparation</li>
    <li>Safe locations identified</li>
</ul>

<h4>Code Words and Signals:</h4>
<ul>
    <li>Danger code word (alerts family to threat)</li>
    <li>All-clear signal</li>
    <li>Duress code (indicates forced communication)</li>
    <li>Location codes for meeting points</li>
</ul>

<h3>Safe Rooms and Escape Routes</h3>

<h4>Safe Room Essentials:</h4>
<ul>
    <li>Solid core door with deadbolt</li>
    <li>Cell phone or landline</li>
    <li>Emergency supplies (water, first aid)</li>
    <li>Flashlight and batteries</li>
    <li>List of emergency contacts</li>
    <li>Weapon for self-defense (if trained)</li>
    <li>Door wedge or barricade</li>
</ul>

<h4>Escape Route Planning:</h4>
<ul>
    <li>Identify primary and secondary exits</li>
    <li>Practice evacuation regularly</li>
    <li>Keep exits clear of obstacles</li>
    <li>Have keys readily accessible</li>
    <li>Know neighbors who can help</li>
    <li>Establish rally points outside home</li>
</ul>

<h3>Communication Protocols</h3>

<h4>Emergency Contact List:</h4>
<ul>
    <li>911 / Local police</li>
    <li>Trusted family members</li>
    <li>Close friends</li>
    <li>Neighbors</li>
    <li>Workplace security</li>
    <li>Victim advocate</li>
    <li>Attorney (if applicable)</li>
</ul>

<h4>Communication Security:</h4>
<ul>
    <li>Use encrypted messaging apps</li>
    <li>Establish check-in times</li>
    <li>Share location with trusted contacts</li>
    <li>Have backup communication methods</li>
    <li>Use code words for sensitive information</li>
</ul>

<h3>Working with Security Professionals</h3>

<h4>When to Hire Professional Security:</h4>
<ul>
    <li>High-threat situations</li>
    <li>After violent incidents</li>
    <li>When restraining orders are violated</li>
    <li>For high-profile individuals</li>
    <li>During court proceedings</li>
</ul>

<h4>Services Security Professionals Provide:</h4>
<ul>
    <li>Threat assessment</li>
    <li>Residential security surveys</li>
    <li>Executive protection</li>
    <li>TSCM sweeps</li>
    <li>Security system installation</li>
    <li>Training and consultation</li>
</ul>

<h3>Long-Term Safety Planning</h3>

<h4>Ongoing Security Measures:</h4>
<ul>
    <li>Regular security audits</li>
    <li>Maintain documentation</li>
    <li>Update emergency plans</li>
    <li>Continue pattern variation</li>
    <li>Stay connected with support network</li>
    <li>Monitor for new threats</li>
</ul>

<h4>Lifestyle Modifications:</h4>
<ul>
    <li>Consider relocation if necessary</li>
    <li>Change phone numbers</li>
    <li>Use mail forwarding services</li>
    <li>Adjust work arrangements</li>
    <li>Modify social activities</li>
    <li>Update legal documents</li>
</ul>

<h3>Supporting Stalking Victims</h3>

<h4>If Someone Confides in You:</h4>
<ul>
    <li>Believe them</li>
    <li>Listen without judgment</li>
    <li>Don''t minimize their experience</li>
    <li>Offer practical support</li>
    <li>Help with documentation</li>
    <li>Connect them with resources</li>
    <li>Respect their decisions</li>
    <li>Maintain confidentiality</li>
</ul>

<h4>How to Help:</h4>
<ul>
    <li>Accompany to police/court</li>
    <li>Provide safe place to stay</li>
    <li>Help with safety planning</li>
    <li>Be available for check-ins</li>
    <li>Assist with practical tasks</li>
    <li>Validate their feelings</li>
</ul>

<h3>Self-Care and Mental Health</h3>

<h4>Impact of Stalking:</h4>
<ul>
    <li>Anxiety and hypervigilance</li>
    <li>Depression</li>
    <li>PTSD symptoms</li>
    <li>Sleep disturbances</li>
    <li>Social isolation</li>
</ul>

<h4>Coping Strategies:</h4>
<ul>
    <li>Seek professional counseling</li>
    <li>Join support groups</li>
    <li>Maintain social connections</li>
    <li>Practice stress management</li>
    <li>Exercise and healthy habits</li>
    <li>Set boundaries</li>
    <li>Focus on what you can control</li>
</ul>

<h3>Recovery and Moving Forward</h3>

<h4>Steps Toward Recovery:</h4>
<ul>
    <li>Acknowledge the trauma</li>
    <li>Seek professional help</li>
    <li>Rebuild sense of safety</li>
    <li>Reconnect with support network</li>
    <li>Gradually resume normal activities</li>
    <li>Practice self-compassion</li>
    <li>Consider advocacy or helping others</li>
</ul>

<div class="key-takeaway">
    <h4>Key Takeaway</h4>
    <p>Effective response to surveillance and stalking requires both immediate tactical responses and long-term strategic planning. Your safety is the priority - never hesitate to seek help, change plans, or take protective action. Remember that recovery is possible, and you don''t have to face this alone. Build your support network, implement security measures, and take it one day at a time. You have the right to live free from fear and harassment.</p>
</div>',
    'fa-life-ring',
    90,
    8,
    true,
    (SELECT id FROM courses WHERE course_code = 'surveillance-detection')
);

-- Link all modules to the course
INSERT INTO course_modules (course_id, module_id, module_order)
SELECT 
    c.id,
    m.id,
    m.display_order
FROM courses c
CROSS JOIN training_modules m
WHERE c.course_code = 'surveillance-detection'
AND m.module_code IN (
    'surveillance-intro',
    'pre-attack-indicators',
    'physical-surveillance',
    'technical-surveillance',
    'cyber-stalking',
    'opsec-personal-security',
    'documentation-reporting',
    'response-safety-planning'
);
