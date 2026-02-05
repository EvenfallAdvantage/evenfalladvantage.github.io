-- =====================================================
-- ADVANCED SURVEILLANCE & STALKING RECOGNITION COURSE
-- =====================================================
-- A comprehensive course on recognizing and responding to
-- surveillance and stalking behaviors for security professionals
-- and civilians
-- =====================================================

-- Create the course
INSERT INTO courses (
    course_name,
    course_code,
    description,
    short_description,
    duration_hours,
    difficulty_level,
    icon,
    is_active,
    display_order
) VALUES (
    'Advanced Surveillance & Stalking Recognition',
    'surveillance-detection',
    'Master the art of detecting physical surveillance, technical monitoring, and stalking behaviors. This comprehensive course covers surveillance detection routes (SDRs), pre-attack indicators, cyber stalking, OPSEC principles, and legal reporting procedures. Designed for both security professionals and civilians concerned about personal safety.',
    'Comprehensive training on recognizing and responding to surveillance and stalking behaviors',
    14,
    'Intermediate',
    'fa-eye',
    true,
    3
);

-- =====================================================
-- MODULE 1: Introduction to Surveillance & Stalking
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
    'surveillance-intro',
    'Introduction to Surveillance & Stalking',
    'Understanding the fundamentals of surveillance and stalking, including definitions, legal frameworks, and real-world impact.',
    '<h2>Introduction to Surveillance & Stalking</h2>

<h3>Learning Objectives</h3>
<ul>
    <li>Understand the legal definitions of surveillance and stalking</li>
    <li>Distinguish between different types of surveillance</li>
    <li>Recognize the impact of stalking on victims and society</li>
    <li>Understand why this training matters for both professionals and civilians</li>
</ul>

<h3>What is Surveillance?</h3>
<p>Surveillance is the systematic observation of people, places, or activities for the purpose of gathering information. While surveillance can be conducted for legitimate purposes (law enforcement, security), it can also be used with malicious intent.</p>

<h4>Types of Surveillance:</h4>
<ul>
    <li><strong>Physical Surveillance:</strong> Direct observation using human operatives, either on foot or in vehicles</li>
    <li><strong>Technical Surveillance:</strong> Use of electronic devices such as cameras, GPS trackers, or listening devices</li>
    <li><strong>Cyber Surveillance:</strong> Monitoring digital activities, social media, emails, and online behavior</li>
</ul>

<h3>What is Stalking?</h3>
<p>Stalking is a pattern of repeated, unwanted attention and contact that causes fear or concern for safety. According to the U.S. Department of Justice, stalking is defined as "a course of conduct directed at a specific person that would cause a reasonable person to feel fear."</p>

<h4>Key Elements of Stalking:</h4>
<ul>
    <li><strong>Pattern of Behavior:</strong> Two or more incidents (varies by jurisdiction)</li>
    <li><strong>Unwanted Contact:</strong> The victim has not consented to the attention</li>
    <li><strong>Reasonable Fear:</strong> The behavior causes fear for safety or substantial emotional distress</li>
    <li><strong>Intent:</strong> The perpetrator knows or should know their behavior is unwanted</li>
</ul>

<h3>Surveillance vs. Stalking</h3>
<p>While related, surveillance and stalking have important distinctions:</p>

<table>
    <tr>
        <th>Surveillance</th>
        <th>Stalking</th>
    </tr>
    <tr>
        <td>May be legal (with proper authorization)</td>
        <td>Always illegal when it meets statutory requirements</td>
    </tr>
    <tr>
        <td>Typically covert and professional</td>
        <td>May be overt or covert, often escalates</td>
    </tr>
    <tr>
        <td>Information gathering purpose</td>
        <td>Harassment, intimidation, or control purpose</td>
    </tr>
    <tr>
        <td>Conducted by trained operatives</td>
        <td>Conducted by individuals with personal motives</td>
    </tr>
</table>

<h3>Statistics and Real-World Impact</h3>
<ul>
    <li>1 in 6 women and 1 in 17 men have experienced stalking in their lifetime (CDC)</li>
    <li>Over 7.5 million people are stalked annually in the United States</li>
    <li>76% of femicide victims were stalked prior to being killed</li>
    <li>85% of stalking victims know their stalker</li>
    <li>Technology-facilitated stalking has increased 400% in recent years</li>
</ul>

<h3>Why This Training Matters</h3>

<h4>For Security Professionals:</h4>
<ul>
    <li>Protect high-value clients from hostile surveillance</li>
    <li>Detect pre-attack indicators before incidents occur</li>
    <li>Implement effective counter-surveillance measures</li>
    <li>Advise clients on personal security protocols</li>
</ul>

<h4>For Civilians:</h4>
<ul>
    <li>Recognize when you''re being followed or monitored</li>
    <li>Protect yourself and loved ones from stalking</li>
    <li>Understand your legal rights and reporting options</li>
    <li>Implement practical safety measures in daily life</li>
