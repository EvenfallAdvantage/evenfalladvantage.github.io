// ============= INTERACTIVE SLIDESHOW SYSTEM =============

// Slideshow state
let currentSlideIndex = 0;
let currentModuleSlides = [];
let currentModuleId = null;

// Module slides data structure
const moduleSlidesData = {
    'welcome-materials': [
        {
            title: 'Welcome to Your Security Training',
            content: `
                <h3>Welcome and Reference Materials</h3>
                <p class="hero-subtitle">State-Specific Course Orientation</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-graduation-cap"></i> Module Overview</h4>
                    <p>This module provides essential information about your state-specific training requirements, recommended prerequisites, and reference materials.</p>
                    <p><strong>Duration:</strong> 30 Minutes | <strong>Slides:</strong> 8</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-info-circle"></i> No Assessment Required</h4>
                    <p>This is an orientation module. Simply read through all slides to mark it complete. No test required.</p>
                </div>
            `
        },
        {
            title: 'State Selection Required',
            content: `
                <h3>Select Your State</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-map-marked-alt"></i> State-Specific Training</h4>
                    <p>This course content is customized based on your state's requirements and regulations.</p>
                    <p><strong>Please select your state to continue.</strong></p>
                </div>
                <div id="stateSelectionContainer" style="margin: 2rem 0;">
                    <p>Loading state selection...</p>
                </div>
            `
        }
    ],
    'crowd-management': [
        {
            title: 'Crowd Management & Public Safety',
            content: `
                <h3>Crowd Management & Public Safety</h3>
                <p class="hero-subtitle">Maryland Fire Marshal Certified</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-users-cog"></i> Module Overview</h4>
                    <p>This module meets Fire Marshal certification requirements and has been field-tested at real events. This is a crucial part of your role as security personnel at large-scale gatherings.</p>
                    <p><strong>Duration:</strong> 2 Hours | <strong>Slides:</strong> 16</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Critical Importance</h4>
                    <p>Crowd management failures have led to tragic deaths at events worldwide. Your knowledge and vigilance can prevent disasters.</p>
                </div>
            `
        },
        {
            title: 'Module Objectives',
            content: `
                <h3>What You'll Learn</h3>
                <ul>
                    <li><strong>Define "crowd management" and "crowd control"</strong></li>
                    <li><strong>Identify common risks and hazards in crowd settings</strong></li>
                    <li><strong>Understand crowd behavior and response</strong></li>
                    <li><strong>Apply safety protocols for ingress/egress, density, and emergency movement</strong></li>
                    <li><strong>Coordinate with public safety officials and EMS</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> Key Distinction</h4>
                    <p><strong>Management</strong> is proactive. <strong>Control</strong> is reactive. This course prepares you to plan ahead, not just respond in crisis.</p>
                </div>
            `
        },
        {
            title: 'Understanding Crowd Dynamics',
            content: `
                <h3>Crowd Dynamics Fundamentals</h3>
                <h4>Types of Crowds:</h4>
                <ul>
                    <li><strong>Casual:</strong> Loose gathering, easy to manage</li>
                    <li><strong>Expressive:</strong> Emotional (concerts, sports) - energy can shift quickly</li>
                    <li><strong>Aggressive:</strong> Hostile intent, requires immediate response</li>
                    <li><strong>Organized:</strong> Planned gathering with structure</li>
                </ul>
                <h4>Phases of Crowd Development:</h4>
                <ul>
                    <li><strong>Arrival:</strong> Entry and initial gathering</li>
                    <li><strong>Occupation:</strong> Event duration, peak density</li>
                    <li><strong>Dispersal:</strong> Exit phase - often most dangerous</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Discussion:</h4>
                    <p><strong>Have you witnessed different types of crowds?</strong> Start building a mental model of behaviors.</p>
                </div>
            `
        },
        {
            title: 'Crowd Behavior and Panic Triggers',
            content: `
                <h3>Understanding Panic</h3>
                <h4>How Panic Spreads:</h4>
                <ul>
                    <li><strong>Sound:</strong> Screaming, loud noises trigger fear</li>
                    <li><strong>Visibility:</strong> Seeing others panic creates contagion</li>
                    <li><strong>Miscommunication:</strong> Rumors spread faster than facts</li>
                </ul>
                <h4>Contributing Factors:</h4>
                <ul>
                    <li><strong>Heat:</strong> Increases irritability and medical emergencies</li>
                    <li><strong>Loud noise:</strong> Makes communication difficult</li>
                    <li><strong>Intoxication:</strong> Impairs judgment and increases aggression</li>
                    <li><strong>Lack of space:</strong> Claustrophobia triggers panic</li>
                </ul>
                <h4>Recognizing Signs of Agitation:</h4>
                <p>Tie this back to Module 3 (Threat Assessment). Link behavior observation to early intervention.</p>
            `
        },
        {
            title: 'Fire Marshal Requirements: Ingress/Egress & Flow',
            content: `
                <h3>Legal Requirements for Crowd Safety</h3>
                <h4>Mandatory Compliance:</h4>
                <ul>
                    <li><strong>Maintain open paths of egress</strong> - Never block exits</li>
                    <li><strong>Understand egress time standards</strong> - Know evacuation capacity</li>
                    <li><strong>Monitor bottlenecks and barriers</strong> - Prevent choke points</li>
                    <li><strong>Signage, lighting, and ADA compliance</strong> - Legal requirements</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-balance-scale"></i> Critical Compliance</h4>
                    <p><strong>Blocked egress = liability.</strong> Review local and state codes. This is mandatory compliance education.</p>
                </div>
            `
        },
        {
            title: 'Capacity, Density, and Monitoring Tools',
            content: `
                <h3>Managing Occupancy</h3>
                <h4>Calculating Safe Occupancy:</h4>
                <p>Venue capacity is determined by Fire Marshal based on square footage and egress capacity.</p>
                <h4>Density Levels:</h4>
                <ul>
                    <li><strong>Low (< 2 people/m²):</strong> Comfortable, free movement</li>
                    <li><strong>Medium (2-4 people/m²):</strong> Restricted movement, manageable</li>
                    <li><strong>High (4-6 people/m²):</strong> Very restricted, potential danger</li>
                    <li><strong>Critical (> 6 people/m²):</strong> Dangerous, risk of crushing</li>
                </ul>
                <h4>Monitoring Tools:</h4>
                <ul>
                    <li><strong>Clickers and counters:</strong> Manual counting at entrances</li>
                    <li><strong>Drones:</strong> Aerial density assessment</li>
                    <li><strong>Patrols:</strong> Visual monitoring and reporting</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Question:</h4>
                    <p><strong>"What tools have you used in the field?"</strong> Explain practical methods to maintain count.</p>
                </div>
            `
        },
        {
            title: 'Pre-Event Planning: Key Coordination Partners',
            content: `
                <h3>Planning for Success</h3>
                <h4>Coordination Partners:</h4>
                <ul>
                    <li><strong>Fire Marshal:</strong> Capacity and egress approval</li>
                    <li><strong>EMS:</strong> Medical response planning</li>
                    <li><strong>Law Enforcement:</strong> Security and emergency response</li>
                    <li><strong>Security Supervisor:</strong> Team coordination</li>
                </ul>
                <h4>Pre-Event Briefing Should Include:</h4>
                <ul>
                    <li><strong>Site map review:</strong> Know the layout</li>
                    <li><strong>Hazard overlays:</strong> Identify risk areas</li>
                    <li><strong>Rally points:</strong> Where to meet in emergency</li>
                    <li><strong>Zone assignments:</strong> Who covers what area</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-clipboard-list"></i> Examples</h4>
                    <p>Give examples of successful and failed pre-planning. Offer a template for students to visualize what should be in a briefing.</p>
                </div>
            `
        },
        {
            title: 'Role of the Security Officer During Crowd Events',
            content: `
                <h3>Your Role in Crowd Management</h3>
                <h4>Key Responsibilities:</h4>
                <ul>
                    <li><strong>Visual deterrence, not physical force</strong> - Presence prevents problems</li>
                    <li><strong>Radio observed problems</strong> - Don't confront mobs alone</li>
                    <li><strong>Manage lines, exits, and first aid points</strong> - Flow control</li>
                    <li><strong>Assist, don't command</strong> - Work with authorities</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-user-shield"></i> Key Phrase</h4>
                    <p><strong>"Show presence, not pressure."</strong> Emphasize non-aggressive posture and chain of command.</p>
                </div>
            `
        },
        {
            title: 'Evacuation Protocols and Emergency Movement',
            content: `
                <h3>Emergency Evacuation</h3>
                <h4>Trigger Points for Evacuation:</h4>
                <ul>
                    <li>Fire or smoke</li>
                    <li>Structural damage</li>
                    <li>Active threat</li>
                    <li>Severe weather</li>
                    <li>Hazardous materials</li>
                </ul>
                <h4>Sector-Based Clearing:</h4>
                <p>Evacuate by zones to prevent bottlenecks. Clear nearest exits first, then expand outward.</p>
                <h4>Assisting Persons with Disabilities:</h4>
                <ul>
                    <li>Identify accessible routes</li>
                    <li>Assign personnel to assist</li>
                    <li>Never leave anyone behind</li>
                </ul>
                <h4>Communication During Evacuation:</h4>
                <p>Reinforce ICS terminology. Show how security integrates with Incident Command during evacuations.</p>
            `
        },
        {
            title: 'Real-World Failures: Lessons from Past Events',
            content: `
                <h3>Learning from Tragedy</h3>
                <h4>Case Studies:</h4>
                <ul>
                    <li><strong>Astroworld 2021:</strong> Crushing, delayed medical response - 10 deaths</li>
                    <li><strong>The Station Nightclub Fire 2003:</strong> Egress failure - 100 deaths</li>
                    <li><strong>Love Parade 2010:</strong> Crowd surge in tunnel - 21 deaths</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Discussion:</h4>
                    <p><strong>"What failed here? What would you have done?"</strong> Draw lessons that lead to prevention, not blame.</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Critical Lesson</h4>
                    <p>These weren't accidents—they were preventable failures in crowd management. Your vigilance matters.</p>
                </div>
            `
        },
        {
            title: 'Crowd Management at Festivals & Live Events',
            content: `
                <h3>Festival-Specific Challenges</h3>
                <h4>Flow vs Choke Points:</h4>
                <ul>
                    <li><strong>Bathrooms:</strong> Always create bottlenecks</li>
                    <li><strong>Bars:</strong> High-traffic, high-emotion areas</li>
                    <li><strong>Stages:</strong> Surge points during popular acts</li>
                </ul>
                <h4>Pulse Patrols:</h4>
                <p><strong>Moving with the crowd rhythm</strong> - Don't fight the flow, guide it</p>
                <h4>High-Risk Behaviors:</h4>
                <ul>
                    <li><strong>Crowd surfing:</strong> Risk of falls and injuries</li>
                    <li><strong>Fence jumping:</strong> Capacity violations and injuries</li>
                    <li><strong>Mosh pits:</strong> Require monitoring for injuries</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Field Experience:</h4>
                    <p><strong>"This isn't theory, this is boots on the ground. Where do YOU post guards?"</strong></p>
                </div>
            `
        },
        {
            title: 'Situational Awareness & Real-Time Monitoring',
            content: `
                <h3>Continuous Vigilance</h3>
                <h4>Keeping Your Head on a Swivel:</h4>
                <ul>
                    <li>Scan your zone constantly</li>
                    <li>Look for density changes</li>
                    <li>Watch for distressed individuals</li>
                    <li>Monitor exit accessibility</li>
                </ul>
                <h4>Working with Technology:</h4>
                <ul>
                    <li><strong>Camera feeds:</strong> Remote monitoring</li>
                    <li><strong>Drones:</strong> Aerial perspective</li>
                    <li><strong>Radio coordination:</strong> Real-time updates</li>
                </ul>
                <p>Reinforce Module 1 (Radio Comms). Show how tech and personnel combine for coverage. Use a sample site map for group discussion.</p>
            `
        },
        {
            title: 'Interacting with the Public: De-escalation & Communication',
            content: `
                <h3>Professional Public Interaction</h3>
                <h4>Communication Principles:</h4>
                <ul>
                    <li><strong>Calm, clear, consistent:</strong> Your tone sets the mood</li>
                    <li><strong>Handle upset guests professionally:</strong> Empathy without compromise</li>
                    <li><strong>Don't give false information:</strong> Or make promises you can't keep</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Practice Scripts:</h4>
                    <p><strong>"What would you say if..."</strong> a guest is angry about wait times? Someone wants to bring in prohibited items?</p>
                </div>
                <p>Refer back to Module 3's de-escalation principles. Practice scripts aloud with volunteers.</p>
            `
        },
        {
            title: 'Working Alongside EMS and Law Enforcement',
            content: `
                <h3>Multi-Agency Coordination</h3>
                <h4>Your Role vs Theirs:</h4>
                <ul>
                    <li><strong>Security:</strong> Prevention, observation, first response</li>
                    <li><strong>EMS:</strong> Medical treatment and transport</li>
                    <li><strong>Law Enforcement:</strong> Criminal matters, arrests</li>
                </ul>
                <h4>How to Support EMS:</h4>
                <ul>
                    <li><strong>Direct EMS to victims:</strong> Clear pathways</li>
                    <li><strong>Provide scene information:</strong> What happened, how many injured</li>
                    <li><strong>Control crowds:</strong> Keep bystanders back</li>
                    <li><strong>Preserve evidence:</strong> If criminal activity involved</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-handshake"></i> Remember</h4>
                    <p>Security does not "take over." Teach them how to be part of the chain, not break it.</p>
                </div>
            `
        },
        {
            title: 'Quick Situational Quiz',
            content: `
                <h3>Scenario Practice</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-clipboard-check"></i> Scenario 1: Gate Crash Attempt</h4>
                    <p>Group of 20 people rush the gate trying to enter without tickets. What do you do?</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-clipboard-check"></i> Scenario 2: Overcrowded VIP Area</h4>
                    <p>VIP section is at 150% capacity. People are complaining. What's your action?</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-clipboard-check"></i> Scenario 3: Injury at the Fence Line</h4>
                    <p>Someone collapses at the front barrier during a concert. Crowd is pressing forward. What do you do?</p>
                </div>
                <p><strong>Think through each scenario before continuing.</strong> Consider field-based reasoning.</p>
            `
        },
        {
            title: 'Module Summary & Fire Marshal Certification',
            content: `
                <h3>Crowd Management Complete</h3>
                <h4>Key Takeaways - The 3 B's:</h4>
                <ul>
                    <li><strong>Behavior:</strong> Understand crowd dynamics and psychology</li>
                    <li><strong>Bottlenecks:</strong> Identify and manage choke points</li>
                    <li><strong>Briefings:</strong> Pre-event planning prevents disasters</li>
                </ul>
                <h4>Legal and Safety Responsibilities:</h4>
                <ul>
                    <li>Maintain egress at all times</li>
                    <li>Monitor density and capacity</li>
                    <li>Coordinate with public safety</li>
                    <li>Document incidents thoroughly</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-certificate"></i> Certification</h4>
                    <p>This training meets Maryland Fire Marshal requirements for crowd management certification.</p>
                </div>
                <p><strong>Next Step:</strong> Take the Module 6 Assessment to test your knowledge.</p>
            `
        }
    ],
    'emergency-response': [
        {
            title: 'Emergency Response Overview',
            content: `
                <h3>Emergency Response for Event Security</h3>
                <p>As a security guard, you must be prepared to respond quickly and effectively to various emergency situations.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-ambulance"></i> What You'll Learn</h4>
                    <ul>
                        <li>Types of emergencies at events</li>
                        <li>The 5 A's response protocol</li>
                        <li>Medical emergency procedures</li>
                        <li>Evacuation protocols</li>
                        <li>Communication during emergencies</li>
                    </ul>
                </div>
            `
        },
        {
            title: 'Types of Emergencies',
            content: `
                <h3>Common Event Emergencies</h3>
                <p>Understanding different emergency types helps you respond appropriately.</p>
                <h4>Medical Emergencies:</h4>
                <ul>
                    <li>Heart attacks, seizures, allergic reactions</li>
                    <li>Injuries from falls, fights, or crowd incidents</li>
                    <li>Heat exhaustion and dehydration</li>
                    <li>Alcohol or drug-related incidents</li>
                </ul>
                <h4>Safety Emergencies:</h4>
                <ul>
                    <li>Fire or smoke</li>
                    <li>Structural concerns</li>
                    <li>Severe weather</li>
                    <li>Active threats</li>
                </ul>
                <h4>Crowd Emergencies:</h4>
                <ul>
                    <li>Stampedes or crushes</li>
                    <li>Mass panic</li>
                    <li>Large-scale fights or riots</li>
                </ul>
            `
        },
        {
            title: 'The 5 A\'s Protocol',
            content: `
                <h3>Emergency Response: The 5 A's</h3>
                <p>Follow this systematic approach for all emergencies:</p>
                <h4>1. ASSESS</h4>
                <p>Quickly evaluate the situation and severity. What happened? How many people involved? Is it safe to approach?</p>
                <h4>2. ALERT</h4>
                <p>Immediately notify supervisor and emergency services. Use proper radio codes (Code 3 for emergencies).</p>
                <h4>3. ACT</h4>
                <p>Take appropriate action within your training. Provide first aid if qualified, secure the area, control crowds.</p>
                <h4>4. ASSIST</h4>
                <p>Help emergency responders access the scene. Clear pathways, provide information, guide EMS to patient.</p>
                <h4>5. ACCOUNT</h4>
                <p>Document everything. Write detailed incident report including times, actions taken, and witness information.</p>
            `
        },
        {
            title: 'Medical Emergency Response',
            content: `
                <h3>Responding to Medical Emergencies</h3>
                <h4>Immediate Actions:</h4>
                <ol>
                    <li><strong>Call for Help:</strong> Radio for medical assistance immediately</li>
                    <li><strong>Assess Patient:</strong> Check if conscious, breathing, bleeding</li>
                    <li><strong>Provide First Aid:</strong> Only if trained and safe to do so</li>
                    <li><strong>Clear Area:</strong> Move crowds back, give patient space</li>
                    <li><strong>Guide EMS:</strong> Meet and direct paramedics to patient</li>
                    <li><strong>Preserve Evidence:</strong> If injury from incident, secure area</li>
                </ol>
                <div class="slide-callout">
                    <h4><i class="fas fa-heartbeat"></i> Important</h4>
                    <p>Never move an injured person unless they are in immediate danger (fire, traffic, etc.). Moving someone with spinal injuries can cause permanent damage.</p>
                </div>
            `
        },
        {
            title: 'Evacuation Procedures',
            content: `
                <h3>Emergency Evacuations</h3>
                <p>Evacuations require calm, clear communication and decisive action.</p>
                <h4>Your Role:</h4>
                <ul>
                    <li><strong>Stay Calm:</strong> Your composure helps others stay calm</li>
                    <li><strong>Give Clear Instructions:</strong> Loud, clear voice: "Please proceed to the nearest exit"</li>
                    <li><strong>Direct Traffic:</strong> Point people to nearest safe exit</li>
                    <li><strong>Assist Those in Need:</strong> Help elderly, disabled, or panicked individuals</li>
                    <li><strong>Prevent Re-entry:</strong> Don't let anyone back in until cleared by authorities</li>
                    <li><strong>Account for Personnel:</strong> Report to supervisor when area is clear</li>
                </ul>
                <p><strong>Know Your Exits:</strong> Always familiarize yourself with all emergency exits and assembly points during pre-event briefing.</p>
            `
        },
        {
            title: 'Emergency Communication',
            content: `
                <h3>Radio Communication in Emergencies</h3>
                <p>Clear, concise communication is critical during emergencies.</p>
                <h4>Emergency Radio Protocol:</h4>
                <ul>
                    <li><strong>Code 3:</strong> Emergency - immediate response needed</li>
                    <li><strong>10-33:</strong> Emergency traffic - clear the channel</li>
                    <li><strong>State Location:</strong> Be specific (Gate 3, Section B, etc.)</li>
                    <li><strong>Describe Situation:</strong> Brief, factual description</li>
                    <li><strong>Request Resources:</strong> State what help you need</li>
                    <li><strong>Provide Updates:</strong> Keep supervisor informed of changes</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Example Radio Call:</h4>
                    <p><em>"Command, this is Gate 3. Code 3 medical emergency. Male, approximately 30 years old, unconscious. Requesting EMS and supervisor to Gate 3 immediately."</em></p>
                </div>
            `
        },
        {
            title: 'Knowledge Check',
            content: `
                <h3>Test Your Understanding</h3>
                <div class="slide-quiz" data-quiz-id="emergency-1">
                    <p class="slide-quiz-question">What does "Code 3" mean in emergency radio communication?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">Lunch break</div>
                        <div class="slide-quiz-option" data-answer="1" data-correct="true">Emergency requiring immediate response</div>
                        <div class="slide-quiz-option" data-answer="2">End of shift</div>
                        <div class="slide-quiz-option" data-answer="3">Non-emergency situation</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
            `
        },
        {
            title: 'Module Summary',
            content: `
                <h3>Emergency Response Summary</h3>
                <p>You've learned the essential skills for emergency response at events.</p>
                <h4>Key Takeaways:</h4>
                <ul>
                    <li><strong>The 5 A's:</strong> Assess, Alert, Act, Assist, Account</li>
                    <li><strong>Medical Emergencies:</strong> Call for help first, provide first aid if trained</li>
                    <li><strong>Evacuations:</strong> Stay calm, give clear directions, assist those in need</li>
                    <li><strong>Communication:</strong> Use Code 3 for emergencies, be clear and specific</li>
                    <li><strong>Documentation:</strong> Always complete detailed incident reports</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Module Complete!</h4>
                    <p>You're now prepared to handle emergency situations at events. Practice these procedures in the sand table exercise.</p>
                </div>
            `
        }
    ],
    'access-screening': [
        {
            title: 'Access Control & Screening',
            content: `
                <h3>Entry Control and Screening</h3>
                <p>Controlling access and screening attendees is a critical function for event security guards.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-clipboard-check"></i> What You'll Learn</h4>
                    <ul>
                        <li>Entry control responsibilities</li>
                        <li>Prohibited items and screening procedures</li>
                        <li>Ticket validation techniques</li>
                        <li>Dealing with denied entry</li>
                        <li>VIP and backstage access control</li>
                    </ul>
                </div>
            `
        },
        {
            title: 'Entry Control Responsibilities',
            content: `
                <h3>Your Role at Entry Points</h3>
                <p>As an entry control guard, you are the first line of defense for event security.</p>
                <h4>Key Responsibilities:</h4>
                <ul>
                    <li><strong>Ticket Validation:</strong> Verify all tickets, passes, and credentials</li>
                    <li><strong>Bag Inspection:</strong> Check bags for prohibited items</li>
                    <li><strong>Metal Detection:</strong> Operate metal detectors or wands properly</li>
                    <li><strong>ID Verification:</strong> Check identification when required</li>
                    <li><strong>Deny Entry:</strong> Refuse entry for prohibited items or invalid tickets</li>
                    <li><strong>Customer Service:</strong> Be professional and courteous at all times</li>
                </ul>
                <p>Remember: You set the tone for the attendee's experience. Be firm but friendly.</p>
            `
        },
        {
            title: 'Prohibited Items',
            content: `
                <h3>Common Prohibited Items</h3>
                <p>Know what items are not allowed at events. This list varies by venue but typically includes:</p>
                <h4>Always Prohibited:</h4>
                <ul>
                    <li><strong>Weapons:</strong> Firearms, knives, brass knuckles, pepper spray</li>
                    <li><strong>Illegal Substances:</strong> Drugs and drug paraphernalia</li>
                    <li><strong>Explosives:</strong> Fireworks, flares, smoke devices</li>
                    <li><strong>Glass Containers:</strong> Bottles, jars (safety hazard)</li>
                </ul>
                <h4>Often Prohibited:</h4>
                <ul>
                    <li>Outside food and beverages</li>
                    <li>Professional cameras/recording equipment</li>
                    <li>Large bags or backpacks</li>
                    <li>Laser pointers</li>
                    <li>Umbrellas (at some venues)</li>
                    <li>Selfie sticks</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Important</h4>
                    <p>Always know the specific prohibited items list for your event. This should be covered in your pre-event briefing.</p>
                </div>
            `
        },
        {
            title: 'Screening Procedures',
            content: `
                <h3>Proper Screening Techniques</h3>
                <h4>Bag Inspection:</h4>
                <ol>
                    <li>Ask permission: "May I check your bag?"</li>
                    <li>Have attendee open bag themselves</li>
                    <li>Visually inspect contents - don't rummage through personal items</li>
                    <li>Check all compartments and pockets</li>
                    <li>If prohibited item found, explain policy professionally</li>
                </ol>
                <h4>Metal Detector Operation:</h4>
                <ol>
                    <li>Instruct attendee to remove metal items (keys, phone, belt)</li>
                    <li>Have them walk through at normal pace</li>
                    <li>If alarm sounds, use hand wand for secondary screening</li>
                    <li>Ask about metal items: "Do you have any metal objects?"</li>
                    <li>Be respectful and professional throughout</li>
                </ol>
                <p><strong>Best Practice:</strong> Conduct searches in view of others for transparency. Same-gender searches when possible.</p>
            `
        },
        {
            title: 'Dealing with Denied Entry',
            content: `
                <h3>Handling Denied Entry Situations</h3>
                <p>Denying entry can be confrontational. Stay professional and follow these guidelines:</p>
                <h4>Steps to Take:</h4>
                <ol>
                    <li><strong>Remain Calm:</strong> Don't match their energy if they get upset</li>
                    <li><strong>Explain Clearly:</strong> "I'm sorry, but [item/reason] is not permitted"</li>
                    <li><strong>Offer Alternatives:</strong> "You can return it to your vehicle" or "We have a coat check"</li>
                    <li><strong>Don't Argue:</strong> State the policy, don't debate it</li>
                    <li><strong>Call Supervisor:</strong> If person refuses to comply or becomes aggressive</li>
                    <li><strong>Document:</strong> Note the incident if significant</li>
                </ol>
                <div class="slide-interactive">
                    <h4>What NOT to Do:</h4>
                    <ul>
                        <li>Don't get into arguments or debates</li>
                        <li>Don't make exceptions "just this once"</li>
                        <li>Don't physically touch the person</li>
                        <li>Don't raise your voice or use profanity</li>
                        <li>Don't let them intimidate you into allowing entry</li>
                    </ul>
                </div>
            `
        },
        {
            title: 'VIP and Backstage Access',
            content: `
                <h3>Controlling Restricted Access</h3>
                <p>VIP and backstage areas require extra vigilance.</p>
                <h4>Verification Procedures:</h4>
                <ul>
                    <li><strong>Check Credentials:</strong> Verify pass matches access list</li>
                    <li><strong>Match Photo ID:</strong> Ensure pass holder matches ID</li>
                    <li><strong>Look for Security Features:</strong> Holograms, special markings</li>
                    <li><strong>Check Expiration:</strong> Some passes are time-limited</li>
                    <li><strong>Escort if Required:</strong> Some areas require escort</li>
                </ul>
                <h4>Common Access Levels:</h4>
                <ul>
                    <li><strong>All Access:</strong> Unrestricted access to all areas</li>
                    <li><strong>Backstage:</strong> Behind-stage areas only</li>
                    <li><strong>VIP:</strong> VIP lounges and seating</li>
                    <li><strong>Working Personnel:</strong> Staff and crew areas</li>
                    <li><strong>Media:</strong> Press areas and photo pit</li>
                </ul>
                <p><strong>If in doubt, verify with supervisor before allowing access.</strong></p>
            `
        },
        {
            title: 'Knowledge Check',
            content: `
                <h3>Test Your Understanding</h3>
                <div class="slide-quiz" data-quiz-id="access-1">
                    <p class="slide-quiz-question">If someone refuses to allow a bag search, what should you do?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">Let them in anyway</div>
                        <div class="slide-quiz-option" data-answer="1" data-correct="true">Politely explain policy, deny entry if they refuse, call supervisor</div>
                        <div class="slide-quiz-option" data-answer="2">Force them to open the bag</div>
                        <div class="slide-quiz-option" data-answer="3">Argue with them until they comply</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
            `
        },
        {
            title: 'Module Summary',
            content: `
                <h3>Access Control Summary</h3>
                <p>You've learned the essential skills for entry control and screening.</p>
                <h4>Key Takeaways:</h4>
                <ul>
                    <li><strong>Be Professional:</strong> Courteous but firm enforcement of policies</li>
                    <li><strong>Know Prohibited Items:</strong> Familiarize yourself with venue-specific rules</li>
                    <li><strong>Proper Screening:</strong> Respectful, thorough bag checks and metal detection</li>
                    <li><strong>Handle Denials Calmly:</strong> Explain policy, offer alternatives, call supervisor if needed</li>
                    <li><strong>Verify Credentials:</strong> Check all VIP and backstage passes carefully</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Module Complete!</h4>
                    <p>You're now ready to manage entry points effectively. Practice these skills in the sand table exercise.</p>
                </div>
            `
        }
    ],
    'communication-protocols': [
        {
            title: 'Security Radio Communications',
            content: `
                <h3>Security Radio Communications</h3>
                <p class="hero-subtitle">Clear, Safe, and Effective Communications in the Field</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-walkie-talkie"></i> Module Overview</h4>
                    <p>Radios are the lifeline of event and private security work. This module will teach you how to communicate effectively, professionally, and safely in any security environment.</p>
                    <p><strong>Duration:</strong> 1.5 Hours | <strong>Slides:</strong> 21</p>
                </div>
            `
        },
        {
            title: 'Learning Objectives',
            content: `
                <h3>What You'll Learn</h3>
                <ul>
                    <li><strong>Proper radio operation and etiquette</strong></li>
                    <li><strong>Key radio codes and terminology</strong></li>
                    <li><strong>Real-world call-ins and emergency reports</strong></li>
                    <li><strong>Chain of command in radio communication</strong></li>
                    <li><strong>How interpersonal communication influences radio use</strong></li>
                </ul>
                <div class="slide-interactive">
                    <h4>Discussion Question:</h4>
                    <p><strong>Who's used radios before? What went wrong or right?</strong></p>
                    <p>Think about your experiences as we go through this module.</p>
                </div>
            `
        },
        {
            title: 'Why Radios Matter in Security',
            content: `
                <h3>The Critical Role of Radio Communications</h3>
                <ul>
                    <li><strong>Direct link to safety:</strong> Instant communication in emergencies</li>
                    <li><strong>Enables coordination under stress:</strong> Team synchronization</li>
                    <li><strong>Supports legal documentation & reporting:</strong> Creates record of events</li>
                    <li><strong>Speeds up emergency response:</strong> Seconds matter</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Real-World Example</h4>
                    <p>The Astroworld tragedy showed how lack of clear communications contributed to chaos. When no one's talking effectively, situations deteriorate rapidly.</p>
                </div>
                <div class="slide-interactive">
                    <h4>Think About It:</h4>
                    <p><strong>How fast can things go bad when no one's talking?</strong></p>
                </div>
            `
        },
        {
            title: 'Types of Radios',
            content: `
                <h3>Radio Equipment Overview</h3>
                <h4>Radio Types:</h4>
                <ul>
                    <li><strong>Analog vs. Digital:</strong> Different technologies, similar operation</li>
                    <li><strong>Handhelds (HTs) vs. Base Stations:</strong> Portable vs. fixed location</li>
                </ul>
                <h4>Best Practices:</h4>
                <ul>
                    <li><strong>Battery life & charging:</strong> Always start shift with full charge</li>
                    <li><strong>Push-to-Talk (PTT) mechanics:</strong> Press, pause, speak, release</li>
                    <li><strong>Volume control:</strong> Loud enough to hear, not disturbing</li>
                    <li><strong>Earpiece use:</strong> Maintains professionalism and privacy</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-battery-full"></i> Remember</h4>
                    <p>Know your radio before it matters. A dead battery or unfamiliar controls can cost lives.</p>
                </div>
            `
        },
        {
            title: 'Radio Terminology Basics',
            content: `
                <h3>Essential Radio Language</h3>
                <h4>10-Codes vs. Plain English:</h4>
                <p>Many agencies use plain English for clarity. Know what your employer prefers.</p>
                <h4>Key Terms:</h4>
                <ul>
                    <li><strong>Copy:</strong> I understand / Message received</li>
                    <li><strong>Standby:</strong> Wait, I'll get back to you</li>
                    <li><strong>Go ahead:</strong> Proceed with your transmission</li>
                    <li><strong>Affirmative:</strong> Yes</li>
                    <li><strong>Negative:</strong> No</li>
                    <li><strong>Say again:</strong> Please repeat (NEVER use "repeat")</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Practice Example:</h4>
                    <p><em>"Dispatch, this is Post 1. Standby for update."</em></p>
                    <p><em>"Post 1, this is Dispatch. Go ahead."</em></p>
                </div>
            `
        },
        {
            title: 'Voice Tone and Clarity',
            content: `
                <h3>How You Sound Matters</h3>
                <h4>Communication Best Practices:</h4>
                <ul>
                    <li><strong>Speak slow, clear, and direct</strong></li>
                    <li><strong>Avoid emotion in voice:</strong> Stay calm and professional</li>
                    <li><strong>Use short, complete phrases:</strong> No rambling</li>
                    <li><strong>Don't shout:</strong> Radios amplify your voice</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-microphone"></i> The Pause-Press-Speak Formula</h4>
                    <ol>
                        <li><strong>Pause:</strong> Think about what you need to say</li>
                        <li><strong>Press:</strong> Hold PTT button, wait 1 second</li>
                        <li><strong>Speak:</strong> Deliver your message clearly</li>
                    </ol>
                </div>
                <p><strong>Confidence, not panic.</strong> Your voice sets the tone for the entire response.</p>
            `
        },
        {
            title: 'Order of Transmission',
            content: `
                <h3>Proper Transmission Protocol</h3>
                <h4>The Four Steps:</h4>
                <ol>
                    <li><strong>Think before keying:</strong> Know what you'll say</li>
                    <li><strong>Identify self and location:</strong> "Post 3 to Base"</li>
                    <li><strong>Wait for acknowledgment:</strong> Don't transmit until cleared</li>
                    <li><strong>Keep it brief, relevant, professional:</strong> No unnecessary details</li>
                </ol>
                <div class="slide-interactive">
                    <h4>Good Example:</h4>
                    <p><em>"Post 3 to Base."</em></p>
                    <p><em>"Base, go ahead Post 3."</em></p>
                    <p><em>"Post 3, requesting relief for 10-7 break."</em></p>
                    <p><em>"Copy Post 3, relief en route."</em></p>
                </div>
            `
        },
        {
            title: 'Sample Script – Normal Check-In',
            content: `
                <h3>Routine Radio Check</h3>
                <p>Regular check-ins maintain communication readiness and confirm all posts are operational.</p>
                <div class="slide-interactive">
                    <h4>Standard Check-In Format:</h4>
                    <p><strong>Guard:</strong> <em>"Post 1 to Base, radio check."</em></p>
                    <p><strong>Base:</strong> <em>"Base to Post 1, I read you loud and clear."</em></p>
                    <p><strong>Guard:</strong> <em>"Post 1 to Base, nothing to report at this time."</em></p>
                    <p><strong>Base:</strong> <em>"Copy Post 1, continue monitoring."</em></p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-question-circle"></i> Why This Matters</h4>
                    <p>Regular check-ins during downtime ensure your radio is working and your team knows you're alert. It's not just busy work—it's operational readiness.</p>
                </div>
            `
        },
        {
            title: 'Chain of Command Overview',
            content: `
                <h3>Understanding Chain of Command</h3>
                <h4>Who You Report To:</h4>
                <ol>
                    <li><strong>Security Guards:</strong> You (front-line)</li>
                    <li><strong>Team Leader/Supervisor:</strong> Your immediate supervisor</li>
                    <li><strong>Security Manager:</strong> Overall security operations</li>
                    <li><strong>Event Manager:</strong> Final authority</li>
                </ol>
                <h4>Key Principles:</h4>
                <ul>
                    <li><strong>When to escalate:</strong> Issues beyond your authority</li>
                    <li><strong>When NOT to jump the chain:</strong> Routine matters</li>
                    <li><strong>Reporting through Supervisor vs. directly to Command:</strong> Follow protocol unless emergency</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-sitemap"></i> Reducing Radio Clutter</h4>
                    <p>Following chain of command keeps the radio clear for critical communications. Don't tie up the channel with issues your supervisor can handle.</p>
                </div>
            `
        },
        {
            title: 'Reporting Critical Incidents',
            content: `
                <h3>When to Report Immediately</h3>
                <h4>Critical Situations:</h4>
                <ul>
                    <li><strong>Medical emergency:</strong> Injury, illness, unconscious person</li>
                    <li><strong>Fight/disturbance:</strong> Physical altercation or escalating conflict</li>
                    <li><strong>Suspicious person or package:</strong> Potential threat</li>
                    <li><strong>Lost child / Missing person:</strong> Immediate response required</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-clipboard-list"></i> SITREP Format</h4>
                    <p>Use the SITREP (Situation Report) format for critical incidents. This ensures all essential information is communicated clearly and quickly.</p>
                </div>
                <p><strong>Remember:</strong> Calm tone, clear data, repeat back confirmations.</p>
            `
        },
        {
            title: 'SITREP Format',
            content: `
                <h3>Situation Report (SITREP) Structure</h3>
                <h4>The Five W's:</h4>
                <ul>
                    <li><strong>WHO:</strong> You + subject (your ID and who's involved)</li>
                    <li><strong>WHAT:</strong> Nature of incident (medical, fight, suspicious activity)</li>
                    <li><strong>WHERE:</strong> Exact location (post number, section, landmark)</li>
                    <li><strong>WHEN:</strong> Time reported (usually "now" but note if delayed)</li>
                    <li><strong>WHAT'S NEEDED:</strong> Supervisor, EMS, police?</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Example SITREP:</h4>
                    <p><em>"Post 2 to Supervisor, SITREP follows. Male subject, approximately 30 years old, unconscious near Section B restrooms. Occurred approximately 5 minutes ago. Requesting EMS immediately."</em></p>
                </div>
            `
        },
        {
            title: 'Radio Failures & Troubleshooting',
            content: `
                <h3>When Technology Fails</h3>
                <h4>Common Issues:</h4>
                <ul>
                    <li><strong>Dead battery:</strong> Always carry spare or know charging locations</li>
                    <li><strong>Cross-talk:</strong> Multiple transmissions interfering</li>
                    <li><strong>Environmental interference:</strong> Buildings, crowds, weather</li>
                    <li><strong>Lost comms protocols:</strong> What to do when radio fails</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Critical Question:</h4>
                    <p><strong>What do you do if your radio dies mid-incident?</strong></p>
                    <p><strong>Answer:</strong> Use backup communication methods:</p>
                    <ul>
                        <li>Send a runner to supervisor</li>
                        <li>Use personal cell phone if authorized</li>
                        <li>Use visual signals if established</li>
                        <li>Move to nearest post with working radio</li>
                    </ul>
                </div>
            `
        },
        {
            title: 'Face-to-Face vs. Radio',
            content: `
                <h3>Choosing the Right Communication Method</h3>
                <h4>When to Use Radio:</h4>
                <ul>
                    <li>Alerting team to incidents</li>
                    <li>Requesting assistance</li>
                    <li>Status updates</li>
                    <li>Emergency communications</li>
                </ul>
                <h4>When to Use Face-to-Face:</h4>
                <ul>
                    <li>Delivering sensitive information</li>
                    <li>Resolving conflicts with attendees</li>
                    <li>Detailed briefings</li>
                    <li>De-escalation conversations</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-comments"></i> Key Principle</h4>
                    <p><strong>Use radio for alerting, face-to-face for resolving.</strong> Radio is a tool, not your only communication method.</p>
                </div>
                <p>Emphasize professionalism in both channels.</p>
            `
        },
        {
            title: 'Working Your Post – Routine Use',
            content: `
                <h3>Radio Use During Normal Operations</h3>
                <h4>Regular Communications:</h4>
                <ul>
                    <li><strong>Regular check-ins:</strong> Hourly or as directed</li>
                    <li><strong>Relief rotation procedures:</strong> Coordinate breaks</li>
                    <li><strong>Observational updates:</strong> Report unusual activity</li>
                    <li><strong>Notifying supervisor when stepping away:</strong> Never go dark</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-clock"></i> Important</h4>
                    <p><strong>"Being bored doesn't mean going dark."</strong></p>
                    <p>Maintain regular communication even during quiet periods. Your team needs to know you're alert and operational.</p>
                </div>
            `
        },
        {
            title: 'Scenario 1 – Suspicious Person',
            content: `
                <h3>Practice Scenario: Suspicious Activity</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-user-secret"></i> Scenario</h4>
                    <p>You observe a male subject loitering near the stage entrance for 15 minutes. He's wearing a large backpack and keeps looking around nervously. He's not engaging with the event.</p>
                </div>
                <div class="slide-interactive">
                    <h4>Your Radio Call:</h4>
                    <p><strong>Example Response:</strong></p>
                    <p><em>"Post 3 to Base, I have a SITREP. Male subject, approximately 25-30 years old, wearing dark hoodie and large backpack, loitering near stage entrance for past 15 minutes. Subject appears nervous and not engaging with event. Requesting supervisor assessment."</em></p>
                </div>
                <p><strong>What did this call include?</strong> WHO, WHAT, WHERE, behavior description, and request for assistance.</p>
            `
        },
        {
            title: 'Scenario 2 – Medical Emergency',
            content: `
                <h3>Practice Scenario: Medical Emergency</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-ambulance"></i> Scenario</h4>
                    <p>A female attendee has collapsed near the exit gate. She is conscious but appears disoriented and is having difficulty breathing.</p>
                </div>
                <div class="slide-interactive">
                    <h4>Your Radio Call:</h4>
                    <p><strong>Example Response:</strong></p>
                    <p><em>"Post 5 to Base, Code 3 medical emergency. Female subject, approximately 20s, collapsed near Exit Gate 2. Subject is conscious but disoriented with difficulty breathing. Requesting EMS immediately. I am staying with subject."</em></p>
                </div>
                <h4>Follow-Up Communication:</h4>
                <p><em>"Post 5 to Base, update. EMS has arrived and is treating subject. Gate 2 partially blocked, directing crowd to Gate 3."</em></p>
            `
        },
        {
            title: 'Scenario 3 – Command Confusion',
            content: `
                <h3>Practice Scenario: Radio Chaos</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Scenario</h4>
                    <p>Three units are trying to respond at once. Cross-talk is making it impossible to understand anyone. An emergency is in progress but no one can communicate effectively.</p>
                </div>
                <h4>What Went Wrong:</h4>
                <ul>
                    <li>Multiple people transmitting simultaneously</li>
                    <li>No one waiting for channel to clear</li>
                    <li>Panic causing rushed, unclear speech</li>
                    <li>No supervisor taking control of channel</li>
                </ul>
                <h4>How to Fix This:</h4>
                <ul>
                    <li><strong>Supervisor:</strong> "All units standby, Command has the channel"</li>
                    <li><strong>Priority:</strong> Emergency traffic goes first</li>
                    <li><strong>One at a time:</strong> Wait for acknowledgment</li>
                    <li><strong>Stay calm:</strong> Clear head, clear communication</li>
                </ul>
            `
        },
        {
            title: 'Common Radio Codes',
            content: `
                <h3>Essential 10-Codes</h3>
                <h4>Status Codes:</h4>
                <ul>
                    <li><strong>10-4:</strong> Message received/understood</li>
                    <li><strong>10-7:</strong> Out of service/on break</li>
                    <li><strong>10-8:</strong> In service/available</li>
                    <li><strong>10-20:</strong> What is your location?</li>
                    <li><strong>10-33:</strong> Emergency traffic (clear the channel)</li>
                    <li><strong>10-97:</strong> Arrived on scene</li>
                </ul>
                <h4>Code System:</h4>
                <ul>
                    <li><strong>Code 1:</strong> Non-emergency situation</li>
                    <li><strong>Code 2:</strong> Urgent but not emergency</li>
                    <li><strong>Code 3:</strong> Emergency - immediate response needed</li>
                </ul>
            `
        },
        {
            title: 'Professional Radio Etiquette',
            content: `
                <h3>Radio Professionalism</h3>
                <h4>Always Remember:</h4>
                <ul>
                    <li><strong>Never use profanity or slang</strong></li>
                    <li><strong>Avoid personal conversations</strong></li>
                    <li><strong>Keep transmissions brief</strong></li>
                    <li><strong>Use proper titles for supervisors</strong></li>
                    <li><strong>Maintain confidentiality</strong></li>
                    <li><strong>Don't eat, drink, or chew while transmitting</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-record-vinyl"></i> Everything is Recorded</h4>
                    <p>Everything you say on the radio can be heard by the entire team and <strong>may be recorded</strong>. These recordings can be used in legal proceedings, investigations, and performance reviews.</p>
                </div>
            `
        },
        {
            title: 'Incident Reporting Details',
            content: `
                <h3>Comprehensive Incident Reports</h3>
                <h4>What to Include:</h4>
                <ul>
                    <li><strong>Your Location:</strong> Be specific (Gate 3, Section B, Row 15)</li>
                    <li><strong>Nature of Incident:</strong> Brief, factual description</li>
                    <li><strong>Number of People Involved:</strong> Approximate count</li>
                    <li><strong>Injuries:</strong> Any medical concerns</li>
                    <li><strong>Assistance Needed:</strong> Supervisor, EMS, police, backup</li>
                    <li><strong>Updates:</strong> Inform of any changes in situation</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Example Reports:</h4>
                    <p><strong>Medical:</strong> <em>"Command, Gate 5. Code 3 medical. Female, approximately 25, conscious but injured. Requesting EMS."</em></p>
                    <p><strong>Disturbance:</strong> <em>"Command, Section C. Code 2. Two males arguing, situation escalating. Requesting backup."</em></p>
                    <p><strong>Resolved:</strong> <em>"Command, Section C. Situation resolved. Individuals separated and calm. 10-8."</em></p>
                </div>
            `
        },
        {
            title: 'Summary – Key Takeaways',
            content: `
                <h3>Radio Communications Summary</h3>
                <h4>Essential Points to Remember:</h4>
                <ul>
                    <li><strong>Radios = safety:</strong> Your lifeline in emergencies</li>
                    <li><strong>Chain of command matters:</strong> Report through proper channels</li>
                    <li><strong>Calm, clear, correct:</strong> Professional communication always</li>
                    <li><strong>Report early, report often:</strong> Don't wait until it's too late</li>
                    <li><strong>Practice makes permanent:</strong> Train like you'll operate</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> Your Safety Net</h4>
                    <p>Your radio is your safety net at all times. Master it, maintain it, and use it professionally.</p>
                </div>
            `
        },
        {
            title: 'Group Practice Exercise',
            content: `
                <h3>Verbal Relay Drill</h3>
                <p>Now it's time to practice what you've learned!</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-users"></i> Exercise Instructions</h4>
                    <p>Practice the following scenarios with proper radio protocol:</p>
                    <ol>
                        <li><strong>Check-in:</strong> Routine radio check with Base</li>
                        <li><strong>Incident Report:</strong> Report a suspicious person</li>
                        <li><strong>SITREP:</strong> Medical emergency with full details</li>
                        <li><strong>Update:</strong> Situation resolved, return to normal</li>
                    </ol>
                </div>
                <p><strong>Remember:</strong> Think before you key. Use proper format. Stay calm and clear.</p>
                <p>This is your live "exit ticket" before the assessment!</p>
            `
        },
        {
            title: 'Knowledge Check 1',
            content: `
                <h3>Quick Quiz Question 1</h3>
                <div class="slide-quiz" data-quiz-id="comm-q1">
                    <p class="slide-quiz-question">What is the proper order of a SITREP?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">What, Where, Who, When, What's Needed</div>
                        <div class="slide-quiz-option" data-answer="1" data-correct="true">Who, What, Where, When, What's Needed</div>
                        <div class="slide-quiz-option" data-answer="2">Where, What, Who, What's Needed, When</div>
                        <div class="slide-quiz-option" data-answer="3">When, Where, What, Who, What's Needed</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
            `
        },
        {
            title: 'Knowledge Check 2',
            content: `
                <h3>Quick Quiz Question 2</h3>
                <div class="slide-quiz" data-quiz-id="comm-q2">
                    <p class="slide-quiz-question">What should you say instead of "Repeat" on the radio?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">Again</div>
                        <div class="slide-quiz-option" data-answer="1" data-correct="true">Say again</div>
                        <div class="slide-quiz-option" data-answer="2">Repeat that</div>
                        <div class="slide-quiz-option" data-answer="3">Come back</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
                <p><strong>Why?</strong> "Repeat" is a military term meaning "fire again" and should never be used in radio communications.</p>
            `
        },
        {
            title: 'Knowledge Check 3',
            content: `
                <h3>Quick Quiz Question 3</h3>
                <div class="slide-quiz" data-quiz-id="comm-q3">
                    <p class="slide-quiz-question">Who should you report to first in a non-emergency situation?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">Event Manager</div>
                        <div class="slide-quiz-option" data-answer="1">Security Manager</div>
                        <div class="slide-quiz-option" data-answer="2" data-correct="true">Your immediate supervisor</div>
                        <div class="slide-quiz-option" data-answer="3">Any available supervisor</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
                <p><strong>Remember:</strong> Follow the chain of command to reduce radio clutter and ensure efficient operations.</p>
            `
        },
        {
            title: 'Knowledge Check 4',
            content: `
                <h3>Quick Quiz Question 4</h3>
                <div class="slide-quiz" data-quiz-id="comm-q4">
                    <p class="slide-quiz-question">An attendee is yelling at you about a policy. What should you do?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">Yell back to establish authority</div>
                        <div class="slide-quiz-option" data-answer="1">Immediately call for backup on radio</div>
                        <div class="slide-quiz-option" data-answer="2" data-correct="true">Stay calm, listen, and explain the policy professionally</div>
                        <div class="slide-quiz-option" data-answer="3">Walk away and ignore them</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
                <p><strong>Key Point:</strong> De-escalation and professional communication can resolve most conflicts without backup.</p>
            `
        },
        {
            title: 'Knowledge Check 5',
            content: `
                <h3>Quick Quiz Question 5</h3>
                <div class="slide-quiz" data-quiz-id="comm-q5">
                    <p class="slide-quiz-question">What should you do if your radio dies during your shift?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">Continue working and report it at end of shift</div>
                        <div class="slide-quiz-option" data-answer="1" data-correct="true">Immediately notify supervisor using backup communication method</div>
                        <div class="slide-quiz-option" data-answer="2">Go home since you can't communicate</div>
                        <div class="slide-quiz-option" data-answer="3">Borrow another guard's radio</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
                <p><strong>Remember:</strong> A working radio is essential for safety. Never operate without communication capability.</p>
            `
        },
        {
            title: 'Advanced: Radio Discipline',
            content: `
                <h3>Maintaining Radio Discipline</h3>
                <h4>What is Radio Discipline?</h4>
                <p>The practice of keeping radio channels clear and professional for operational effectiveness.</p>
                <h4>Best Practices:</h4>
                <ul>
                    <li><strong>Listen before transmitting:</strong> Don't interrupt ongoing traffic</li>
                    <li><strong>Keep messages brief:</strong> 30 seconds or less when possible</li>
                    <li><strong>Avoid unnecessary chatter:</strong> Save channel for important comms</li>
                    <li><strong>Use proper priority:</strong> Emergency traffic always goes first</li>
                    <li><strong>Acknowledge quickly:</strong> "Copy" is sufficient</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-volume-mute"></i> When to Stay Silent</h4>
                    <p>If you hear "10-33" or "Emergency traffic," immediately stop transmitting and keep the channel clear until the emergency is resolved.</p>
                </div>
            `
        },
        {
            title: 'Advanced: Multi-Channel Operations',
            content: `
                <h3>Working with Multiple Channels</h3>
                <p>Larger events may use multiple radio channels for different purposes.</p>
                <h4>Common Channel Setup:</h4>
                <ul>
                    <li><strong>Channel 1:</strong> Command/Operations (main channel)</li>
                    <li><strong>Channel 2:</strong> Tactical/Response teams</li>
                    <li><strong>Channel 3:</strong> Medical/EMS coordination</li>
                    <li><strong>Channel 4:</strong> Logistics/Support</li>
                </ul>
                <h4>Best Practices:</h4>
                <ul>
                    <li>Know which channel to use for what purpose</li>
                    <li>Monitor your assigned channel at all times</li>
                    <li>Switch channels only when directed</li>
                    <li>Announce when changing channels if required</li>
                </ul>
            `
        },
        {
            title: 'Real-World Application',
            content: `
                <h3>Putting It All Together</h3>
                <h4>A Complete Shift Timeline:</h4>
                <p><strong>Start of Shift:</strong> <em>"Post 1 to Base, 10-8 and ready at main entrance."</em></p>
                <p><strong>Hourly Check:</strong> <em>"Post 1 to Base, radio check. Nothing to report."</em></p>
                <p><strong>Incident:</strong> <em>"Post 1 to Base, SITREP. Two males fighting near concessions. Requesting backup."</em></p>
                <p><strong>Update:</strong> <em>"Post 1 to Base, situation under control. Subjects separated and escorted out."</em></p>
                <p><strong>Break:</strong> <em>"Post 1 to Base, requesting 10-7 for 15 minutes."</em></p>
                <p><strong>Return:</strong> <em>"Post 1 to Base, 10-8 and back at post."</em></p>
                <p><strong>End of Shift:</strong> <em>"Post 1 to Base, 10-7 end of shift. Post secured and clear."</em></p>
            `
        },
        {
            title: 'Module Summary',
            content: `
                <h3>Security Radio Communications - Complete</h3>
                <p>You've completed comprehensive training in security radio communications!</p>
                <h4>What You've Mastered:</h4>
                <ul>
                    <li><strong>Radio operation and etiquette</strong></li>
                    <li><strong>Essential codes and terminology</strong></li>
                    <li><strong>SITREP format for incident reporting</strong></li>
                    <li><strong>Chain of command protocols</strong></li>
                    <li><strong>Professional communication skills</strong></li>
                    <li><strong>Real-world scenario responses</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Module Complete!</h4>
                    <p><strong>"Radios keep you alive. Know yours."</strong></p>
                    <p>You're now ready to take the Module 1 Assessment to validate your knowledge.</p>
                </div>
            `
        },
        {
            title: 'Next Steps',
            content: `
                <h3>Ready for Assessment</h3>
                <p>You've completed all 21 slides of Security Radio Communications training.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-clipboard-check"></i> What's Next</h4>
                    <p>You'll now be directed to the <strong>Module 1 Assessment</strong> to test your knowledge of radio communications.</p>
                    <ul>
                        <li>10 questions covering all material</li>
                        <li>15 minutes to complete</li>
                        <li>70% required to pass</li>
                        <li>You can retake if needed</li>
                    </ul>
                </div>
                <p><strong>Preview of Module 2:</strong> STOP THE BLEED® Emergency Medical Response</p>
                <p class="hero-subtitle">You're cleared to switch channels—see you in Module 2!</p>
            `
        }
    ],
    'use-of-force': [
        {
            title: 'Legal Aspects & Use of Force',
            content: `
                <h3>Legal Aspects & Use of Force</h3>
                <p class="hero-subtitle">Maryland State Compliance – Title 19 & COMAR 12.07.01</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-balance-scale"></i> Module Overview</h4>
                    <p>Every action as a security guard must comply with state law. What you don't know CAN land you in court.</p>
                    <p><strong>Duration:</strong> 1.5 Hours | <strong>Slides:</strong> 15</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Critical Importance</h4>
                    <p>This is both a protection and accountability module. Know the rules, avoid the courtroom.</p>
                </div>
            `
        },
        {
            title: 'Module Objectives',
            content: `
                <h3>What You'll Learn</h3>
                <ul>
                    <li><strong>Understand Maryland law governing unarmed security officers</strong></li>
                    <li><strong>Define use of force and legal limits for unarmed personnel</strong></li>
                    <li><strong>Recognize civil liability, including §1983 awareness</strong></li>
                    <li><strong>Learn proper documentation and reporting practices</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> Key Message</h4>
                    <p><strong>"Know the rules, avoid the courtroom."</strong> This module protects you legally and professionally.</p>
                </div>
            `
        },
        {
            title: 'Maryland Public Safety Article §19',
            content: `
                <h3>Maryland Law Governing Security Guards</h3>
                <h4>Title 19 - Private Detectives and Security Guards:</h4>
                <ul>
                    <li><strong>Defines licensing, conduct, training</strong></li>
                    <li><strong>Authority boundaries:</strong> No detainment or arrest powers unless contracted LEO</li>
                    <li><strong>Revocation of license:</strong> For excessive force or misconduct</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-gavel"></i> Critical Distinction</h4>
                    <p><strong>"You are NOT police."</strong> You have the same legal authority as any private citizen.</p>
                </div>
                <p>Pull up or distribute a one-page excerpt of Title 19 for quick reading. Summarize key limits.</p>
            `
        },
        {
            title: 'COMAR 12.07.01 – Administrative Code for Guards',
            content: `
                <h3>Maryland Administrative Regulations</h3>
                <h4>COMAR 12.07.01 Defines:</h4>
                <ul>
                    <li><strong>Responsibilities of licensed agencies and guards</strong></li>
                    <li><strong>Training and certification tracking</strong></li>
                    <li><strong>Prohibited conduct and complaint procedures</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-clipboard-check"></i> Recordkeeping</h4>
                    <p><strong>"If it's not documented, it didn't happen."</strong> Stress recordkeeping. Tie this back to compliance modules and certification.</p>
                </div>
            `
        },
        {
            title: 'Defining Use of Force (UOF)',
            content: `
                <h3>What is Use of Force?</h3>
                <h4>Definition:</h4>
                <p><strong>Force = any physical interaction to control behavior</strong></p>
                <h4>Only legally acceptable when:</h4>
                <ul>
                    <li><strong>Proportionate</strong> to the threat</li>
                    <li><strong>Necessary</strong> for safety</li>
                    <li><strong>Within job scope</strong> and training</li>
                </ul>
                <h4>Maryland uses "reasonable person standard":</h4>
                <p>Would a reasonable person in the same situation believe force was necessary?</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-video"></i> Learning Tool</h4>
                    <p>Play short real-world video (if permitted) showing escalating behavior and debrief the decision-making process. Don't glamorize force.</p>
                </div>
            `
        },
        {
            title: 'Levels of Force (UOF Continuum)',
            content: `
                <h3>Use of Force Continuum - Visual Guide</h3>
                <h4>Authorized Levels for Unarmed Security:</h4>
                <ul>
                    <li><strong>Presence:</strong> Uniformed, professional appearance</li>
                    <li><strong>Verbal:</strong> Commands, directions, de-escalation</li>
                    <li><strong>Passive Control:</strong> Guiding, escorting without resistance</li>
                    <li><strong>Escort Techniques:</strong> Minimal contact, cooperative movement</li>
                </ul>
                <h4>NOT Authorized:</h4>
                <ul>
                    <li><strong>NO weapons</strong> (unless specially licensed)</li>
                    <li><strong>NO strikes</strong> (punches, kicks)</li>
                    <li><strong>NO takedowns</strong> (unless trained & authorized)</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Key Principle</h4>
                    <p><strong>"Force begins before contact—it starts with presence."</strong> Walk through each level.</p>
                </div>
            `
        },
        {
            title: 'Civil Liability & Title 42 §1983 Awareness',
            content: `
                <h3>Federal Civil Rights Liability</h3>
                <h4>Title 42 U.S.C. §1983:</h4>
                <p>Private officers can be sued under §1983 for acting "under color of law"</p>
                <h4>What This Means:</h4>
                <ul>
                    <li><strong>Civil rights violations = federal lawsuits</strong></li>
                    <li><strong>Most common triggers:</strong> Excessive force, unlawful detainment</li>
                    <li><strong>You can be personally liable</strong> - not just your employer</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-gavel"></i> Critical Warning</h4>
                    <p><strong>"If you act like a cop without authority, the law will treat you like one—including consequences."</strong> This is awareness-only. Emphasize the risk.</p>
                </div>
            `
        },
        {
            title: 'Detainment, Search, and Seizure Boundaries',
            content: `
                <h3>What You CANNOT Do</h3>
                <h4>No Arrest Powers:</h4>
                <p>You cannot arrest or detain people like police can</p>
                <h4>Detainment Must Be:</h4>
                <ul>
                    <li><strong>Short:</strong> Only until police arrive</li>
                    <li><strong>Specific:</strong> Clear reason (witnessed felony)</li>
                    <li><strong>Documented:</strong> Written report immediately</li>
                </ul>
                <h4>Search Restrictions:</h4>
                <ul>
                    <li><strong>NEVER search personal property</strong> unless policy allows</li>
                    <li><strong>Bag checks require consent</strong> - voluntary compliance only</li>
                    <li><strong>No pat-downs</strong> without specific authorization</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Scenario Example:</h4>
                    <p><strong>"What if someone shoplifts?"</strong> Walk them through correct response: observation, reporting, not confrontation.</p>
                </div>
            `
        },
        {
            title: 'When Force is NEVER Justified',
            content: `
                <h3>Prohibited Uses of Force</h3>
                <h4>Force is NEVER justified for:</h4>
                <ul>
                    <li><strong>Verbal disrespect:</strong> Insults, cursing, rude behavior</li>
                    <li><strong>Someone recording you:</strong> They have the right to film</li>
                    <li><strong>Non-violent refusal to comply:</strong> Call police instead</li>
                    <li><strong>Property damage alone:</strong> Without threat to people</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-circle"></i> Remember</h4>
                    <p><strong>"It's not illegal to insult you."</strong> Calmly emphasize that hurt feelings do not justify physical action.</p>
                </div>
            `
        },
        {
            title: 'Documentation: Incident & Use of Force Reports',
            content: `
                <h3>Proper Documentation</h3>
                <h4>What to Include:</h4>
                <ul>
                    <li><strong>Time, location, witnesses</strong></li>
                    <li><strong>Subject's behavior:</strong> Specific actions observed</li>
                    <li><strong>Verbal warnings given:</strong> What you said</li>
                    <li><strong>Exact force used & timeline:</strong> Step-by-step</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-clipboard-list"></i> Practice Exercise</h4>
                    <p>Provide example of a UOF report. Make students rewrite a sample poorly-written one using proper language.</p>
                </div>
            `
        },
        {
            title: 'Working With Law Enforcement Post-Incident',
            content: `
                <h3>Cooperating with Police</h3>
                <h4>Best Practices:</h4>
                <ul>
                    <li><strong>Be honest, concise</strong></li>
                    <li><strong>Only speak to what you directly observed</strong></li>
                    <li><strong>Provide written report immediately if required</strong></li>
                    <li><strong>Don't embellish or speculate</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-pen"></i> Key Instruction</h4>
                    <p><strong>"Don't try to be a hero in your report. Just state what happened."</strong></p>
                </div>
            `
        },
        {
            title: 'False Imprisonment and Overreach',
            content: `
                <h3>Avoiding False Imprisonment</h3>
                <h4>False Imprisonment Defined:</h4>
                <p>Holding someone without authority = criminal and civil liability</p>
                <h4>Rules:</h4>
                <ul>
                    <li><strong>Always call law enforcement</strong> for detainment beyond a few minutes</li>
                    <li><strong>Security should never transport detainees</strong></li>
                    <li><strong>Document everything</strong> if you must briefly detain</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-handcuffs"></i> The Line</h4>
                    <p><strong>"If you put someone in cuffs, you better have called someone with a badge."</strong></p>
                </div>
            `
        },
        {
            title: 'Case Study: Use of Force Gone Wrong',
            content: `
                <h3>Real-World Lawsuit Example</h3>
                <h4>Case Study:</h4>
                <p>Real-world lawsuit example (e.g., mall security overreach)</p>
                <h4>Outcome:</h4>
                <ul>
                    <li>Officer fired</li>
                    <li>Company sued for $500,000+</li>
                    <li>Victim hospitalized</li>
                    <li>Officer personally liable</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Discussion:</h4>
                    <p><strong>"What would you have done differently?"</strong> Open this up for discussion, but guide it firmly.</p>
                </div>
            `
        },
        {
            title: 'Scenario Practice: Write a Report',
            content: `
                <h3>Practice Exercise</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-file-alt"></i> Scenario Provided:</h4>
                    <p>Patron refuses to leave, gets agitated</p>
                </div>
                <h4>Write a short report:</h4>
                <ul>
                    <li>What did you see?</li>
                    <li>What did you do?</li>
                    <li>How did you resolve it?</li>
                </ul>
                <p><strong>Think through your response:</strong> Split the class into groups or individuals and have them write a brief narrative. Collect and review or walk through a sample live.</p>
            `
        },
        {
            title: 'Final Slide: Legal Reminder & Duty of Care',
            content: `
                <h3>Your Professional Duty</h3>
                <h4>Remember:</h4>
                <ul>
                    <li><strong>You are a guardian, not a warrior</strong></li>
                    <li><strong>The law protects professionalism</strong></li>
                    <li><strong>Your job: Observe, Report, Protect—Not Punish</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> Evenfall Advantage Ethos</h4>
                    <p>End with strong affirmation of what it means to be professional. Tie it into the Evenfall Advantage ethos.</p>
                </div>
                <p><strong>Next Step:</strong> Take the Module 7 Assessment to test your understanding of legal boundaries and use of force.</p>
            `
        }
    ],
    'stop-the-bleed': [
        {
            title: 'STOP THE BLEED® – Emergency Medical Response',
            content: `
                <h3>STOP THE BLEED® – Emergency Medical Response</h3>
                <p class="hero-subtitle">You don't need to be a medic to save a life</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-hand-holding-medical"></i> Module Overview</h4>
                    <p>Welcome to the most life-saving module in this course. This training empowers you to control severe bleeding and save lives in the critical minutes before EMS arrives.</p>
                    <p><strong>Duration:</strong> 2 Hours | <strong>Slides:</strong> 20</p>
                    <p><strong>Certification:</strong> STOP THE BLEED® Completion Certificate</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Critical Importance</h4>
                    <p>You may be the only responder until EMS arrives. This module makes you capable of saving a life.</p>
                </div>
            `
        },
        {
            title: 'Learning Objectives',
            content: `
                <h3>What You'll Learn</h3>
                <ul>
                    <li><strong>Recognize life-threatening bleeding</strong></li>
                    <li><strong>Apply pressure, pack wounds, and use tourniquets</strong></li>
                    <li><strong>Act with confidence in chaotic environments</strong></li>
                    <li><strong>Understand when and how to call for help</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-heartbeat"></i> Your Critical Role</h4>
                    <p>You may be the only responder until EMS arrives. This module makes you capable of being the difference between someone bleeding out—or surviving.</p>
                </div>
            `
        },
        {
            title: 'Why We Train',
            content: `
                <h3>The Critical Need for STOP THE BLEED®</h3>
                <h4>Life-Threatening Statistics:</h4>
                <ul>
                    <li><strong>Bleeding is the #1 preventable cause of death in trauma</strong></li>
                    <li><strong>Victims can die in under 5 minutes</strong></li>
                    <li><strong>EMS may take 10+ minutes to arrive</strong> in crowded events</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Real-World Examples</h4>
                    <p>Las Vegas shooting, Astroworld tragedy, and countless other incidents show that immediate bystander intervention saves lives. Professional help takes time—you are the first line of defense.</p>
                </div>
                <p><strong>You are the difference between someone bleeding out—or surviving.</strong></p>
            `
        },
        {
            title: 'Identify Life-Threatening Bleeding',
            content: `
                <h3>Recognizing Life-Threatening Bleeding</h3>
                <h4>Critical Signs (ABC):</h4>
                <ul>
                    <li><strong>Alert:</strong> Spurting or pooling blood</li>
                    <li><strong>Bleeding:</strong> Soaked clothing</li>
                    <li><strong>Compress:</strong> Bandages ineffective</li>
                </ul>
                <h4>Additional Warning Signs:</h4>
                <ul>
                    <li>Loss of limb or deep laceration</li>
                    <li>Victim is pale, confused, or unconscious</li>
                    <li>Blood won't stop with basic pressure</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-eye"></i> Remember ABC</h4>
                    <p><strong>Alert, Bleeding, Compress</strong> - This acronym helps you quickly assess and act on life-threatening bleeding.</p>
                </div>
            `
        },
        {
            title: 'Scene Safety & Personal Protection',
            content: `
                <h3>Protect Yourself First</h3>
                <h4>Scene Safety:</h4>
                <ul>
                    <li><strong>Ensure scene is safe before approaching</strong></li>
                    <li>Look for ongoing threats, weapons, hazards</li>
                    <li>Assess for fire, structural damage, or active danger</li>
                </ul>
                <h4>Personal Protection:</h4>
                <ul>
                    <li><strong>Wear gloves if available</strong> (nitrile or latex)</li>
                    <li><strong>Use barriers or clothing</strong> if gloves not available</li>
                    <li>Avoid direct contact with blood</li>
                    <li>Wash hands thoroughly after care</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> Critical Rule</h4>
                    <p><strong>"Do not become a second victim."</strong> If the scene is unsafe, wait for law enforcement. You can't help anyone if you're injured.</p>
                </div>
            `
        },
        {
            title: 'The 3-Step Response',
            content: `
                <h3>Three Steps to Stop Bleeding</h3>
                <h4>Step 1: Apply Pressure</h4>
                <p>Direct pressure is your first and most important tool</p>
                <h4>Step 2: Pack the Wound (if needed)</h4>
                <p>For deep wounds where tourniquets can't be used</p>
                <h4>Step 3: Apply a Tourniquet (if bleeding continues)</h4>
                <p>For arterial bleeding from limbs that won't stop</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-hand-holding-medical"></i> Today's Training</h4>
                    <p>We'll practice all three techniques. By the end of this module, you'll be confident in your ability to save a life.</p>
                </div>
            `
        },
        {
            title: 'Direct Pressure',
            content: `
                <h3>Direct Pressure Technique</h3>
                <h4>How to Apply:</h4>
                <ul>
                    <li><strong>Use hands or knee</strong> - Whatever provides firm pressure</li>
                    <li><strong>Apply firmly and don't let up</strong> - Maintain constant pressure</li>
                    <li><strong>Maintain until EMS arrives</strong> or you can transition to next step</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-hand-rock"></i> Key Principle</h4>
                    <p><strong>"Direct pressure buys time."</strong> You can't push too hard—the real danger is not pushing hard enough or releasing too soon.</p>
                </div>
                <p><strong>Instructor Demo:</strong> Use props or pillows to demonstrate proper pressure application.</p>
            `
        },
        {
            title: 'Wound Packing',
            content: `
                <h3>Wound Packing for Deep Injuries</h3>
                <h4>When to Use:</h4>
                <p>Deep wounds, junctional areas (neck, groin, armpit) where tourniquets can't be applied</p>
                <h4>Technique:</h4>
                <ul>
                    <li><strong>Insert gauze or cloth into deep wounds</strong></li>
                    <li><strong>Fill until no more can fit</strong> - Pack it completely</li>
                    <li><strong>Apply pressure on top</strong> - Maintain firm pressure</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-hand-holding-medical"></i> Get Over the Discomfort</h4>
                    <p><strong>"You're filling the cavity."</strong> This will be uncomfortable for the victim, but it's saving their life. Don't be gentle—be effective.</p>
                </div>
                <p><strong>Practice:</strong> Use simulated wounds or pool noodles to practice packing technique.</p>
            `
        },
        {
            title: 'Tourniquet Application',
            content: `
                <h3>Tourniquet - The Life-Saver</h3>
                <h4>When to Use:</h4>
                <p>Arterial bleeding from arm or leg that won't stop with pressure. If it's spurting—apply tourniquet immediately.</p>
                <h4>How to Apply:</h4>
                <ul>
                    <li><strong>High and tight:</strong> 2–3 inches above wound</li>
                    <li><strong>Never on a joint</strong> - Must be on solid bone</li>
                    <li><strong>Tighten until bleeding stops</strong>, not just slows</li>
                    <li><strong>Time-mark the application</strong> - Write time on tourniquet or forehead</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Critical Points</h4>
                    <p>It WILL hurt—that's normal. Tighten until bleeding completely stops. Never remove once applied—only trained medics can remove it.</p>
                </div>
            `
        },
        {
            title: 'Improvised Tools',
            content: `
                <h3>Improvised Bleeding Control</h3>
                <h4>What Works:</h4>
                <ul>
                    <li><strong>T-shirt:</strong> Can be used for wound packing</li>
                    <li><strong>Wooden spoon or stick:</strong> Windlass substitute (last resort)</li>
                    <li><strong>Clean cloth:</strong> Better than nothing for pressure</li>
                </ul>
                <h4>What DOESN'T Work:</h4>
                <ul>
                    <li><strong>Belt = NOT a tourniquet</strong> - Too wide, won't provide enough pressure</li>
                    <li>Shoelaces, rope - Not effective</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-tools"></i> Remember</h4>
                    <p><strong>"MacGyver is not better than medical-grade."</strong> Use real equipment when possible. Improvised tools are last resort only.</p>
                </div>
            `
        },
        {
            title: 'Calling for Help',
            content: `
                <h3>Activating Emergency Response</h3>
                <h4>How to Call for Help:</h4>
                <ul>
                    <li><strong>Activate 911 or venue EMS immediately</strong></li>
                    <li><strong>Say:</strong> "Life-threatening bleeding at [specific location]"</li>
                    <li><strong>Assign someone to meet first responders</strong></li>
                    <li>Provide updates as situation changes</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-phone-alt"></i> Critical Rule</h4>
                    <p><strong>"Don't assume someone else called. Delegate out loud."</strong> Point to a specific person and say "You—call 911 now."</p>
                </div>
            `
        },
        {
            title: 'EMS Transition',
            content: `
                <h3>Handing Off to Professionals</h3>
                <h4>When EMS Arrives:</h4>
                <ul>
                    <li><strong>Leave tourniquet in place</strong> - Never remove it</li>
                    <li><strong>Give exact time it was applied</strong> - This is critical information</li>
                    <li><strong>Do NOT remove unless trained medic directs you</strong></li>
                    <li>Provide brief report of what you did</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Life-Threatening Warning</h4>
                    <p><strong>"Removing a tourniquet can kill someone."</strong> Only trained medical professionals should remove tourniquets. Your job is to apply and document—not remove.</p>
                </div>
            `
        },
        {
            title: 'Hands-On: Gloving & Pressure',
            content: `
                <h3>Practice Session 1: Gloving & Direct Pressure</h3>
                <h4>Exercise Instructions:</h4>
                <ol>
                    <li><strong>Practice putting on gloves fast</strong> - Speed matters in emergencies</li>
                    <li><strong>Apply pressure to mock wounds</strong> - Use training aids or pillows</li>
                    <li><strong>Maintain pressure for 3 minutes</strong> - Build endurance</li>
                </ol>
                <div class="slide-callout">
                    <h4><i class="fas fa-hands"></i> Training Focus</h4>
                    <p>Encourage realism, speed, and communication. Practice like you'll perform. Talk through your actions as you work.</p>
                </div>
                <p><strong>Equipment:</strong> Gloves, rags or dummy limbs, timer</p>
            `
        },
        {
            title: 'Hands-On: Wound Packing',
            content: `
                <h3>Practice Session 2: Wound Packing</h3>
                <h4>Exercise Instructions:</h4>
                <ol>
                    <li><strong>Use gauze + pool noodle or foam blocks</strong></li>
                    <li><strong>Practice insertion, packing, and pressure</strong></li>
                    <li><strong>Fill the wound completely</strong> - Don't leave gaps</li>
                    <li>Apply pressure over packed wound</li>
                </ol>
                <div class="slide-callout">
                    <h4><i class="fas fa-hand-holding-medical"></i> Key Concept</h4>
                    <p><strong>"Think: plug the leak."</strong> You're filling the cavity to stop internal bleeding. Pack firmly and deeply.</p>
                </div>
                <p><strong>Instructor:</strong> Circle class to assess technique and provide feedback.</p>
            `
        },
        {
            title: 'Hands-On: Tourniquet Application',
            content: `
                <h3>Practice Session 3: Tourniquet Application</h3>
                <h4>Exercise Instructions:</h4>
                <ol>
                    <li><strong>Instructor demonstrates first</strong> - Show proper placement and tightening</li>
                    <li><strong>Students apply to dummy limbs or partners</strong></li>
                    <li><strong>Must verbalize:</strong> "Tight, bleeding stopped, mark time"</li>
                    <li>Practice time-marking technique</li>
                </ol>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Success Criteria</h4>
                    <p>Confirm proper tightness and placement. Walk to each student pair individually if needed. This is the most critical skill.</p>
                </div>
            `
        },
        {
            title: 'Scenario 1 – Crowd Incident',
            content: `
                <h3>Practice Scenario: Festival Bleeding Injury</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-user-injured"></i> Scenario</h4>
                    <p>You're working security at an outdoor festival. A patron has suffered a severe leg injury from broken glass. Blood is spurting from their thigh. The crowd is panicking and pushing.</p>
                </div>
                <div class="slide-interactive">
                    <h4>Discussion Questions:</h4>
                    <p><strong>Who steps in? What's your first action?</strong></p>
                    <p><strong>What do you say to the crowd?</strong></p>
                    <p><strong>What bleeding control technique do you use?</strong></p>
                </div>
                <p><strong>Practice:</strong> Verbal commands and action sequence. Work through the scenario as a class.</p>
            `
        },
        {
            title: 'Scenario 2 – Armed Subject Aftermath',
            content: `
                <h3>Practice Scenario: Post-Incident Victim</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-ambulance"></i> Scenario</h4>
                    <p>An active threat has been neutralized. You find a victim collapsed near the exit gate with severe bleeding from the arm. People are yelling, sirens are approaching, and you're experiencing sensory overload.</p>
                </div>
                <div class="slide-interactive">
                    <h4>Challenge:</h4>
                    <p><strong>How do you act fast under extreme stress?</strong></p>
                    <p><strong>What's your priority sequence?</strong></p>
                    <p><strong>How do you manage the chaos around you?</strong></p>
                </div>
                <p><strong>Instructor:</strong> Simulate sensory overload—bleeding, confusion, yelling. Test students' ability to focus and act.</p>
            `
        },
        {
            title: 'Psychological First Aid',
            content: `
                <h3>Communicating with the Victim</h3>
                <h4>How to Provide Psychological Support:</h4>
                <ul>
                    <li><strong>Stay calm, be direct</strong> - Your composure calms them</li>
                    <li><strong>Reassure the victim:</strong> "I'm here. Help is on the way."</li>
                    <li><strong>Give short, clear instructions</strong> - "Hold still. I'm stopping the bleeding."</li>
                    <li>Maintain eye contact when possible</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-comments"></i> Your Tone Matters</h4>
                    <p><strong>"Your tone becomes their lifeline."</strong> Say less. Do more. Confidence and calmness are contagious.</p>
                </div>
            `
        },
        {
            title: 'STOP THE BLEED® Quiz',
            content: `
                <h3>Knowledge Check</h3>
                <div class="slide-quiz" data-quiz-id="stb-q1">
                    <p class="slide-quiz-question">What are the 3 ways to stop bleeding?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">Call 911, wait, and watch</div>
                        <div class="slide-quiz-option" data-answer="1" data-correct="true">Apply pressure, pack the wound, apply tourniquet</div>
                        <div class="slide-quiz-option" data-answer="2">Elevate, ice, and bandage</div>
                        <div class="slide-quiz-option" data-answer="3">Clean, cover, and transport</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
            `
        },
        {
            title: 'Module Summary',
            content: `
                <h3>STOP THE BLEED® Training Complete</h3>
                <p><strong>"Bleeding control is leadership under pressure."</strong></p>
                <h4>What You've Mastered:</h4>
                <ul>
                    <li><strong>Recognize life-threatening bleeding</strong> - ABC method</li>
                    <li><strong>Apply direct pressure</strong> - Your first tool</li>
                    <li><strong>Pack wounds effectively</strong> - For deep injuries</li>
                    <li><strong>Apply tourniquets correctly</strong> - High, tight, and time-marked</li>
                    <li><strong>Scene safety and personal protection</strong></li>
                    <li><strong>Call for help effectively</strong></li>
                    <li><strong>Act with confidence under pressure</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-certificate"></i> Certification Earned</h4>
                    <p>You're now trained to stop the #1 preventable trauma death. You have the knowledge and skills to save a life.</p>
                </div>
            `
        },
        {
            title: 'Next Steps & Certification',
            content: `
                <h3>Your STOP THE BLEED® Certification</h3>
                <p>Congratulations! You've completed STOP THE BLEED® training.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-award"></i> Certification Details</h4>
                    <ul>
                        <li>STOP THE BLEED® Completion Certificate awarded</li>
                        <li>Included in all Modified State Courses (MSC)</li>
                        <li>Valid for employment and documentation</li>
                        <li>Practice monthly to maintain proficiency</li>
                    </ul>
                </div>
                <h4>Ongoing Practice:</h4>
                <ul>
                    <li>Practice tourniquet application monthly</li>
                    <li>Know where STOP THE BLEED® kits are located at your venue</li>
                    <li>Review techniques before each shift</li>
                    <li>Be ready to act when seconds count</li>
                </ul>
                <p><strong>Next Module:</strong> Module 3 - Threat Assessment & Situational Awareness</p>
            `
        }
    ],
    'diverse-population': [
        {
            title: 'Interacting with Diverse Populations',
            content: `
                <h3>Interacting with Diverse Populations</h3>
                <p class="hero-subtitle">Maryland Compliance Focus</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-users"></i> Module Overview</h4>
                    <p>This training reflects MD state law and POST-required learning objectives. Professional security means serving everyone with respect and dignity.</p>
                    <p><strong>Duration:</strong> 1 Hour | <strong>Slides:</strong> 14</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-handshake"></i> Core Principle</h4>
                    <p><strong>Respect, Awareness, Accessibility, Communication, Fairness</strong> - These are the foundations of inclusive security.</p>
                </div>
            `
        },
        {
            title: 'Learning Objectives',
            content: `
                <h3>What You'll Learn</h3>
                <ul>
                    <li><strong>Define bias and prejudice</strong></li>
                    <li><strong>Identify appropriate methods of communication and de-escalation</strong></li>
                    <li><strong>Identify how to interact with a diverse population</strong></li>
                    <li><strong>Identify the importance of treating others with respect</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-balance-scale"></i> Legal and Professional Standards</h4>
                    <p>These objectives relate directly to Maryland state requirements and professional security standards.</p>
                </div>
            `
        },
        {
            title: 'What is a Diverse Population?',
            content: `
                <h3>Understanding Diversity</h3>
                <h4>Definition:</h4>
                <p>A diverse population includes people of different:</p>
                <ul>
                    <li><strong>Race and ethnicity</strong></li>
                    <li><strong>Religion and belief systems</strong></li>
                    <li><strong>Gender identity and sexual orientation</strong></li>
                    <li><strong>Age and generational differences</strong></li>
                    <li><strong>Physical and cognitive abilities</strong></li>
                    <li><strong>Language and cultural backgrounds</strong></li>
                    <li><strong>Socioeconomic status</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-map-marked-alt"></i> Maryland Demographics</h4>
                    <p>Maryland is one of the most diverse states. You will encounter people from all backgrounds on your shift.</p>
                </div>
            `
        },
        {
            title: 'Respect in the Security Role',
            content: `
                <h3>Treating All Persons with Dignity</h3>
                <h4>Why Respect Matters:</h4>
                <ul>
                    <li><strong>Respect is operational</strong> - It's how we gain compliance without conflict</li>
                    <li><strong>Non-escalatory posture</strong> - Respect prevents situations from escalating</li>
                    <li><strong>Legal requirement</strong> - Discrimination violates civil rights laws</li>
                    <li><strong>Professional standard</strong> - Your actions represent your employer</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-handshake"></i> Core Principle</h4>
                    <p><strong>"Security isn't about sameness—it's about skill in difference."</strong> Professional service means adapting your approach while maintaining standards.</p>
                </div>
            `
        },
        {
            title: 'Defining Bias & Prejudice',
            content: `
                <h3>Understanding Bias and Prejudice</h3>
                <h4>Unconscious Bias:</h4>
                <p>Automatic, unconscious attitudes that affect our decisions without us realizing it. Everyone has biases.</p>
                <h4>Prejudice:</h4>
                <p>Preconceived negative judgment about a person or group based on characteristics like race, religion, or gender.</p>
                <h4>Impact on Security Decisions:</h4>
                <ul>
                    <li><strong>Use of force:</strong> Bias can lead to excessive force against certain groups</li>
                    <li><strong>Perception of threat:</strong> Seeing danger where none exists</li>
                    <li><strong>Unequal treatment:</strong> Applying different standards to different people</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Self-Reflection:</h4>
                    <p><strong>"Have you ever made an assumption that turned out wrong?"</strong> Recognizing our biases is the first step to overcoming them.</p>
                </div>
            `
        },
        {
            title: 'Bias in Real Situations',
            content: `
                <h3>How Bias Escalates Situations</h3>
                <h4>Real-World Consequences:</h4>
                <ul>
                    <li><strong>Job loss:</strong> Discriminatory actions lead to termination</li>
                    <li><strong>Lawsuits:</strong> Civil rights violations result in costly litigation</li>
                    <li><strong>Criminal charges:</strong> Assault, false imprisonment, civil rights violations</li>
                    <li><strong>Reputation damage:</strong> To you, your employer, and the profession</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Critical Question</h4>
                    <p><strong>"How fast can bias escalate a situation—and cost you your job?"</strong></p>
                    <p>One biased decision can end your career and harm innocent people.</p>
                </div>
            `
        },
        {
            title: 'ADA and Disabilities',
            content: `
                <h3>Working with People with Disabilities</h3>
                <p>The Americans with Disabilities Act (ADA) requires accessibility and reasonable accommodations.</p>
                <h4>Service Animals:</h4>
                <p>You may ONLY ask two questions:</p>
                <ul>
                    <li>"Is this a service animal?"</li>
                    <li>"What task is it trained to perform?"</li>
                </ul>
                <p><strong>You CANNOT ask:</strong> About the disability, for certification, or to see documentation.</p>
                <h4>Mobility Devices:</h4>
                <ul>
                    <li>Never touch a wheelchair without permission</li>
                    <li>Ensure accessible routes and seating</li>
                    <li>Speak directly to the person, not their companion</li>
                </ul>
                <h4>Communication:</h4>
                <ul>
                    <li><strong>Hearing impaired:</strong> Face them, speak clearly, use written notes</li>
                    <li><strong>Visual impaired:</strong> Offer verbal directions, describe surroundings</li>
                    <li><strong>Cognitive disabilities:</strong> Be patient, use simple language</li>
                </ul>
            `
        },
        {
            title: 'Communication Across Differences',
            content: `
                <h3>Effective Communication Across Cultures</h3>
                <h4>Verbal Communication:</h4>
                <ul>
                    <li><strong>Clear, neutral tone:</strong> Speak slowly and evenly</li>
                    <li><strong>Avoid slang or assumptions:</strong> Use plain language</li>
                    <li><strong>Simple language:</strong> Especially with non-English speakers</li>
                    <li><strong>Be patient:</strong> Allow time for understanding</li>
                </ul>
                <h4>Non-Verbal Communication:</h4>
                <ul>
                    <li><strong>Personal space:</strong> Norms vary by culture</li>
                    <li><strong>Eye contact:</strong> Some cultures view it as disrespectful</li>
                    <li><strong>Gestures:</strong> Can have different meanings across cultures</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-comments"></i> Key Principle</h4>
                    <p><strong>"Security's job is to be heard and respected—not necessarily liked."</strong> Professional communication achieves compliance without conflict.</p>
                </div>
            `
        },
        {
            title: 'De-Escalation Tools Across Cultures',
            content: `
                <h3>Culturally Sensitive De-Escalation</h3>
                <h4>Time, Distance, Cover:</h4>
                <ul>
                    <li><strong>Time:</strong> Allow emotions to cool - some cultures process conflict differently</li>
                    <li><strong>Distance:</strong> Respect personal space boundaries</li>
                    <li><strong>Cover:</strong> Use barriers to reduce tension</li>
                </ul>
                <h4>Cultural Considerations:</h4>
                <ul>
                    <li><strong>Respecting silence:</strong> Not everyone responds immediately</li>
                    <li><strong>Volume:</strong> Loud voices may be cultural, not aggressive</li>
                    <li><strong>Gestures:</strong> What seems threatening may be normal expression</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Discussion:</h4>
                    <p><strong>"What's your go-to move to de-escalate someone heated?"</strong> Consider how cultural differences might affect your approach.</p>
                </div>
            `
        },
        {
            title: 'Respecting Differences in Practice',
            content: `
                <h3>Practical Application</h3>
                <h4>Best Practices:</h4>
                <ul>
                    <li><strong>Don't interrupt or mock:</strong> Listen actively and respectfully</li>
                    <li><strong>Understand context:</strong> Mental health, culture, language barriers</li>
                    <li><strong>Ask, don't assume:</strong> When unsure, respectfully inquire</li>
                    <li><strong>Adapt your approach:</strong> One size doesn't fit all</li>
                </ul>
                <h4>Religious and Cultural Dress:</h4>
                <ul>
                    <li>Hijabs, turbans, yarmulkes must be respected</li>
                    <li>Screen without requiring removal when possible</li>
                    <li>Offer private screening if needed</li>
                    <li>Never mock or comment on religious dress</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> Remember</h4>
                    <p><strong>"Security doesn't mean control—it means protection, even from misunderstanding."</strong></p>
                </div>
            `
        },
        {
            title: 'Interacting With Persons in Crisis',
            content: `
                <h3>Special Considerations</h3>
                <h4>People in Mental Distress:</h4>
                <ul>
                    <li><strong>Stay calm:</strong> Your composure influences theirs</li>
                    <li><strong>Don't argue with delusions:</strong> Redirect gently</li>
                    <li><strong>Give space:</strong> Don't crowd or corner</li>
                    <li><strong>Call for mental health professionals:</strong> When available</li>
                </ul>
                <h4>People with Physical Disabilities:</h4>
                <ul>
                    <li><strong>Speak directly to them:</strong> Not their companion</li>
                    <li><strong>Never touch mobility devices:</strong> Without permission</li>
                    <li><strong>Offer assistance:</strong> Don't assume they need it</li>
                    <li><strong>Be patient:</strong> Communication may take longer</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Critical Point</h4>
                    <p><strong>"What you say can either calm or inflame. Be careful."</strong> Your words have power in crisis situations.</p>
                </div>
            `
        },
        {
            title: 'Scenario: Non-English Speaker at Exit Gate',
            content: `
                <h3>Practice Scenario</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-user"></i> Scenario</h4>
                    <p>A person who doesn't speak English is trying to exit through a restricted gate. They seem confused and frustrated. You need to redirect them to the proper exit.</p>
                </div>
                <div class="slide-interactive">
                    <h4>Your Response:</h4>
                    <p><strong>What's your next step?</strong></p>
                    <ul>
                        <li>How do you communicate without a shared language?</li>
                        <li>What tone and body language do you use?</li>
                        <li>How do you show respect while enforcing the rule?</li>
                        <li>What tools can help (gestures, translation app, another staff member)?</li>
                    </ul>
                    <p><strong>Think through your approach before continuing.</strong></p>
                </div>
            `
        },
        {
            title: 'Debrief: What Did You See or Miss?',
            content: `
                <h3>Scenario Analysis</h3>
                <h4>Effective Approaches:</h4>
                <ul>
                    <li><strong>Use gestures and pointing:</strong> Universal communication</li>
                    <li><strong>Stay calm and patient:</strong> Frustration escalates situations</li>
                    <li><strong>Find someone who speaks their language:</strong> If possible</li>
                    <li><strong>Use translation app:</strong> Technology can bridge gaps</li>
                    <li><strong>Show, don't just tell:</strong> Walk them to the correct exit</li>
                </ul>
                <h4>What to Avoid:</h4>
                <ul>
                    <li>Raising your voice (they're not deaf, they don't speak English)</li>
                    <li>Getting frustrated or impatient</li>
                    <li>Making them feel stupid or unwelcome</li>
                    <li>Using force when communication would work</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-lightbulb"></i> Key Lesson</h4>
                    <p>Patience and creativity solve problems that force cannot.</p>
                </div>
            `
        },
        {
            title: 'Reporting Without Bias',
            content: `
                <h3>Professional Documentation</h3>
                <h4>What to Include:</h4>
                <ul>
                    <li><strong>Objective facts:</strong> What you saw and heard</li>
                    <li><strong>Specific behaviors:</strong> Actions, not assumptions</li>
                    <li><strong>Relevant descriptions:</strong> Only when necessary for identification</li>
                    <li><strong>Timeline:</strong> When events occurred</li>
                </ul>
                <h4>What NOT to Include:</h4>
                <ul>
                    <li><strong>Commentary:</strong> "He looked suspicious"</li>
                    <li><strong>Speculation:</strong> "I think he was going to..."</li>
                    <li><strong>Stereotypes:</strong> References to race, religion without relevance</li>
                    <li><strong>Personal opinions:</strong> Your feelings about the person</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-clipboard-check"></i> Sample Comparison</h4>
                    <p><strong>Bad:</strong> "Suspicious Middle Eastern male loitering"</p>
                    <p><strong>Good:</strong> "Male, approximately 30s, pacing near entrance for 15 minutes, repeatedly checking phone, avoiding eye contact with security"</p>
                </div>
            `
        },
        {
            title: 'Implicit Bias and Profiling',
            content: `
                <h3>Recognizing and Overcoming Bias</h3>
                <h4>What is Implicit Bias?</h4>
                <p>Unconscious attitudes that affect our actions without us realizing it.</p>
                <h4>Racial Profiling is ILLEGAL:</h4>
                <ul>
                    <li>Never base security decisions on race alone</li>
                    <li>Focus on behavior, not appearance</li>
                    <li>Apply the same standards to everyone</li>
                    <li>Recognize when bias may be influencing you</li>
                </ul>
                <h4>Behavior-Based Security:</h4>
                <p>Look for suspicious <strong>actions</strong>, not suspicious <strong>people</strong>:</p>
                <ul>
                    <li>Nervous behavior inconsistent with environment</li>
                    <li>Avoiding security or eye contact</li>
                    <li>Unusual interest in security measures</li>
                    <li>Inappropriate clothing for weather/event</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Critical Point</h4>
                    <p>Profiling based on race, religion, or ethnicity is discrimination and can result in lawsuits, job loss, and criminal charges.</p>
                </div>
            `
        },
        {
            title: 'LGBTQ+ Inclusion',
            content: `
                <h3>Respecting Gender Identity and Sexual Orientation</h3>
                <h4>Best Practices:</h4>
                <ul>
                    <li>Use the name and pronouns people request</li>
                    <li>Don't make assumptions about gender or relationships</li>
                    <li>Treat all couples equally regardless of gender</li>
                    <li>Respect privacy - don't ask invasive questions</li>
                    <li>Intervene if you witness harassment</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-heart"></i> Simple Rule</h4>
                    <p>If someone tells you their name is Alex and uses they/them pronouns, use Alex and they/them. It's that simple. Respect costs nothing.</p>
                </div>
            `
        },
        {
            title: 'Handling Discrimination',
            content: `
                <h3>Zero Tolerance for Discrimination</h3>
                <h4>If You Witness Discrimination or Harassment:</h4>
                <ol>
                    <li><strong>Intervene immediately</strong> - Stop the behavior</li>
                    <li><strong>Support the victim</strong> - Offer assistance and empathy</li>
                    <li><strong>Document the incident</strong> - Record details while fresh</li>
                    <li><strong>Report to supervisors</strong> - All incidents must be reported</li>
                </ol>
                <h4>Never:</h4>
                <ul>
                    <li>Participate in discriminatory jokes or comments</li>
                    <li>Ignore harassment even if the victim doesn't complain</li>
                    <li>Make excuses for discriminatory behavior</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> Your Duty</h4>
                    <p>As security, you have a responsibility to protect everyone - including from discrimination and harassment.</p>
                </div>
            `
        },
        {
            title: 'Summary & Assessment Reminder',
            content: `
                <h3>Module Summary</h3>
                <h4>Key Takeaways:</h4>
                <ul>
                    <li><strong>Everyone deserves respect</strong> - No exceptions</li>
                    <li><strong>Define bias and prejudice</strong> - Recognize unconscious attitudes</li>
                    <li><strong>Communication and de-escalation</strong> - Adapt to cultural differences</li>
                    <li><strong>Interact professionally</strong> - With all diverse populations</li>
                    <li><strong>Behavior, not appearance</strong> - Focus on actions</li>
                    <li><strong>Racial profiling is illegal</strong> - And morally wrong</li>
                    <li><strong>Report without bias</strong> - Objective facts only</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-quote-left"></i> Final Thought</h4>
                    <p><strong>"Security isn't about sameness—it's about skill in difference."</strong></p>
                </div>
                <p><strong>Next Step:</strong> Take the Module 5 Assessment to test your understanding.</p>
            `
        }
    ],
    'ics-100': [
        {
            title: 'Emergency Response & ICS',
            content: `
                <h3>Emergency Response & ICS</h3>
                <p class="hero-subtitle">Sand Table Simulation: Festival Incident Response</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-sitemap"></i> Module Overview</h4>
                    <p>Welcome to the capstone module. This is where your training becomes real through applied response, role coordination, and decision-making under pressure.</p>
                    <p><strong>Duration:</strong> 2 Hours | <strong>Slides:</strong> 20</p>
                    <p><strong>Based on:</strong> ICS-100 principles and real-world event response</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Prerequisite</h4>
                    <p>Students should have completed FEMA IS-100.C or taken a review of ICS basics.</p>
                </div>
            `
        },
        {
            title: 'Learning Objectives',
            content: `
                <h3>What You'll Practice</h3>
                <ul>
                    <li><strong>Apply ICS roles in a simulated event</strong></li>
                    <li><strong>Understand span of control and command structure</strong></li>
                    <li><strong>Practice decision-making under pressure</strong></li>
                    <li><strong>Coordinate resources during chaotic incidents</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-fire"></i> This Is Where Training Becomes Real</h4>
                    <p>You'll experience a live simulation based on real crowd surge events. This is not about getting it perfect—it's about thinking under pressure.</p>
                </div>
            `
        },
        {
            title: 'ICS Recap',
            content: `
                <h3>Quick ICS Review</h3>
                <h4>What is ICS?</h4>
                <p>Incident Command System - standardized approach to emergency response coordination</p>
                <h4>Key Concepts:</h4>
                <ul>
                    <li><strong>Chain of Command:</strong> Clear reporting relationships</li>
                    <li><strong>Span of Control:</strong> 3-7 people per supervisor (ideal: 5)</li>
                    <li><strong>Unity of Command:</strong> Report to ONE supervisor only</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Discussion Question:</h4>
                    <p><strong>"Why is ICS better than winging it in chaos?"</strong></p>
                </div>
            `
        },
        {
            title: 'Key ICS Roles',
            content: `
                <h3>ICS Positions for Today's Simulation</h3>
                <h4>Command Staff:</h4>
                <ul>
                    <li><strong>Incident Commander:</strong> Overall authority and decision-making</li>
                    <li><strong>Safety Officer:</strong> Monitors personnel and scene safety</li>
                    <li><strong>Public Information Officer (PIO):</strong> Media and public communications</li>
                </ul>
                <h4>Operations:</h4>
                <ul>
                    <li><strong>Operations Section Chief:</strong> Tactical operations coordination</li>
                    <li><strong>Security Branch:</strong> Perimeter control, crowd management</li>
                    <li><strong>Medical Unit Leader:</strong> Triage and EMS coordination</li>
                    <li><strong>Staging Area Manager:</strong> Resource staging and deployment</li>
                    <li><strong>Transport Unit Leader:</strong> Vehicle and route coordination</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Your Role Selection:</h4>
                    <p>Choose one role to focus on as you go through this simulation. Think about how YOU would respond in each scenario from that perspective.</p>
                </div>
            `
        },
        {
            title: 'Event Map Overview',
            content: `
                <h3>Your Event Ground</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-map-marked-alt"></i> Venue Layout</h4>
                    <p>Memorize this event ground:</p>
                    <ul>
                        <li><strong>Entry Points:</strong> Main Gate (North), East Entrance, South Gate</li>
                        <li><strong>Stage:</strong> Main Stage (Center), Stage A (West)</li>
                        <li><strong>First Aid:</strong> Medical tent near VIP area</li>
                        <li><strong>Exits:</strong> Emergency exits at all perimeter points</li>
                        <li><strong>Command Post:</strong> Behind Main Stage</li>
                    </ul>
                </div>
                <p><strong>Visualize this layout</strong> as you work through the scenarios. Understanding the venue is critical to effective response.</p>
            `
        },
        {
            title: 'Communications Structure',
            content: `
                <h3>Radio Discipline in ICS</h3>
                <h4>Chain of Radio Calls:</h4>
                <p><strong>Example:</strong> Stage right security calls Staging Manager, NOT the Incident Commander directly</p>
                <h4>Key Principles:</h4>
                <ul>
                    <li><strong>Follow reporting channels</strong></li>
                    <li><strong>No cross-talk</strong> - wait for clear channel</li>
                    <li><strong>Document decisions</strong> - all major calls get logged</li>
                    <li><strong>Use proper radio protocol</strong> from Module 1</li>
                </ul>
                <p><strong>Remember:</strong> In real incidents, radio discipline prevents chaos. Think about how you would communicate clearly under pressure.</p>
            `
        },
        {
            title: 'ICS Forms & Reports',
            content: `
                <h3>Simplified Documentation</h3>
                <h4>Forms You'll Use:</h4>
                <ul>
                    <li><strong>ICS 201:</strong> Briefing form (situation summary)</li>
                    <li><strong>ICS 214:</strong> Activity Log (simplified version)</li>
                    <li><strong>Verbal Reports:</strong> Become log entries</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-clipboard-list"></i> During Exercise</h4>
                    <p>"You'll be verbally updating your logs during this exercise. Focus on key decisions and actions."</p>
                </div>
            `
        },
        {
            title: 'Scenario Orientation',
            content: `
                <h3>Simulation Setup</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-users"></i> Based on Real Events</h4>
                    <p>This simulation is based on a real crowd surge event (Astroworld-style incident). Students must act in role using ICS structure. Decisions will be made live.</p>
                </div>
                <p><strong>Remember:</strong> This is not about getting it perfect. It's about thinking under pressure and working as a team.</p>
            `
        },
        {
            title: 'Ground Rules',
            content: `
                <h3>Simulation Rules</h3>
                <h4>During the Exercise:</h4>
                <ul>
                    <li><strong>Stay in character</strong></li>
                    <li><strong>Use ICS titles</strong> when addressing others</li>
                    <li><strong>Use radio phrases:</strong> "Copy," "Stand by," "I need confirmation"</li>
                    <li><strong>Speak clearly and concisely</strong></li>
                    <li><strong>No overlapping chatter</strong></li>
                </ul>
                <div class="slide-interactive">
                    <h4>Practice Example:</h4>
                    <p><em>"Dispatch, this is Safety Officer, request EMS to Zone 3"</em></p>
                </div>
                <p><strong>As you read each scenario:</strong> Put yourself in the role and think through your response before moving to the next slide.</p>
            `
        },
        {
            title: 'SIMULATION: Initial Report',
            content: `
                <h3>Incident Begins</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-broadcast-tower"></i> Radio Report</h4>
                    <p><strong>"Large crowd gathering unexpectedly at Stage A. Minor pushing."</strong></p>
                    <ul>
                        <li>No injuries reported yet</li>
                        <li>Attendees shouting for water</li>
                        <li>Crowd density increasing</li>
                    </ul>
                </div>
                <div class="slide-interactive">
                    <h4>Your Response:</h4>
                    <p><strong>If you're the Incident Commander:</strong> What roles do you activate? Who do you contact first?</p>
                    <p><strong>If you're the Safety Officer:</strong> What's your first move? What hazards do you assess?</p>
                    <p><strong>Take a moment to think through your response before continuing.</strong></p>
                </div>
            `
        },
        {
            title: 'SIMULATION: Escalation',
            content: `
                <h3>Situation Worsens</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Radio Report</h4>
                    <p><strong>"Security reports fence breach at East Entrance."</strong></p>
                    <ul>
                        <li>Estimated 200 people entering unscreened</li>
                        <li>Conflicting radio traffic</li>
                        <li>Gate security requesting backup</li>
                    </ul>
                </div>
                <div class="slide-interactive">
                    <h4>Decision Point:</h4>
                    <p><strong>As Incident Commander:</strong> Do you assign a Staging Area manager? Activate more security? How do you handle conflicting radio traffic?</p>
                    <p><strong>Challenge:</strong> Multiple units are calling at once. How do you prioritize and maintain control?</p>
                </div>
            `
        },
        {
            title: 'SIMULATION: Injury Report',
            content: `
                <h3>First Casualty</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-ambulance"></i> Radio Report</h4>
                    <p><strong>"One unconscious attendee reported near VIP area. Bleeding from head."</strong></p>
                    <ul>
                        <li>EMS requested</li>
                        <li>Witnesses are filming on phones</li>
                        <li>Crowd gathering around victim</li>
                    </ul>
                </div>
                <div class="slide-interactive">
                    <h4>Multiple Response Needs:</h4>
                    <p><strong>As Medical Unit Leader:</strong> What's your triage plan? How do you coordinate with EMS?</p>
                    <p><strong>As Public Information Officer:</strong> What do you tell press if they arrive? How do you manage witnesses filming?</p>
                </div>
            `
        },
        {
            title: 'SIMULATION: Partial Collapse',
            content: `
                <h3>Major Incident</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-circle"></i> Radio Report</h4>
                    <p><strong>"Barricade near Main Stage collapses—several injured in front row."</strong></p>
                    <ul>
                        <li>Audio cuts out on stage</li>
                        <li>People are climbing stage barriers</li>
                        <li>Multiple injuries reported</li>
                    </ul>
                </div>
                <div class="slide-interactive">
                    <h4>Critical Decision:</h4>
                    <p><strong>As Operations Section Chief:</strong> Do you order evacuation or containment? What factors influence your decision?</p>
                    <p><strong>Consider:</strong> Stage safety, crowd density, injury severity, available resources</p>
                </div>
            `
        },
        {
            title: 'SIMULATION: Mass Panic Begins',
            content: `
                <h3>Critical Point</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-running"></i> Radio Report</h4>
                    <p><strong>"Stampede forming at South Exit. Attendees trapped against fence."</strong></p>
                    <ul>
                        <li>Multiple radio calls, all units talking over each other</li>
                        <li>Fire units are arriving outside gate</li>
                        <li>Screaming audible in background</li>
                    </ul>
                </div>
                <div class="slide-interactive">
                    <h4>Chaos Management:</h4>
                    <p><strong>As Incident Commander:</strong> How do you regain control of radio traffic? What command do you give?</p>
                    <p><strong>As Logistics:</strong> Which emergency exit points do you open? How do you coordinate with security?</p>
                </div>
            `
        },
        {
            title: 'SIMULATION: Mutual Aid Requested',
            content: `
                <h3>External Resources Arrive</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-fire-extinguisher"></i> Radio Report</h4>
                    <p><strong>"Local Fire requesting Incident Commander at Gate 3 for staging"</strong></p>
                    <ul>
                        <li>EMS forming triage</li>
                        <li>Airlift request initiated</li>
                        <li>Multiple agencies on scene</li>
                    </ul>
                </div>
                <div class="slide-interactive">
                    <h4>Resource Coordination:</h4>
                    <p><strong>As Transport Officer:</strong> How are you clearing routes for EMS? What obstacles need removal?</p>
                    <p><strong>As Safety Officer:</strong> Can you reassign personnel? What safety concerns take priority?</p>
                </div>
            `
        },
        {
            title: 'SIMULATION: Law Enforcement Conflict',
            content: `
                <h3>Authority Confusion</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> Radio Report</h4>
                    <p><strong>"Police on scene overriding Security orders"</strong></p>
                    <ul>
                        <li>Asking for perimeter lockdown</li>
                        <li>Confusion over ICS authority</li>
                        <li>Security personnel receiving conflicting orders</li>
                    </ul>
                </div>
                <div class="slide-interactive">
                    <h4>Authority Challenge:</h4>
                    <p><strong>As Incident Commander:</strong> How do you assert ICS control while respecting law enforcement authority?</p>
                    <p><strong>As Liaison Officer:</strong> What do you say to law enforcement to coordinate rather than conflict?</p>
                </div>
            `
        },
        {
            title: 'SIMULATION: Stabilization Point',
            content: `
                <h3>Situation Stabilizing</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Radio Report</h4>
                    <p><strong>"Crowd thinning, perimeter secure, injured being transported."</strong></p>
                    <ul>
                        <li>Event may resume partial operations</li>
                        <li>Triage complete</li>
                        <li>All exits now clear</li>
                    </ul>
                </div>
                <div class="slide-interactive">
                    <h4>Stabilization Phase:</h4>
                    <p><strong>Consider:</strong> What resources are needed now? What's the transition plan? How do you document what happened?</p>
                    <p><strong>Prepare to reflect:</strong> Think about your decisions throughout this simulation.</p>
                </div>
            `
        },
        {
            title: 'After Action Review (AAR) Framework',
            content: `
                <h3>Debrief: What Happened?</h3>
                <h4>AAR Questions:</h4>
                <ol>
                    <li><strong>What went well?</strong></li>
                    <li><strong>What failed or got missed?</strong></li>
                    <li><strong>What will you do differently next time?</strong></li>
                </ol>
                <div class="slide-callout">
                    <h4><i class="fas fa-users"></i> Self-Assessment</h4>
                    <p>Reflect on your responses throughout the simulation. Consider each decision you made from your chosen role's perspective.</p>
                </div>
                <p><strong>Self-Reflection:</strong> Be honest with yourself about what worked and what didn't in your decision-making.</p>
            `
        },
        {
            title: 'Leadership Themes',
            content: `
                <h3>Lessons from the Simulation</h3>
                <h4>Key Themes:</h4>
                <ul>
                    <li><strong>Accountability in chaos:</strong> Did everyone know their role?</li>
                    <li><strong>Delegation vs. micromanagement:</strong> Did IC trust their team?</li>
                    <li><strong>Clear communications and span of control:</strong> Was radio discipline maintained?</li>
                    <li><strong>Role boundaries and trust:</strong> Did people stay in their lane?</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Discussion Questions:</h4>
                    <p><strong>"What surprised you about your role?"</strong></p>
                    <p><strong>"Who did you rely on most?"</strong></p>
                </div>
            `
        },
        {
            title: 'Module Complete',
            content: `
                <h3>Emergency Response & ICS - Complete</h3>
                <p><strong>"Your job: Keep it from becoming a headline."</strong></p>
                <h4>Key Takeaways:</h4>
                <ul>
                    <li><strong>Every security officer should understand ICS basics</strong></li>
                    <li><strong>In real life, you'll be first on scene, not last</strong></li>
                    <li><strong>Decision-making under pressure is a skill</strong></li>
                    <li><strong>Communication and coordination save lives</strong></li>
                    <li><strong>Chain of command prevents chaos</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Simulation Complete!</h4>
                    <p>You've experienced real-world incident response. Consider taking the free FEMA ICS-100 online course for official certification.</p>
                </div>
                <p><strong>Next Step:</strong> Take the Module 4 Assessment to test your understanding of ICS principles and decision-making under pressure.</p>
            `
        }
    ],
    'threat-assessment': [
        {
            title: 'Threat Assessment & Situational Awareness',
            content: `
                <h3>Threat Assessment & Situational Awareness</h3>
                <p class="hero-subtitle">Real-Time Decision-Making for Security Professionals</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-eye"></i> Module Overview</h4>
                    <p>This is a "thinking" module—every professional should treat this as a tactical edge, not just soft skills. Your awareness and decision-making can prevent incidents before they happen.</p>
                    <p><strong>Duration:</strong> 1.5 Hours | <strong>Slides:</strong> 22</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> Critical Importance</h4>
                    <p>Directly ties to officer safety, public protection, and personal liability. This module sharpens everything else you'll learn.</p>
                </div>
            `
        },
        {
            title: 'Learning Objectives',
            content: `
                <h3>What You'll Master</h3>
                <ul>
                    <li><strong>Understand threat assessment basics</strong></li>
                    <li><strong>Recognize baseline behavior vs. anomalies</strong></li>
                    <li><strong>Apply situational awareness tools</strong></li>
                    <li><strong>Define and use de-escalation techniques</strong></li>
                    <li><strong>Integrate "Time, Distance, and Cover" principles</strong></li>
                </ul>
                <div class="slide-interactive">
                    <h4>Discussion Question:</h4>
                    <p><strong>Have you ever felt unsafe, but didn't know why?</strong></p>
                    <p>That's what we're training today—recognizing and acting on those instincts.</p>
                </div>
            `
        },
        {
            title: 'What is a Threat?',
            content: `
                <h3>Understanding Threats</h3>
                <h4>Threat Definition:</h4>
                <p><strong>A threat = Intent + Capability</strong></p>
                <h4>Key Distinctions:</h4>
                <ul>
                    <li><strong>Risk:</strong> Potential for harm (general)</li>
                    <li><strong>Threat:</strong> Specific intent and ability to cause harm</li>
                    <li><strong>Hazard:</strong> Dangerous condition without intent</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Remember</h4>
                    <p><strong>Not all dangers are threats—but all threats carry danger.</strong> Understanding this distinction helps you prioritize response.</p>
                </div>
            `
        },
        {
            title: 'What is Threat Assessment?',
            content: `
                <h3>The Threat Assessment Process</h3>
                <p><strong>Definition:</strong> The process of identifying, analyzing, and monitoring potential harm</p>
                <h4>3-Stage Cycle:</h4>
                <ol>
                    <li><strong>Detection:</strong> Identify potential threats</li>
                    <li><strong>Evaluation:</strong> Analyze severity and likelihood</li>
                    <li><strong>Response:</strong> Take appropriate action</li>
                </ol>
                <div class="slide-callout">
                    <h4><i class="fas fa-brain"></i> Proactive, Not Reactive</h4>
                    <p>This is the "intelligence" of security work. Refer to common failures where red flags were ignored—your job is to catch them early.</p>
                </div>
            `
        },
        {
            title: 'Key Behavioral Indicators',
            content: `
                <h3>Recognizing Suspicious Behavior</h3>
                <h4>Warning Signs:</h4>
                <ul>
                    <li><strong>Agitation:</strong> Nervous energy, pacing, fidgeting</li>
                    <li><strong>Avoidance or loitering:</strong> Hanging around without purpose</li>
                    <li><strong>Fixation on exit points:</strong> Studying escape routes</li>
                    <li><strong>Inappropriate clothing:</strong> Heavy coat in summer, bulky clothing</li>
                    <li><strong>Repetitive scanning or pacing:</strong> Surveillance behavior</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-list-check"></i> Critical Point</h4>
                    <p><strong>Look for clusters, not individual behaviors.</strong> One sign might be nothing—multiple signs together demand attention.</p>
                </div>
            `
        },
        {
            title: 'Pre-Event Awareness',
            content: `
                <h3>Know Your Environment</h3>
                <h4>Before Your Shift:</h4>
                <ul>
                    <li><strong>Understand the venue:</strong> Layout, capacity, event type</li>
                    <li><strong>Know entrances/exits:</strong> Primary and emergency</li>
                    <li><strong>Identify choke points:</strong> Where crowds bottleneck</li>
                    <li><strong>Know your post and adjacent posts:</strong> Who's around you</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-map-marked-alt"></i> The 25-50-100 Rule</h4>
                    <p><strong>"You should know your 25, 50, and 100-foot environment."</strong> What's immediately around you, nearby, and in your general area?</p>
                </div>
                <p><strong>Instructor:</strong> Use venue maps if available for visual reference.</p>
            `
        },
        {
            title: 'Indicators of Escalation',
            content: `
                <h3>Recognizing When Things Are Getting Worse</h3>
                <h4>Escalation Warning Signs:</h4>
                <ul>
                    <li><strong>Raised voice, clenched fists:</strong> Physical tension building</li>
                    <li><strong>Invading space:</strong> Getting too close aggressively</li>
                    <li><strong>Verbal threats or challenges:</strong> "What are you going to do?"</li>
                    <li><strong>Weapon pre-indicators:</strong> Blading body, adjusting waistband, hand near pocket</li>
                </ul>
                <div class="slide-interactive">
                    <h4>What Would You Do?</h4>
                    <p>After each example, ask yourself: What's my next move? Call for backup? Create distance? Start de-escalation?</p>
                </div>
                <p><strong>Remember:</strong> De-escalation doesn't guarantee success, but it buys time.</p>
            `
        },
        {
            title: 'The OODA Loop',
            content: `
                <h3>Decision-Making Under Pressure</h3>
                <h4>OODA Loop Process:</h4>
                <ol>
                    <li><strong>Observe:</strong> What's happening?</li>
                    <li><strong>Orient:</strong> What does it mean?</li>
                    <li><strong>Decide:</strong> What should I do?</li>
                    <li><strong>Act:</strong> Execute your decision</li>
                </ol>
                <p>Used by military, law enforcement, and security professionals worldwide.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-sync"></i> Stay Ahead</h4>
                    <p><strong>Staying "ahead" of the attacker's decision cycle</strong> gives you the advantage. Continuous loop—never stop observing.</p>
                </div>
                <div class="slide-interactive">
                    <h4>Quick Exercise:</h4>
                    <p><strong>"You see a guy yelling at staff. What's your OODA cycle in 5 seconds?"</strong></p>
                </div>
            `
        },
        {
            title: 'Situational Awareness Levels',
            content: `
                <h3>Cooper's Color Code</h3>
                <h4>Awareness Levels:</h4>
                <ul>
                    <li><strong>Condition White:</strong> Unaware, distracted - <strong>AVOID THIS</strong></li>
                    <li><strong>Condition Yellow:</strong> Relaxed alert, scanning - <strong>NORMAL for security</strong></li>
                    <li><strong>Condition Orange:</strong> Specific threat identified, focused attention</li>
                    <li><strong>Condition Red:</strong> Immediate threat, taking action</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Self-Assessment:</h4>
                    <p><strong>"What level were you in walking into this room?"</strong></p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Important</h4>
                    <p><strong>Don't stay in Condition Red—it burns out awareness.</strong> Transition between levels with context.</p>
                </div>
            `
        },
        {
            title: 'Baseline vs. Anomaly',
            content: `
                <h3>Know Normal to Spot Abnormal</h3>
                <h4>Baseline Behavior:</h4>
                <p>The normal pattern of behavior for a specific environment, time, and population.</p>
                <h4>Anomaly:</h4>
                <p>Behavior that deviates from the baseline—this is what you're looking for.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-users"></i> Every Crowd Has a Rhythm</h4>
                    <p><strong>Baselines change with time/location</strong> (e.g., morning vs. evening, concert vs. 5K race)</p>
                </div>
                <div class="slide-interactive">
                    <h4>Discussion:</h4>
                    <p><strong>"What's your baseline at a rock concert vs. a 5K race?"</strong></p>
                </div>
            `
        },
        {
            title: 'Risk = Threat × Vulnerability × Consequence',
            content: `
                <h3>Understanding the Risk Matrix</h3>
                <h4>Risk Formula:</h4>
                <p><strong>Risk = Threat × Vulnerability × Consequence</strong></p>
                <ul>
                    <li><strong>Threat:</strong> What could happen?</li>
                    <li><strong>Vulnerability:</strong> How exposed are we?</li>
                    <li><strong>Consequence:</strong> How bad would it be?</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-chart-line"></i> Key Principle</h4>
                    <p><strong>"We reduce risk by reducing any one of these three."</strong> Can't eliminate the threat? Reduce vulnerability or minimize consequences.</p>
                </div>
                <p>Tie this to festival work and real venue mapping—visualize the math behind prevention.</p>
            `
        },
        {
            title: 'Introduce De-escalation',
            content: `
                <h3>De-escalation Fundamentals</h3>
                <p><strong>Definition:</strong> Verbal, spatial, and behavioral tools to prevent violence</p>
                <h4>Goal:</h4>
                <p><strong>Disrupt emotional momentum</strong> and gain voluntary compliance</p>
                <h4>Core Concept:</h4>
                <p><strong>It's not losing—it's winning control.</strong> De-escalation is tactical, not weakness.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-brain"></i> The Science</h4>
                    <p><strong>"The brain needs time to catch up with adrenaline—your job is to slow the moment down."</strong></p>
                </div>
            `
        },
        {
            title: 'Time, Distance, and Cover',
            content: `
                <h3>Tactical De-escalation Framework</h3>
                <h4>Time:</h4>
                <p><strong>Delay decision-making.</strong> Let emotions cool, wait for backup, give them space to think.</p>
                <h4>Distance:</h4>
                <p><strong>Create space between aggressor and target.</strong> 6-10 feet minimum. Distance = reaction time.</p>
                <h4>Cover:</h4>
                <p><strong>Use physical protection or concealment.</strong> Barrier between you and threat.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> The Mantra</h4>
                    <p><strong>"Step back, take a breath, barrier between."</strong></p>
                </div>
                <p><strong>Instructor:</strong> Walk through a real incident where these three saved lives.</p>
            `
        },
        {
            title: 'Verbal De-escalation Tools',
            content: `
                <h3>Communication Techniques</h3>
                <h4>The Progression:</h4>
                <ul>
                    <li><strong>Ask:</strong> "Can you help me understand what's wrong?"</li>
                    <li><strong>Tell:</strong> "I need you to step back please"</li>
                    <li><strong>Command:</strong> "Step back now"</li>
                </ul>
                <h4>Key Principles:</h4>
                <p><strong>Tone > Words</strong> - How you say it matters more than what you say</p>
                <p><strong>Tactical Empathy:</strong> "I hear you..." acknowledges without agreeing</p>
                <h4>Avoid Escalation Traps:</h4>
                <ul>
                    <li>Don't insult or belittle</li>
                    <li>Don't say "Calm down"</li>
                    <li>Don't make it personal</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Practice Line:</h4>
                    <p><strong>"What can I do to help right now?"</strong></p>
                </div>
            `
        },
        {
            title: 'Scene Assessment – What Are You Missing?',
            content: `
                <h3>Visual Scenario Exercise</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-search"></i> Scan for Threats</h4>
                    <p>Look at your environment right now. What do you see?</p>
                    <ul>
                        <li>Where are the exits?</li>
                        <li>Who's acting differently from the baseline?</li>
                        <li>What's your escape route?</li>
                        <li>Where would you position yourself?</li>
                    </ul>
                </div>
                <div class="slide-interactive">
                    <h4>Group Discussion:</h4>
                    <p><strong>What's off? What behaviors stand out? What would you report?</strong></p>
                </div>
                <p><strong>Instructor:</strong> Pause here. Let students point out behaviors, exits, isolation, etc.</p>
            `
        },
        {
            title: 'Scenario 1 – Crowd Aggression',
            content: `
                <h3>Practice Scenario: Gate Incident</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-users"></i> Scenario</h4>
                    <p>Pushing at a gate after a delay. Crowd is getting agitated. Someone yells "Let us in!" Others start pushing forward.</p>
                </div>
                <div class="slide-interactive">
                    <h4>Pair Exercise:</h4>
                    <p><strong>How would you:</strong></p>
                    <ul>
                        <li>Report this situation?</li>
                        <li>Respond to the crowd?</li>
                        <li>Position yourself?</li>
                        <li>Use Time, Distance, Cover?</li>
                    </ul>
                </div>
                <p><strong>Instructor:</strong> Break class into pairs for discussion.</p>
            `
        },
        {
            title: 'Scenario 2 – Lone Subject Near Staff Tent',
            content: `
                <h3>Practice Scenario: Suspicious Loitering</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-user-secret"></i> Scenario</h4>
                    <p>Individual loitering near a restricted staff area. Not engaging with event. Keeps looking around. Heavy jacket on a warm day.</p>
                </div>
                <div class="slide-interactive">
                    <h4>Exercise:</h4>
                    <p><strong>Use OODA + Baseline/Anomaly tools</strong></p>
                    <p>Have a student give SITREP with threat indicators:</p>
                    <ul>
                        <li>What did you observe?</li>
                        <li>What's the baseline here?</li>
                        <li>What's the anomaly?</li>
                        <li>What's your action?</li>
                    </ul>
                </div>
            `
        },
        {
            title: 'Body Language & Proximity',
            content: `
                <h3>Reading Physical Cues</h3>
                <h4>What to Watch:</h4>
                <ul>
                    <li><strong>Hands visible?</strong> Hidden hands = potential weapon</li>
                    <li><strong>Distance respected?</strong> Invasion of space = aggression</li>
                    <li><strong>Open vs. closed posture:</strong> Arms crossed, turned away, or facing you?</li>
                    <li><strong>Context-specific behavior:</strong> Normal for venue or out of place?</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-hand-paper"></i> Scanning Habit</h4>
                    <p><strong>"Hands and eyes"</strong> - Always watch hands (for weapons) and eyes (for intent)</p>
                </div>
                <p><strong>Instructor:</strong> Demo confrontation vs. approach stances</p>
            `
        },
        {
            title: 'Incident Avoidance: Your Role',
            content: `
                <h3>Prevention is Your Job</h3>
                <h4>Your Responsibilities:</h4>
                <ul>
                    <li><strong>Spot it early:</strong> Catch problems before they escalate</li>
                    <li><strong>Communicate with your team:</strong> Share what you see</li>
                    <li><strong>Trust your gut—but verify:</strong> Instincts + evidence</li>
                    <li><strong>Don't delay reporting:</strong> Better to be wrong than late</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-comments"></i> Critical Mindset</h4>
                    <p><strong>"You don't have to be right—you just have to speak up."</strong> False alarms are better than missed threats.</p>
                </div>
            `
        },
        {
            title: 'Summary – You Are the Sensor',
            content: `
                <h3>Your Role in Threat Detection</h3>
                <h4>Key Takeaways:</h4>
                <ul>
                    <li><strong>You are the first line of intelligence</strong></li>
                    <li><strong>Good instincts + good tools = reduced risk</strong></li>
                    <li><strong>Don't wait for a supervisor to notice</strong></li>
                    <li><strong>Everyone's job is threat detection</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Remember</h4>
                    <p><strong>"No one dies from a false alarm. They die from no warning."</strong></p>
                </div>
            `
        },
        {
            title: 'Knowledge Check 1',
            content: `
                <h3>Quiz Question 1</h3>
                <div class="slide-quiz" data-quiz-id="threat-q1">
                    <p class="slide-quiz-question">What does OODA stand for?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">Order, Organize, Deploy, Act</div>
                        <div class="slide-quiz-option" data-answer="1" data-correct="true">Observe, Orient, Decide, Act</div>
                        <div class="slide-quiz-option" data-answer="2">Observe, Operate, Defend, Assess</div>
                        <div class="slide-quiz-option" data-answer="3">Organize, Orient, Direct, Activate</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
            `
        },
        {
            title: 'Knowledge Check 2',
            content: `
                <h3>Quiz Question 2</h3>
                <div class="slide-quiz" data-quiz-id="threat-q2">
                    <p class="slide-quiz-question">Name two signs of escalation:</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">Smiling and waving</div>
                        <div class="slide-quiz-option" data-answer="1" data-correct="true">Raised voice and clenched fists</div>
                        <div class="slide-quiz-option" data-answer="2">Sitting quietly and waiting</div>
                        <div class="slide-quiz-option" data-answer="3">Walking away calmly</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
            `
        },
        {
            title: 'Knowledge Check 3',
            content: `
                <h3>Quiz Question 3</h3>
                <div class="slide-quiz" data-quiz-id="threat-q3">
                    <p class="slide-quiz-question">What's the difference between risk and threat?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">They mean the same thing</div>
                        <div class="slide-quiz-option" data-answer="1" data-correct="true">Threat = intent + capability; Risk = potential for harm</div>
                        <div class="slide-quiz-option" data-answer="2">Risk is more dangerous than threat</div>
                        <div class="slide-quiz-option" data-answer="3">Threat is imaginary, risk is real</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
            `
        },
        {
            title: 'Knowledge Check 4',
            content: `
                <h3>Quiz Question 4</h3>
                <div class="slide-quiz" data-quiz-id="threat-q4">
                    <p class="slide-quiz-question">What's the purpose of de-escalation?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">To show you're in charge</div>
                        <div class="slide-quiz-option" data-answer="1" data-correct="true">To disrupt emotional momentum and prevent violence</div>
                        <div class="slide-quiz-option" data-answer="2">To make friends with everyone</div>
                        <div class="slide-quiz-option" data-answer="3">To delay calling for backup</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
            `
        },
        {
            title: 'Knowledge Check 5',
            content: `
                <h3>Quiz Question 5</h3>
                <div class="slide-quiz" data-quiz-id="threat-q5">
                    <p class="slide-quiz-question">What are the 3 components of the tactical de-escalation framework?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">Talk, Listen, Act</div>
                        <div class="slide-quiz-option" data-answer="1" data-correct="true">Time, Distance, and Cover</div>
                        <div class="slide-quiz-option" data-answer="2">Observe, Report, Respond</div>
                        <div class="slide-quiz-option" data-answer="3">Assess, Engage, Retreat</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
            `
        },
        {
            title: 'Module Complete',
            content: `
                <h3>Threat Assessment & Situational Awareness - Complete</h3>
                <p><strong>"Stay aware. Stay alive."</strong></p>
                <h4>What You've Mastered:</h4>
                <ul>
                    <li><strong>Threat assessment basics</strong> - Detection, Evaluation, Response</li>
                    <li><strong>Baseline vs. anomaly recognition</strong></li>
                    <li><strong>OODA Loop</strong> for decision-making</li>
                    <li><strong>Cooper's Color Code</strong> awareness levels</li>
                    <li><strong>De-escalation techniques</strong></li>
                    <li><strong>Time, Distance, and Cover</strong></li>
                    <li><strong>Behavioral indicators and body language</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Module Complete!</h4>
                    <p>This module sharpens everything else you'll learn. You're now equipped to be the first line of intelligence and prevention.</p>
                </div>
                <p><strong>Next Module:</strong> Module 4 - Emergency Response & ICS</p>
            `
        }
    ]
};

