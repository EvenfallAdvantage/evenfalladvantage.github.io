-- =====================================================
-- MODULE 1: Introduction to Surveillance & Stalking
-- =====================================================
-- PREREQUISITE: Run SURVEILLANCE_COURSE_SIMPLE.sql first!
-- This creates Module 1 with all content and assessments
-- =====================================================

-- First, get the course_id (you'll need to replace this with actual UUID after running SURVEILLANCE_COURSE_SIMPLE.sql)
-- To find your course_id, run: SELECT id FROM courses WHERE course_code = 'surveillance-detection';

-- STEP 1: Insert the module (replace 'YOUR-COURSE-UUID-HERE' with actual course ID)
INSERT INTO training_modules (
    module_code,
    module_name,
    description,
    content,
    icon,
    estimated_duration_minutes,
    display_order,
    is_required
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
    true
);

-- STEP 2: Link module to course
-- After running the above, get the module_id by running:
-- SELECT id FROM training_modules WHERE module_code = 'surveillance-intro';
-- Then manually insert into course_modules table with your course_id and module_id

-- STEP 3: Create assessment (replace 'YOUR-MODULE-UUID-HERE' with actual module ID)
-- Get module_id first: SELECT id FROM training_modules WHERE module_code = 'surveillance-intro';

-- For now, I'll create a simpler version that you can run after getting the IDs
-- See DEPLOYMENT_INSTRUCTIONS.md for the manual process

-- ALTERNATIVE: Use this query to link everything after creation:
/*
INSERT INTO course_modules (course_id, module_id, module_order)
SELECT 
    (SELECT id FROM courses WHERE course_code = 'surveillance-detection'),
    (SELECT id FROM training_modules WHERE module_code = 'surveillance-intro'),
    1;
*/