</ul>

<h3>Legal Framework</h3>
<p>All 50 U.S. states, the District of Columbia, and U.S. territories have anti-stalking laws. However, definitions and penalties vary by jurisdiction.</p>

<h4>Federal Stalking Laws:</h4>
<ul>
    <li><strong>18 U.S.C. § 2261A:</strong> Interstate stalking</li>
    <li><strong>18 U.S.C. § 875(c):</strong> Interstate communications containing threats</li>
    <li><strong>47 U.S.C. § 223:</strong> Harassing telephone calls</li>
</ul>

<h3>Course Overview</h3>
<p>This comprehensive course will cover:</p>
<ol>
    <li>Pre-attack indicators and behavioral analysis</li>
    <li>Physical surveillance detection techniques</li>
    <li>Technical surveillance recognition</li>
    <li>Cyber stalking and digital surveillance</li>
    <li>Operational security (OPSEC) principles</li>
    <li>Documentation and legal reporting</li>
    <li>Response strategies and safety planning</li>
</ol>

<div class="key-takeaway">
    <h4>Key Takeaway</h4>
    <p>Surveillance and stalking are serious threats that can affect anyone. Understanding the fundamentals of recognition and response is the first step in protecting yourself and others. This course provides practical, evidence-based training that bridges the gap between professional security practices and civilian personal safety.</p>
</div>',
    'fa-info-circle',
    45,
    1,
    true,
    (SELECT id FROM courses WHERE course_code = ''surveillance-detection'')
);

-- Assessment for Module 1
INSERT INTO assessments (
    module_id,
    assessment_name,
    description,
    passing_score,
    time_limit,
    question_count
) VALUES (
    (SELECT id FROM training_modules WHERE module_code = ''surveillance-intro''),
    'Introduction to Surveillance & Stalking Assessment',
    'Test your understanding of surveillance and stalking fundamentals',
    80,
    30,
    20
);