// Generate state-specific welcome module content
function generateWelcomeModuleContent(stateCode) {
    const state = window.stateLaws[stateCode];
    if (!state) return null;

    return [
        {
            title: 'Welcome to Your Security Training',
            content: `
                <h3>Welcome and Reference Materials</h3>
                <p class="hero-subtitle">${state.name} Modified State Course</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-graduation-cap"></i> Course Information</h4>
                    <p><strong>Provided by:</strong> Evenfall Advantage LLC</p>
                    <p><strong>Course:</strong> Unarmed Security Guard Training – State of ${state.name}</p>
                    <p><strong>Delivery Mode:</strong> Online, 12 Hours (2 Days)</p>
                    <p><strong>Issued Certificate(s):</strong> ${state.name} Initial Guard Training Certificate</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-info-circle"></i> No Assessment Required</h4>
                    <p>This is an orientation module. Simply read through all slides to mark it complete.</p>
                </div>
            `
        },
        {
            title: 'Overview',
            content: `
                <h3>📍 Overview</h3>
                <p>Welcome to the ${state.name} Modified State Course, developed by Evenfall Advantage LLC to meet and exceed ${state.name}'s security training standards.</p>
                <p>Before we begin live instruction, we ask you to complete the following self-paced preparation to set yourself up for success.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-lightbulb"></i> Preparation Materials</h4>
                    <p>This material is optional but strongly encouraged and will directly improve your confidence, participation, and performance during the course.</p>
                </div>
            `
        },
        {
            title: 'Recommended: ICS-100 Certification',
            content: `
                <h3>🔗 1. Recommended: ICS-100 Certification (Free FEMA Course)</h3>
                <h4>What is ICS-100?</h4>
                <p>The Incident Command System (ICS-100) introduces you to how emergency response teams organize, communicate, and work together under pressure — from active shooters to fire evacuations and medical triage.</p>
                <p>You'll apply these concepts in our live tabletop scenario during Module 4.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-medal"></i> Recognition</h4>
                    <p><strong>🏅 We recommend you complete this before class</strong></p>
                    <p>Students who submit proof of ICS-100 completion will be recognized by Evenfall and given credit for emergency response leadership on their course certificate.</p>
                </div>
                <p><strong>🎓 Enroll Here:</strong><br>
                <a href="https://training.fema.gov/is/courseoverview.aspx?code=IS-100.c" target="_blank">https://training.fema.gov/is/courseoverview.aspx?code=IS-100.c</a></p>
            `
        },
        {
            title: `Required Learning: ${state.name} State Goals`,
            content: `
                <h3>📄 2. Required Learning: ${state.name} State Goals (Training Compliance)</h3>
                <p>Your course is built directly on the State Goals mandated by the ${state.name} training authority. You will learn and be tested on each.</p>
                <p>We encourage you to read through the student-level definitions below to preview what you'll be expected to know by the end of the course.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-clipboard-check"></i> State Compliance</h4>
                    <p>All state goals will be clearly marked during instruction.</p>
                </div>
            `
        },
        {
            title: 'State Goals Covered in This Course',
            content: `
                <h3>📘 State Goals Covered in This Course:</h3>
                <h4>Module 1 – Security Radio Communications</h4>
                <ul>
                    <li><strong>SG-11:</strong> Communication in de-escalation</li>
                </ul>
                <h4>Module 2 – STOP THE BLEED® Emergency Medical Response</h4>
                <ul>
                    <li><strong>SG-13:</strong> Techniques for individuals in crisis</li>
                    <li><strong>SG-14:</strong> Basic emergency response procedures (First Aid, STOP THE BLEED®)</li>
                </ul>
                <h4>Module 3 – Threat Assessment & Situational Awareness</h4>
                <ul>
                    <li><strong>SG-9:</strong> Define de-escalation</li>
                    <li><strong>SG-10:</strong> Use of time, distance, and cover in de-escalation</li>
                </ul>
            `
        },
        {
            title: 'State Goals Covered (Continued)',
            content: `
                <h3>📘 State Goals Covered (Continued):</h3>
                <h4>Module 4 – Emergency Response & ICS</h4>
                <ul>
                    <li><strong>SG-15:</strong> Describe the duties of emergency first responders</li>
                    <li><strong>SG-16:</strong> Describe the duties of private security personnel in emergencies</li>
                </ul>
                <h4>Module 5 – Interacting with Diverse Populations</h4>
                <ul>
                    <li><strong>SG-17:</strong> Interacting with individuals from diverse populations</li>
                </ul>
                <h4>Module 6 – Crowd Management & Public Safety</h4>
                <ul>
                    <li><strong>SG-6:</strong> Define when force is authorized or prohibited</li>
                    <li><strong>SG-7:</strong> Reporting requirements when force is used</li>
                </ul>
                <h4>Module 7 – Legal Aspects & Use of Force</h4>
                <ul>
                    <li><strong>SG-1:</strong> State certification requirements</li>
                    <li><strong>SG-2:</strong> Limitations to certification</li>
                    <li><strong>SG-3:</strong> Elements of a crime</li>
                    <li><strong>SG-4:</strong> Arrest and detention limitations</li>
                    <li><strong>SG-5:</strong> Use of force definition</li>
                    <li><strong>SG-8:</strong> Legal consequences of use of force</li>
                    <li><strong>SG-12:</strong> Restrictions on use/possession of weapons</li>
                </ul>
            `
        },
        {
            title: 'White Paper Reading',
            content: `
                <h3>📰 3. White Paper Reading: Tragedy, ICS Failure, and the Role of Private Security</h3>
                <p>We ask all students to read this short white paper authored by Evenfall Advantage prior to Day 2 of class.</p>
                <p>This will help you understand why ICS is more than just a formality — it's about saving lives, managing chaos, and protecting the public.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-book-open"></i> Required Reading</h4>
                    <p><strong>📰 Read the Blog & Download the PDF here:</strong><br>
                    <a href="https://evenfalladvantage.com/blog/the-cost-of-chaos" target="_blank">evenfalladvantage.com/blog/the-cost-of-chaos</a></p>
                </div>
            `
        },
        {
            title: 'Summary: How to Prepare',
            content: `
                <h3>✅ Summary: How to Prepare</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
                    <thead>
                        <tr style="background: rgba(213, 155, 60, 0.1);">
                            <th style="padding: 0.75rem; text-align: left; border: 1px solid #ddd;">Task</th>
                            <th style="padding: 0.75rem; text-align: left; border: 1px solid #ddd;">Description</th>
                            <th style="padding: 0.75rem; text-align: left; border: 1px solid #ddd;">Link</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 0.75rem; border: 1px solid #ddd;"><strong>ICS-100</strong></td>
                            <td style="padding: 0.75rem; border: 1px solid #ddd;">Complete FEMA online training</td>
                            <td style="padding: 0.75rem; border: 1px solid #ddd;"><a href="https://training.fema.gov/is/courseoverview.aspx?code=IS-100.c" target="_blank">Enroll Now</a></td>
                        </tr>
                        <tr>
                            <td style="padding: 0.75rem; border: 1px solid #ddd;"><strong>White Paper</strong></td>
                            <td style="padding: 0.75rem; border: 1px solid #ddd;">Read Evenfall's ICS leadership case study</td>
                            <td style="padding: 0.75rem; border: 1px solid #ddd;"><a href="https://evenfalladvantage.com/blog/the-cost-of-chaos" target="_blank">Read Now</a></td>
                        </tr>
                        <tr>
                            <td style="padding: 0.75rem; border: 1px solid #ddd;"><strong>${state.name} Goals</strong></td>
                            <td style="padding: 0.75rem; border: 1px solid #ddd;">Review state learning objectives</td>
                            <td style="padding: 0.75rem; border: 1px solid #ddd;">See previous slides</td>
                        </tr>
                    </tbody>
                </table>
                <div class="slide-callout">
                    <h4><i class="fas fa-question-circle"></i> Questions?</h4>
                    <p>If you have questions about ICS-100 or trouble accessing the materials, contact us at:</p>
                    <p>📧 <a href="mailto:contact@evenfalladvantage.com">contact@evenfalladvantage.com</a><br>
                    🌐 <a href="https://www.evenfalladvantage.com" target="_blank">www.evenfalladvantage.com</a></p>
                    <p><strong>We're looking forward to working with you. Prepare to lead.</strong></p>
                </div>
            `
        }
    ];
}