-- Questions for Module 1 Assessment
INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'Which of the following is NOT a type of surveillance covered in this course?', ''multiple_choice'', 1, 1);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''Which of the following is NOT a type%''), ''Physical surveillance'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''Which of the following is NOT a type%''), ''Technical surveillance'', false, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''Which of the following is NOT a type%''), ''Cyber surveillance'', false, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''Which of the following is NOT a type%''), ''Psychic surveillance'', true, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'According to the legal definition, stalking requires how many incidents to establish a "course of conduct"?', ''multiple_choice'', 1, 2);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%course of conduct%''), ''One incident is sufficient'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%course of conduct%''), ''Two or more incidents'', true, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%course of conduct%''), ''Five or more incidents'', false, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%course of conduct%''), ''Ten or more incidents'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'What percentage of stalking victims know their stalker?', ''multiple_choice'', 1, 3);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%victims know their stalker%''), ''25%'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%victims know their stalker%''), ''50%'', false, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%victims know their stalker%''), ''85%'', true, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%victims know their stalker%''), ''95%'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'Which federal law addresses interstate stalking?', ''multiple_choice'', 1, 4);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%federal law addresses interstate%''), ''18 U.S.C. § 2261A'', true, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%federal law addresses interstate%''), ''42 U.S.C. § 1983'', false, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%federal law addresses interstate%''), ''15 U.S.C. § 1681'', false, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%federal law addresses interstate%''), ''29 U.S.C. § 206'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'What is the primary difference between surveillance and stalking?', ''multiple_choice'', 1, 5);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%primary difference between surveillance%''), ''Surveillance uses technology, stalking does not'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%primary difference between surveillance%''), ''Surveillance may be legal with authorization, stalking is always illegal when statutory requirements are met'', true, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%primary difference between surveillance%''), ''Surveillance is always conducted by professionals'', false, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%primary difference between surveillance%''), ''There is no difference'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'How many people are stalked annually in the United States?', ''multiple_choice'', 1, 6);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%stalked annually in the United States%''), ''500,000'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%stalked annually in the United States%''), ''2.5 million'', false, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%stalked annually in the United States%''), ''Over 7.5 million'', true, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%stalked annually in the United States%''), ''15 million'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'Which element is NOT required for behavior to be considered stalking?', ''multiple_choice'', 1, 7);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%NOT required for behavior to be considered stalking%''), ''Pattern of behavior'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%NOT required for behavior to be considered stalking%''), ''Unwanted contact'', false, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%NOT required for behavior to be considered stalking%''), ''Physical violence'', true, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%NOT required for behavior to be considered stalking%''), ''Reasonable fear'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'Technology-facilitated stalking has increased by what percentage in recent years?', ''multiple_choice'', 1, 8);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%Technology-facilitated stalking has increased%''), ''100%'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%Technology-facilitated stalking has increased%''), ''200%'', false, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%Technology-facilitated stalking has increased%''), ''400%'', true, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%Technology-facilitated stalking has increased%''), ''600%'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'What percentage of femicide victims were stalked prior to being killed?', ''multiple_choice'', 1, 9);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%femicide victims were stalked%''), ''25%'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%femicide victims were stalked%''), ''50%'', false, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%femicide victims were stalked%''), ''76%'', true, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%femicide victims were stalked%''), ''90%'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'Which of the following is a legitimate reason for security professionals to learn surveillance detection?', ''multiple_choice'', 1, 10);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%legitimate reason for security professionals%''), ''To conduct illegal surveillance'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%legitimate reason for security professionals%''), ''To protect high-value clients from hostile surveillance'', true, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%legitimate reason for security professionals%''), ''To stalk individuals'', false, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%legitimate reason for security professionals%''), ''To invade privacy'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'How many U.S. states have anti-stalking laws?', ''multiple_choice'', 1, 11);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%states have anti-stalking laws%''), ''25 states'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%states have anti-stalking laws%''), ''40 states'', false, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%states have anti-stalking laws%''), ''All 50 states'', true, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%states have anti-stalking laws%''), ''No states have specific laws'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'What is the primary purpose of physical surveillance?', ''multiple_choice'', 1, 12);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%primary purpose of physical surveillance%''), ''Entertainment'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%primary purpose of physical surveillance%''), ''Direct observation to gather information'', true, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%primary purpose of physical surveillance%''), ''Social interaction'', false, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%primary purpose of physical surveillance%''), ''Exercise'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'Which of the following best describes "reasonable fear" in stalking cases?', ''multiple_choice'', 1, 13);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%reasonable fear%''), ''Any level of discomfort'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%reasonable fear%''), ''Fear that would cause a reasonable person to be concerned for their safety'', true, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%reasonable fear%''), ''Only fear of immediate physical harm'', false, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%reasonable fear%''), ''Fear that requires medical documentation'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'What is technical surveillance?', ''multiple_choice'', 1, 14);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''What is technical surveillance%''), ''Surveillance conducted by technicians'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''What is technical surveillance%''), ''Use of electronic devices such as cameras, GPS trackers, or listening devices'', true, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''What is technical surveillance%''), ''Surveillance of technical equipment'', false, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''What is technical surveillance%''), ''Surveillance using only computers'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'Why is this training important for civilians?', ''multiple_choice'', 1, 15);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%training important for civilians%''), ''It is not important for civilians'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%training important for civilians%''), ''To recognize when being followed or monitored and protect themselves'', true, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%training important for civilians%''), ''To become professional stalkers'', false, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%training important for civilians%''), ''Only for entertainment purposes'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'What does cyber surveillance involve?', ''multiple_choice'', 1, 16);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''What does cyber surveillance involve%''), ''Only monitoring social media'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''What does cyber surveillance involve%''), ''Monitoring digital activities, social media, emails, and online behavior'', true, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''What does cyber surveillance involve%''), ''Only email monitoring'', false, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''What does cyber surveillance involve%''), ''Physical observation of computers'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'According to statistics, what ratio of women have experienced stalking in their lifetime?', ''multiple_choice'', 1, 17);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%ratio of women have experienced stalking%''), ''1 in 20'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%ratio of women have experienced stalking%''), ''1 in 10'', false, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%ratio of women have experienced stalking%''), ''1 in 6'', true, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%ratio of women have experienced stalking%''), ''1 in 3'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'Which of the following is TRUE about surveillance?', ''multiple_choice'', 1, 18);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%TRUE about surveillance%''), ''It is always illegal'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%TRUE about surveillance%''), ''It is typically covert and professional'', true, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%TRUE about surveillance%''), ''It always involves violence'', false, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%TRUE about surveillance%''), ''It can only be conducted by government agencies'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'What is the purpose of this comprehensive course?', ''multiple_choice'', 1, 19);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%purpose of this comprehensive course%''), ''To teach people how to stalk others'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%purpose of this comprehensive course%''), ''To provide practical, evidence-based training on recognizing and responding to surveillance and stalking'', true, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%purpose of this comprehensive course%''), ''To promote illegal surveillance'', false, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%purpose of this comprehensive course%''), ''Entertainment only'', false, 4);

INSERT INTO assessment_questions (assessment_id, question_text, question_type, points, display_order) VALUES
((SELECT id FROM assessments WHERE assessment_name = ''Introduction to Surveillance & Stalking Assessment''),
'What is a key characteristic that distinguishes stalking from other unwanted behaviors?', ''multiple_choice'', 1, 20);

INSERT INTO question_options (question_id, option_text, is_correct, display_order) VALUES
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%distinguishes stalking from other unwanted%''), ''It only happens once'', false, 1),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%distinguishes stalking from other unwanted%''), ''It is a pattern of repeated, unwanted attention'', true, 2),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%distinguishes stalking from other unwanted%''), ''It always involves physical contact'', false, 3),
((SELECT id FROM assessment_questions WHERE question_text LIKE ''%distinguishes stalking from other unwanted%''), ''It must last at least one year'', false, 4);