// Initialize slideshow for a module
async function startModule(moduleId, skipStateCheck = false) {
    currentModuleId = moduleId;
    currentSlideIndex = 0;
    
    // Check course enrollment access
    try {
        const currentUser = await Auth.getCurrentUser();
        if (!currentUser) {
            alert('Please log in to access course modules.');
            window.location.href = 'login.html';
            return;
        }

        // Get module UUID from module code
        const { data: moduleData, error: moduleError } = await supabase
            .from('training_modules')
            .select('id')
            .eq('module_code', moduleId)
            .single();

        if (moduleError || !moduleData) {
            console.error('Error finding module:', moduleError);
            // Continue anyway for backward compatibility
        } else {
            // Check if student has access to this module
            const { data: hasAccess, error: accessError } = await supabase
                .rpc('student_has_module_access', {
                    p_student_id: currentUser.id,
                    p_module_id: moduleData.id
                });

            if (accessError) {
                console.error('Error checking module access:', accessError);
            }

            if (hasAccess === false) {
                alert('You need to enroll in a course to access this module. Redirecting to course catalog...');
                window.location.href = 'courses.html';
                return;
            }
        }
    } catch (error) {
        console.error('Error verifying module access:', error);
        // Continue anyway for backward compatibility
    }
    
    // Special handling for Module 0 (Welcome) and Module 7 (Use of Force) - needs state selection
    // Only do this check if not already coming from startModuleWithState
    if ((moduleId === 'welcome-materials' || moduleId === 'use-of-force') && !skipStateCheck) {
        const selectedState = localStorage.getItem('selectedState');
        
        // If no state selected or state laws not loaded, show state selection modal
        if (!selectedState || !window.stateLaws || Object.keys(window.stateLaws).length === 0) {
            if (window.showStateSelectionModal) {
                await window.showStateSelectionModal(moduleId);
                return; // State selection modal will call startModuleWithState
            }
        } else {
            // State already selected, regenerate slides with current state
            if (window.startModuleWithState) {
                await window.startModuleWithState(moduleId, selectedState);
                return;
            }
        }
    }
    
    try {
        // If skipStateCheck is true, we're coming from startModuleWithState
        // and the slides are already prepared in moduleSlidesData
        if (skipStateCheck && (moduleId === 'welcome-materials' || moduleId === 'use-of-force')) {
            currentModuleSlides = moduleSlidesData[moduleId];
            const fallbackModule = moduleContent[moduleId];
            if (!currentModuleSlides || !fallbackModule) {
                alert('This module has no content yet. Please contact your administrator.');
                return;
            }
            document.getElementById('moduleTitle').textContent = fallbackModule.title;
        } else {
            // First, try to load slides from database
            const { data: module, error: moduleError } = await supabase
                .from('training_modules')
                .select('*')
                .eq('module_code', moduleId)
                .single();
            
            if (moduleError) throw moduleError;
            
            // Load slides from database
            const { data: slides, error: slidesError } = await supabase
                .from('module_slides')
                .select('*')
                .eq('module_id', module.id)
                .order('slide_number');
            
            if (slidesError) throw slidesError;
            
            // If slides exist in database, use them
            if (slides && slides.length > 0) {
                currentModuleSlides = slides;
                document.getElementById('moduleTitle').textContent = module.module_name;
            } else {
                // Fallback to hardcoded slides if no database slides
                currentModuleSlides = moduleSlidesData[moduleId];
                const fallbackModule = moduleContent[moduleId];
                if (!currentModuleSlides || !fallbackModule) {
                    alert('This module has no content yet. Please contact your administrator.');
                    return;
                }
                document.getElementById('moduleTitle').textContent = fallbackModule.title;
            }
        }
        
        // Generate slide dots
        generateSlideDots();
        
        // Load first slide
        loadSlide(0);
        
        // Show modal
        document.getElementById('moduleModal').classList.add('active');
        
    } catch (error) {
        console.error('Error loading module:', error);
        
        // Fallback to hardcoded slides
        currentModuleSlides = moduleSlidesData[moduleId];
        const fallbackModule = moduleContent[moduleId];
        
        if (!currentModuleSlides || !fallbackModule) {
            alert('Error loading module. Please try again or contact your administrator.');
            return;
        }
        
        document.getElementById('moduleTitle').textContent = fallbackModule.title;
        generateSlideDots();
        loadSlide(0);
        document.getElementById('moduleModal').classList.add('active');
    }
}

function generateSlideDots() {
    const dotsContainer = document.getElementById('slideDots');
    dotsContainer.innerHTML = '';
    
    currentModuleSlides.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = 'slide-dot';
        if (index === 0) dot.classList.add('active');
        dot.onclick = () => goToSlide(index);
        dotsContainer.appendChild(dot);
    });
}

function loadSlide(index) {
    const slide = currentModuleSlides[index];
    const container = document.getElementById('moduleContent');
    
    // Stop any currently playing audio before loading new slide
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    
    // Build slide HTML with title, content, and media
    let slideHTML = '<div class="slide active">';
    
    // Add title if exists
    if (slide.title) {
        slideHTML += `<h2 class="slide-title">${slide.title}</h2>`;
    }
    
    // Add content
    if (slide.content) {
        slideHTML += `<div class="slide-content">${slide.content}</div>`;
    }
    
    // Add image if exists
    if (slide.image_url) {
        slideHTML += `
            <div class="slide-media">
                <img src="${slide.image_url}" alt="${slide.title || 'Slide image'}" style="max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1rem 0;">
            </div>
        `;
    }
    
    // Add video if exists (from video_url field - uploaded videos)
    if (slide.video_url) {
        // Check if it's a YouTube URL
        const youtubeMatch = slide.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (youtubeMatch) {
            const videoId = youtubeMatch[1];
            slideHTML += `
                <div class="slide-media">
                    <h4 style="margin-top: 2rem; margin-bottom: 0.5rem;">Additional Video:</h4>
                    <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1.5rem 0;">
                        <iframe 
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                            src="https://www.youtube.com/embed/${videoId}" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                        </iframe>
                    </div>
                </div>
            `;
        } else {
            // Direct video file (uploaded)
            slideHTML += `
                <div class="slide-media">
                    <video controls style="max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1rem 0; display: block;">
                        <source src="${slide.video_url}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;
        }
    }
    
    // Add audio narration if exists
    if (slide.audio_url) {
        const audioId = `slideAudio${index}`;
        slideHTML += `
            <div class="slide-audio" style="margin: 1.5rem 0;">
                <audio id="${audioId}" controls style="width: 100%; max-width: 500px;">
                    <source src="${slide.audio_url}" type="audio/mpeg">
                    <source src="${slide.audio_url}" type="audio/wav">
                    <source src="${slide.audio_url}" type="audio/ogg">
                    Your browser does not support the audio element.
                </audio>
            </div>
        `;
    }
    
    slideHTML += '</div>';
    
    container.innerHTML = slideHTML;
    
    // Auto-play audio if enabled (play once)
    if (slide.audio_url && slide.audio_autoplay) {
        const audioElement = document.getElementById(`slideAudio${index}`);
        if (audioElement) {
            // Small delay to ensure audio is loaded
            setTimeout(() => {
                audioElement.play().catch(err => {
                    console.log('Audio autoplay prevented by browser:', err);
                    // Browser blocked autoplay - user will need to click play manually
                });
            }, 100);
        }
    }
    
    // Update progress
    updateSlideProgress();
    
    // Update navigation buttons
    updateNavigationButtons();
    
    // Initialize any quiz interactions
    initializeSlideQuiz();
    
    // Initialize state selector if present
    initializeStateSelector();
}

function updateSlideProgress() {
    const total = currentModuleSlides.length;
    const current = currentSlideIndex + 1;
    
    document.getElementById('slideCounter').textContent = `Slide ${current} of ${total}`;
    
    const progressPercent = (current / total) * 100;
    document.getElementById('slideProgressBar').style.width = `${progressPercent}%`;
    
    // Update dots
    document.querySelectorAll('.slide-dot').forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlideIndex);
    });
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevSlideBtn');
    const nextBtn = document.getElementById('nextSlideBtn');
    const completeBtn = document.getElementById('completeModuleBtn');
    
    prevBtn.style.display = currentSlideIndex === 0 ? 'none' : 'inline-flex';
    
    const isLastSlide = currentSlideIndex === currentModuleSlides.length - 1;
    nextBtn.classList.toggle('hidden', isLastSlide);
    completeBtn.classList.toggle('hidden', !isLastSlide);
}

function previousSlide() {
    if (currentSlideIndex > 0) {
        currentSlideIndex--;
        loadSlide(currentSlideIndex);
    }
}

function nextSlide() {
    if (currentSlideIndex < currentModuleSlides.length - 1) {
        currentSlideIndex++;
        loadSlide(currentSlideIndex);
    }
}

function goToSlide(index) {
    currentSlideIndex = index;
    loadSlide(currentSlideIndex);
}

async function completeModule() {
    if (!currentModuleId) return;
    
    // Capture module ID immediately before any operations that might clear it
    const completedModuleId = currentModuleId;
    
    // Save to localStorage (legacy support)
    if (!progressData.completedModules.includes(completedModuleId)) {
        progressData.completedModules.push(completedModuleId);
        const moduleTitle = moduleContent[completedModuleId]?.title || 'Unknown Module';
        addActivity(`Completed module: ${moduleTitle}`);
        saveProgress();
    }
    
    // Save to database
    try {
        const userId = window.currentUser?.id;
        if (userId && window.TrainingData && window.StudentData) {
            const moduleResult = await window.TrainingData.getModuleByCode(completedModuleId);
            if (moduleResult.success && moduleResult.data) {
                await window.StudentData.updateModuleProgress(userId, moduleResult.data.id, {
                    progress_percentage: 100,
                    completed_at: new Date().toISOString()
                });
                console.log(`✅ Module marked complete in database: ${completedModuleId}`);
            }
        }
    } catch (error) {
        console.error('Error saving module completion to database:', error);
    }
    
    // Close modal and return to training section
    closeModule();
    
    // Navigate back to training section (don't auto-start assessment)
    navigateToSection('training');
    
    // Reload training modules to show updated completion status
    if (window.loadTrainingModules && window.currentCourseId) {
        await window.loadTrainingModules(window.currentCourseId);
    }
    
    // Reload course assessments to unlock the assessment
    if (window.loadCourseAssessments && window.currentCourseId) {
        await window.loadCourseAssessments(window.currentCourseId);
        console.log('✅ Reloaded course assessments to unlock assessment');
    }
    
    // Show appropriate completion message using the captured module ID
    setTimeout(() => {
        console.log('Alert check - completedModuleId:', completedModuleId);
        // Module 0 (welcome-materials) has no assessment - just show completion
        if (completedModuleId === 'welcome-materials') {
            alert('Welcome and Reference Materials completed! You\'re ready to begin the training modules.');
        } else {
            // Show completion message for other modules
            alert('Module completed! You can now take the assessment from the Assessment section.');
        }
    }, 300);
    
    /* Disabled auto-launch of assessment
    const moduleToAssessment = {
        'communication-protocols': 'communication-protocols',
        'stop-the-bleed': 'stop-the-bleed',
        'threat-assessment': 'threat-assessment',
        'ics-100': 'ics-100',
        'diverse-population': 'diverse-population',
        'crowd-management': 'crowd-management',
        'use-of-force': 'use-of-force'
    };
    
    const assessmentId = moduleToAssessment[currentModuleId];
    
    if (assessmentId) {
        navigateToSection('assessment');
        setTimeout(() => {
            if (typeof startAssessment === 'function') {
                startAssessment(assessmentId);
            }
        }, 100);
    } else {
        // Default to assessment section if no specific mapping
        navigateToSection('assessment');
    }
    */
}

function closeModule() {
    // Stop any playing audio
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    
    document.getElementById('moduleModal').classList.remove('active');
    currentModuleId = null;
    currentModuleSlides = [];
    currentSlideIndex = 0;
}

// Initialize quiz interactions on slides
function initializeSlideQuiz() {
    const quizContainer = document.querySelector('.slide-quiz');
    if (!quizContainer) return;
    
    const options = quizContainer.querySelectorAll('.slide-quiz-option');
    const feedback = quizContainer.querySelector('.slide-quiz-feedback');
    
    options.forEach(option => {
        option.onclick = () => {
            // Remove previous selections
            options.forEach(opt => {
                opt.classList.remove('selected', 'correct', 'incorrect');
            });
            
            // Mark this option
            option.classList.add('selected');
            
            // Check if correct
            const isCorrect = option.dataset.correct === 'true';
            
            if (isCorrect) {
                option.classList.add('correct');
                feedback.className = 'slide-quiz-feedback show correct';
                feedback.innerHTML = '<strong><i class="fas fa-check-circle"></i> Correct!</strong> Great job!';
            } else {
                option.classList.add('incorrect');
                // Find and highlight correct answer
                const correctOption = quizContainer.querySelector('[data-correct="true"]');
                correctOption.classList.add('correct');
                feedback.className = 'slide-quiz-feedback show incorrect';
                feedback.innerHTML = '<strong><i class="fas fa-times-circle"></i> Incorrect.</strong> The correct answer is highlighted above.';
            }
        };
    });
}

// State selector function for use of force module
function updateStateInfo(stateCode) {
    const displayDiv = document.getElementById('stateInfoDisplay');
    if (!displayDiv) return;
    
    if (!stateCode) {
        displayDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Select a state above to view specific requirements, use of force laws, and licensing information.</p>';
        return;
    }
    
    displayDiv.innerHTML = displayStateInfo(stateCode);
}

// Initialize state selector when slide loads
function initializeStateSelector() {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
        if (typeof populateStateSelector === 'function') {
            populateStateSelector();
        }
    }, 100);
}

// Expose slideshow functions and data globally for state-selection.js
window.moduleSlidesData = moduleSlidesData;
window.startModule = startModule;
window.generateWelcomeModuleContent = generateWelcomeModuleContent;
