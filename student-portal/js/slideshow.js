// ============= INTERACTIVE SLIDESHOW SYSTEM =============

// Slideshow state
let currentSlideIndex = 0;
let currentModuleSlides = [];
let currentModuleId = null;

// Module slides data structure
const moduleSlidesData = {
    'crowd-management': [
        {
            title: 'Welcome to Crowd Management',
            content: `
                <h3>Crowd Management for Event Security</h3>
                <p>Welcome to this interactive training module on crowd management. You'll learn essential techniques for maintaining safety and order at events with large gatherings.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-lightbulb"></i> What You'll Learn</h4>
                    <ul>
                        <li>Key principles of crowd management</li>
                        <li>Crowd control techniques and strategies</li>
                        <li>Warning signs and risk assessment</li>
                        <li>Best practices for event security</li>
                    </ul>
                </div>
            `
        },
        {
            title: 'Understanding Crowd Density',
            content: `
                <h3>Crowd Density Management</h3>
                <p><strong>Crowd density</strong> refers to the number of people per square meter in a given area. Managing density is crucial for preventing dangerous situations.</p>
                <h4>Density Levels:</h4>
                <ul>
                    <li><strong>Low (< 2 people/m²):</strong> Comfortable, free movement</li>
                    <li><strong>Medium (2-4 people/m²):</strong> Restricted movement, manageable</li>
                    <li><strong>High (4-6 people/m²):</strong> Very restricted, potential danger</li>
                    <li><strong>Critical (> 6 people/m²):</strong> Dangerous, risk of crushing</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Critical Point</h4>
                    <p>At densities above 6 people per square meter, crowd crushes can occur. Immediate action is required to reduce density.</p>
                </div>
            `
        },
        {
            title: 'Crowd Flow Management',
            content: `
                <h3>Managing Crowd Movement</h3>
                <p>Effective crowd flow prevents bottlenecks, congestion, and dangerous situations.</p>
                <h4>Key Techniques:</h4>
                <ul>
                    <li><strong>Use Barriers:</strong> Channel crowd movement along safe pathways</li>
                    <li><strong>Clear Signage:</strong> Direct people to entries, exits, and facilities</li>
                    <li><strong>Multiple Entry Points:</strong> Distribute crowd arrival evenly</li>
                    <li><strong>One-Way Systems:</strong> Prevent opposing flows from colliding</li>
                    <li><strong>Strategic Positioning:</strong> Place guards at choke points</li>
                </ul>
                <p>Always maintain clear emergency exit routes that are never blocked by crowds or equipment.</p>
            `
        },
        {
            title: 'Warning Signs',
            content: `
                <h3>Recognizing Danger Signs</h3>
                <p>Early detection of problems allows you to take preventive action before situations escalate.</p>
                <h4>Visual Indicators:</h4>
                <ul>
                    <li><strong>Overcrowding:</strong> People packed tightly with no personal space</li>
                    <li><strong>Pushing/Shoving:</strong> Aggressive movement in the crowd</li>
                    <li><strong>Distressed Individuals:</strong> People looking panicked or trapped</li>
                    <li><strong>Crowd Surges:</strong> Sudden wave-like movements</li>
                    <li><strong>Blocked Exits:</strong> Emergency routes becoming inaccessible</li>
                </ul>
                <div class="slide-interactive">
                    <h4>Quick Check:</h4>
                    <p><strong>Question:</strong> What should you do if you notice overcrowding in a specific area?</p>
                    <p><strong>Answer:</strong> Immediately alert your supervisor via radio, help redirect crowd flow away from the area, and if necessary, temporarily stop additional people from entering that zone.</p>
                </div>
            `
        },
        {
            title: 'De-escalation Techniques',
            content: `
                <h3>De-escalating Crowd Tensions</h3>
                <p>Your ability to calm situations verbally can prevent physical confrontations.</p>
                <h4>Effective De-escalation:</h4>
                <ul>
                    <li><strong>Stay Calm:</strong> Your demeanor sets the tone</li>
                    <li><strong>Use Calm Voice:</strong> Speak clearly and at moderate volume</li>
                    <li><strong>Active Listening:</strong> Let people express concerns</li>
                    <li><strong>Show Empathy:</strong> Acknowledge their feelings</li>
                    <li><strong>Offer Solutions:</strong> Provide alternatives when possible</li>
                    <li><strong>Maintain Distance:</strong> Respect personal space</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-user-shield"></i> Remember</h4>
                    <p>Your goal is to resolve situations peacefully. Call for backup if you feel unsafe or the situation is escalating despite your efforts.</p>
                </div>
            `
        },
        {
            title: 'Knowledge Check',
            content: `
                <h3>Test Your Understanding</h3>
                <div class="slide-quiz" data-quiz-id="crowd-1">
                    <p class="slide-quiz-question">At what crowd density level does the situation become critically dangerous?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">Less than 2 people per square meter</div>
                        <div class="slide-quiz-option" data-answer="1">2-4 people per square meter</div>
                        <div class="slide-quiz-option" data-answer="2">4-6 people per square meter</div>
                        <div class="slide-quiz-option" data-answer="3" data-correct="true">More than 6 people per square meter</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
            `
        },
        {
            title: 'Best Practices Summary',
            content: `
                <h3>Crowd Management Best Practices</h3>
                <p>Let's review the key takeaways from this module:</p>
                <h4>Before the Event:</h4>
                <ul>
                    <li>Conduct venue assessment and identify potential bottlenecks</li>
                    <li>Calculate and understand venue capacity limits</li>
                    <li>Plan guard positioning at strategic locations</li>
                    <li>Ensure all emergency exits are clearly marked and accessible</li>
                </ul>
                <h4>During the Event:</h4>
                <ul>
                    <li>Continuously monitor crowd density in all areas</li>
                    <li>Maintain radio communication with team</li>
                    <li>Watch for warning signs and report immediately</li>
                    <li>Use de-escalation techniques when needed</li>
                    <li>Keep emergency routes clear at all times</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Module Complete!</h4>
                    <p>You've completed the Crowd Management module. You're now ready to practice these skills in the interactive sand table exercise.</p>
                </div>
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
            title: 'Communication & Protocols',
            content: `
                <h3>Professional Communication</h3>
                <p>Clear, professional communication is essential for coordinating security operations at events.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-walkie-talkie"></i> What You'll Learn</h4>
                    <ul>
                        <li>Radio communication basics</li>
                        <li>Standard radio procedures and codes</li>
                        <li>Incident reporting</li>
                        <li>Professional communication skills</li>
                        <li>Chain of command</li>
                    </ul>
                </div>
            `
        },
        {
            title: 'Radio Communication Basics',
            content: `
                <h3>Using Your Radio Effectively</h3>
                <p>Your radio is your lifeline for communication with your team.</p>
                <h4>The 5 Principles:</h4>
                <ol>
                    <li><strong>Think Before Speaking:</strong> Know what you'll say before pressing PTT</li>
                    <li><strong>Be Clear and Concise:</strong> Use simple, direct language</li>
                    <li><strong>Speak Clearly:</strong> Moderate pace, clear pronunciation</li>
                    <li><strong>Wait for Clear Channel:</strong> Don't interrupt ongoing transmissions</li>
                    <li><strong>Identify Yourself:</strong> State your position/ID when transmitting</li>
                </ol>
                <h4>Standard Radio Procedure:</h4>
                <ol>
                    <li>Press and hold PTT (Push-To-Talk) button</li>
                    <li>Wait one second before speaking</li>
                    <li>State your call sign/position</li>
                    <li>Deliver your message</li>
                    <li>Release PTT and listen for response</li>
                    <li>Acknowledge with "Copy" or "10-4"</li>
                </ol>
            `
        },
        {
            title: 'Radio Codes',
            content: `
                <h3>Common Radio Codes</h3>
                <p>Radio codes allow quick, clear communication. Learn these essential codes:</p>
                <h4>10-Codes:</h4>
                <ul>
                    <li><strong>10-4:</strong> Message received/understood ("Copy that")</li>
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
                <div class="slide-interactive">
                    <h4>Example Transmission:</h4>
                    <p><em>"Command, this is Gate 2. 10-97 at my post. 10-8 and ready."</em></p>
                    <p>Translation: "Command, this is Gate 2. I've arrived at my post. I'm in service and ready."</p>
                </div>
            `
        },
        {
            title: 'Incident Reporting',
            content: `
                <h3>Reporting Incidents via Radio</h3>
                <p>When reporting incidents, provide clear, factual information.</p>
                <h4>What to Include:</h4>
                <ul>
                    <li><strong>Your Location:</strong> Be specific (Gate 3, Section B, etc.)</li>
                    <li><strong>Nature of Incident:</strong> Brief, factual description</li>
                    <li><strong>Number of People Involved:</strong> Approximate count</li>
                    <li><strong>Injuries:</strong> Any medical concerns</li>
                    <li><strong>Assistance Needed:</strong> What help do you require</li>
                    <li><strong>Updates:</strong> Inform of any changes in situation</li>
                </ul>
                <h4>Example Reports:</h4>
                <p><strong>Medical:</strong> <em>"Command, Gate 5. Code 3 medical. Female, approximately 25, conscious but injured. Requesting EMS."</em></p>
                <p><strong>Disturbance:</strong> <em>"Command, Section C. Code 2. Two males arguing, situation escalating. Requesting backup."</em></p>
                <p><strong>Resolved:</strong> <em>"Command, Section C. Situation resolved. Individuals separated and calm. 10-8."</em></p>
            `
        },
        {
            title: 'Professional Communication',
            content: `
                <h3>Face-to-Face Communication</h3>
                <p>Your verbal communication skills are just as important as radio skills.</p>
                <h4>With Attendees:</h4>
                <ul>
                    <li><strong>Be Respectful:</strong> Use "sir" or "ma'am"</li>
                    <li><strong>Stay Professional:</strong> Don't take things personally</li>
                    <li><strong>Listen Actively:</strong> Let people express concerns</li>
                    <li><strong>Explain Clearly:</strong> Help them understand policies</li>
                    <li><strong>Offer Solutions:</strong> Be helpful when possible</li>
                </ul>
                <h4>Radio Etiquette:</h4>
                <ul>
                    <li>Never use profanity or slang</li>
                    <li>Avoid personal conversations</li>
                    <li>Keep transmissions brief</li>
                    <li>Use proper titles for supervisors</li>
                    <li>Maintain confidentiality</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-info-circle"></i> Remember</h4>
                    <p>Everything you say on the radio can be heard by the entire team and may be recorded. Always maintain professionalism.</p>
                </div>
            `
        },
        {
            title: 'Chain of Command',
            content: `
                <h3>Understanding Chain of Command</h3>
                <p>Following proper reporting structure ensures efficient operations.</p>
                <h4>Typical Structure:</h4>
                <ol>
                    <li><strong>Security Guards:</strong> Front-line personnel at posts</li>
                    <li><strong>Team Leaders:</strong> Supervise small groups of guards</li>
                    <li><strong>Shift Supervisors:</strong> Oversee entire shift operations</li>
                    <li><strong>Security Manager:</strong> Overall security operations</li>
                    <li><strong>Event Manager:</strong> Overall event operations</li>
                </ol>
                <h4>Key Principles:</h4>
                <ul>
                    <li><strong>Know Your Supervisor:</strong> Who do you report to?</li>
                    <li><strong>Report Up:</strong> Always report to your immediate supervisor</li>
                    <li><strong>Follow Directives:</strong> Follow instructions from supervisors</li>
                    <li><strong>Escalate Issues:</strong> Pass problems you can't solve up the chain</li>
                    <li><strong>Emergency Exception:</strong> In life-threatening situations, act immediately and report after</li>
                </ul>
            `
        },
        {
            title: 'Knowledge Check',
            content: `
                <h3>Test Your Understanding</h3>
                <div class="slide-quiz" data-quiz-id="comm-1">
                    <p class="slide-quiz-question">What does "10-4" mean on the radio?</p>
                    <div class="slide-quiz-options">
                        <div class="slide-quiz-option" data-answer="0">Emergency</div>
                        <div class="slide-quiz-option" data-answer="1" data-correct="true">Message received/understood</div>
                        <div class="slide-quiz-option" data-answer="2">Out of service</div>
                        <div class="slide-quiz-option" data-answer="3">Need backup</div>
                    </div>
                    <div class="slide-quiz-feedback"></div>
                </div>
            `
        },
        {
            title: 'Module Summary',
            content: `
                <h3>Communication Summary</h3>
                <p>You've learned essential communication skills for event security.</p>
                <h4>Key Takeaways:</h4>
                <ul>
                    <li><strong>Radio Basics:</strong> Think before speaking, be clear and concise</li>
                    <li><strong>Know Your Codes:</strong> 10-4, 10-20, Code 3, etc.</li>
                    <li><strong>Report Effectively:</strong> Location, situation, assistance needed</li>
                    <li><strong>Stay Professional:</strong> On radio and face-to-face</li>
                    <li><strong>Follow Chain of Command:</strong> Report to your supervisor</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Module Complete!</h4>
                    <p>You're now ready to communicate effectively as part of a security team. Practice coordinating in the sand table exercise.</p>
                </div>
            `
        }
    ],
    'use-of-force': [
        {
            title: 'Use of Force & Legal Responsibilities',
            content: `
                <h3>Legal Authority and Use of Force</h3>
                <p>Welcome to this critical training module on use of force and legal responsibilities for unarmed security guards.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-balance-scale"></i> What You'll Learn</h4>
                    <ul>
                        <li>Your legal status and authority as a security guard</li>
                        <li>The use of force continuum</li>
                        <li>When force may and may not be used</li>
                        <li>Legal liability and consequences</li>
                        <li>State-specific requirements</li>
                    </ul>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Critical Importance</h4>
                    <p>Understanding these concepts is essential to avoid criminal charges, civil lawsuits, and license revocation. When in doubt, always observe and report rather than intervene physically.</p>
                </div>
            `
        },
        {
            title: 'Your Legal Status',
            content: `
                <h3>Legal Authority of Security Guards</h3>
                <p>It's crucial to understand that as a security guard, you are <strong>NOT a police officer</strong>.</p>
                <h4>Key Facts:</h4>
                <ul>
                    <li><strong>Private Citizen Status:</strong> You have the same legal authority as any other private citizen</li>
                    <li><strong>No Police Powers:</strong> You cannot arrest, search, or detain people like police can</li>
                    <li><strong>Property Rights Based:</strong> Your authority comes from the property owner's rights to control their property</li>
                    <li><strong>State Licensed:</strong> You must comply with your state's security guard regulations</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-gavel"></i> Important Distinction</h4>
                    <p>Security guards act as the "eyes and ears" of law enforcement. Your primary role is to <strong>observe and report</strong>, not to enforce laws.</p>
                </div>
                <h4>What This Means:</h4>
                <ul>
                    <li>You can ask people to leave property</li>
                    <li>You can refuse entry to unauthorized persons</li>
                    <li>You can call police for violations</li>
                    <li>You CANNOT force compliance beyond self-defense</li>
                </ul>
            `
        },
        {
            title: 'Use of Force Continuum',
            content: `
                <h3>The Force Continuum</h3>
                <p>The use of force continuum guides your response based on the level of resistance or threat.</p>
                <h4>Level 1: Presence</h4>
                <p>Your uniformed, professional presence deters problems. This is your most effective tool.</p>
                <h4>Level 2: Verbal Communication</h4>
                <p>Clear, calm directions and de-escalation techniques. Always try this first.</p>
                <h4>Level 3: Empty Hand Control</h4>
                <p>Guiding or escorting someone without strikes. Minimal physical contact.</p>
                <h4>Level 4: Defensive Tactics</h4>
                <p>Physical defense ONLY when you or others face imminent harm. Must be proportional to threat.</p>
                <h4>Level 5: Deadly Force</h4>
                <p><strong style="color: var(--danger-color);">NEVER AUTHORIZED</strong> for unarmed security guards.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-chart-line"></i> Escalation Principle</h4>
                    <p>Always use the <strong>minimum</strong> level of force necessary. Start low and only escalate if the threat escalates.</p>
                </div>
            `
        },
        {
            title: 'When Force May Be Used',
            content: `
                <h3>Lawful Use of Force</h3>
                <p>Force may ONLY be used in very limited circumstances:</p>
                <h4>1. Self-Defense</h4>
                <p>To protect yourself from <strong>imminent</strong> physical harm. The threat must be immediate and real.</p>
                <h4>2. Defense of Others</h4>
                <p>To protect another person from imminent physical harm. Same rules as self-defense apply.</p>
                <h4>3. Reasonable Force Only</h4>
                <p>The force used must be <strong>proportional</strong> to the threat. You cannot use excessive force.</p>
                <div class="slide-interactive">
                    <h4>Example Scenarios:</h4>
                    <p><strong>Lawful:</strong> Someone swings a punch at you, you block and create distance.</p>
                    <p><strong>Unlawful:</strong> Someone insults you verbally, you push them.</p>
                    <p><strong>Lawful:</strong> Someone is choking another person, you intervene to stop the attack.</p>
                    <p><strong>Unlawful:</strong> Someone refuses to leave, you physically drag them out.</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-running"></i> Duty to Retreat</h4>
                    <p>In many states, you have a duty to retreat or avoid confrontation if you can do so safely. Your safety comes first.</p>
                </div>
            `
        },
        {
            title: 'What You CANNOT Do',
            content: `
                <h3>Prohibited Actions</h3>
                <p>These actions can result in criminal charges and civil lawsuits:</p>
                <h4>❌ Use Force to Detain</h4>
                <p>You cannot physically restrain someone for shoplifting, trespassing, or other violations (in most states).</p>
                <h4>❌ Chase Suspects</h4>
                <p>Do not pursue suspects off property. Observe, report, and let police handle it.</p>
                <h4>❌ Search People</h4>
                <p>You cannot search people without their consent. Bag checks require voluntary compliance.</p>
                <h4>❌ Use Weapons</h4>
                <p>Firearms, batons, pepper spray, tasers are prohibited unless you have specific licensing and authorization.</p>
                <h4>❌ Make Arrests</h4>
                <p>You cannot arrest people (except limited citizen's arrest in some states - not recommended).</p>
                <h4>❌ Eject by Force</h4>
                <p>Call police to remove trespassers. Do not physically remove them yourself.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-phone"></i> When in Doubt</h4>
                    <p><strong>Call the police.</strong> It's always better to wait for law enforcement than to risk liability.</p>
                </div>
            `
        },
        {
            title: 'Citizen\'s Arrest - High Risk',
            content: `
                <h3>Citizen's Arrest (Not Recommended)</h3>
                <p>While some states allow citizen's arrest, it carries <strong>extreme liability risks</strong>.</p>
                <h4>General Requirements (Vary by State):</h4>
                <ul>
                    <li>Only for <strong>felonies</strong> committed in your presence</li>
                    <li>Must immediately turn person over to police</li>
                    <li>Cannot use excessive force</li>
                    <li>High risk of false arrest lawsuit</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Strong Warning</h4>
                    <p>Citizen's arrest is <strong>NOT recommended</strong> for security guards. The legal risks far outweigh any benefits. Always call police instead.</p>
                </div>
                <h4>Why It's Risky:</h4>
                <ul>
                    <li>You must be 100% certain a felony occurred</li>
                    <li>Misidentification = false arrest lawsuit</li>
                    <li>Any injury = assault and battery charges</li>
                    <li>Company policy usually prohibits it</li>
                    <li>You can be personally sued</li>
                </ul>
                <p><strong>Best Practice:</strong> Observe, report, and be a good witness for police.</p>
            `
        },
        {
            title: 'Legal Consequences',
            content: `
                <h3>Liability and Legal Consequences</h3>
                <p>Improper use of force can destroy your career and life. Consequences include:</p>
                <h4>Criminal Charges:</h4>
                <ul>
                    <li><strong>Assault:</strong> Threatening or attempting to harm someone</li>
                    <li><strong>Battery:</strong> Unlawful physical contact or harm</li>
                    <li><strong>False Imprisonment:</strong> Unlawfully restraining someone</li>
                    <li><strong>Kidnapping:</strong> Moving someone against their will</li>
                </ul>
                <h4>Civil Lawsuits:</h4>
                <ul>
                    <li>Personal injury claims</li>
                    <li>Violation of civil rights</li>
                    <li>Emotional distress</li>
                    <li>You can be personally sued and lose everything</li>
                </ul>
                <h4>Professional Consequences:</h4>
                <ul>
                    <li><strong>License Revocation:</strong> Permanent loss of security guard license</li>
                    <li><strong>Immediate Termination:</strong> Fired from your job</li>
                    <li><strong>Industry Blacklist:</strong> Unable to work in security again</li>
                </ul>
                <h4>Employer Liability:</h4>
                <p>Your employer can also be sued for your actions, which is why companies have strict policies.</p>
            `
        },
        {
            title: 'State-Specific Laws',
            content: `
                <h3>Your State Requirements</h3>
                <p>Security guard laws vary <strong>significantly</strong> by state. Select your state below to view specific requirements:</p>
                <div class="slide-interactive">
                    <label for="stateSelector" style="display: block; margin-bottom: 0.5rem; font-weight: 600;"><i class="fas fa-map-marker-alt"></i> Select Your State:</label>
                    <select id="stateSelector" onchange="updateStateInfo(this.value)" style="width: 100%; padding: 0.75rem; margin-bottom: 1.5rem; font-size: 1rem; border: 2px solid var(--border-color); border-radius: 0.5rem; background: var(--surface);">
                        <option value="">-- Choose a State --</option>
                        <option value="AL">Alabama</option>
                        <option value="AK">Alaska</option>
                        <option value="AZ">Arizona</option>
                        <option value="CA">California</option>
                        <option value="FL">Florida</option>
                        <option value="GA">Georgia</option>
                        <option value="IL">Illinois</option>
                        <option value="MI">Michigan</option>
                        <option value="NY">New York</option>
                        <option value="NC">North Carolina</option>
                        <option value="OH">Ohio</option>
                        <option value="PA">Pennsylvania</option>
                        <option value="TX">Texas</option>
                        <option value="VA">Virginia</option>
                        <option value="WA">Washington</option>
                    </select>
                </div>
                <div id="stateInfoDisplay">
                    <p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Select a state above to view specific requirements, use of force laws, and licensing information.</p>
                </div>
            `
        },
        {
            title: 'Best Practices Summary',
            content: `
                <h3>Use of Force Best Practices</h3>
                <p>Follow these guidelines to protect yourself and others:</p>
                <h4>✓ DO:</h4>
                <ul>
                    <li>Use verbal de-escalation as your first tool</li>
                    <li>Call police for situations requiring force</li>
                    <li>Document everything thoroughly in reports</li>
                    <li>Know and follow your company's use of force policy</li>
                    <li>Understand your state's specific laws</li>
                    <li>Retreat if you can do so safely</li>
                    <li>Use only reasonable, proportional force in self-defense</li>
                    <li>Stop using force when the threat ends</li>
                </ul>
                <h4>✗ DON'T:</h4>
                <ul>
                    <li>Use force to enforce rules or eject people</li>
                    <li>Chase suspects or pursue off property</li>
                    <li>Touch people unless absolutely necessary for safety</li>
                    <li>Exceed your legal authority</li>
                    <li>Act like a police officer</li>
                    <li>Use weapons without proper licensing</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-lightbulb"></i> Golden Rule</h4>
                    <p><strong>When in doubt, observe and report.</strong> Your role is to be the eyes and ears, not to be a hero.</p>
                </div>
            `
        },
        {
            title: 'Module Complete',
            content: `
                <h3>Use of Force Training Complete</h3>
                <p>You've completed this critical training on use of force and legal responsibilities.</p>
                <h4>Key Takeaways:</h4>
                <ul>
                    <li><strong>Legal Status:</strong> You're a private citizen, not a police officer</li>
                    <li><strong>Force Continuum:</strong> Start with presence and verbal, escalate only if necessary</li>
                    <li><strong>Limited Authority:</strong> Force only for self-defense or defense of others</li>
                    <li><strong>High Liability:</strong> Improper force = criminal charges and lawsuits</li>
                    <li><strong>State Laws:</strong> Know your specific state's requirements</li>
                    <li><strong>Best Practice:</strong> Observe, report, and call police</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Module Complete!</h4>
                    <p>You now understand the legal boundaries of your authority. Remember: your safety and legal protection come from knowing when NOT to use force.</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-circle"></i> Next Steps</h4>
                    <p>Consult your state's security guard licensing board for specific requirements. Complete any required state-mandated training before working.</p>
                </div>
            `
        }
    ],
    'stop-the-bleed': [
        {
            title: 'STOP THE BLEED® Emergency Medical Response',
            content: `
                <h3>STOP THE BLEED® - Save a Life</h3>
                <p>Welcome to STOP THE BLEED® training. This life-saving program empowers you to control severe bleeding until professional medical help arrives.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-heart"></i> Critical Facts</h4>
                    <ul>
                        <li>Severe bleeding can cause death in <strong>5 minutes or less</strong></li>
                        <li>Immediate action by bystanders/security can save lives</li>
                        <li>You don't need medical training - just knowledge and action</li>
                        <li>Based on lessons from military combat medicine</li>
                    </ul>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Your Role</h4>
                    <p>As security personnel, you are often first on scene. Your quick action in the first critical minutes can mean the difference between life and death.</p>
                </div>
            `
        },
        {
            title: 'The Three Steps',
            content: `
                <h3>STOP THE BLEED® - Three Simple Steps</h3>
                <p>Remember these three steps to save a life:</p>
                <h4>1. IDENTIFY the Bleeding</h4>
                <p>Remove or cut clothing to locate the source of bleeding. You can't treat what you can't see.</p>
                <h4>2. APPLY Pressure</h4>
                <p>Use your hands, dressings, or tourniquets to stop the bleeding. Direct pressure is your first tool.</p>
                <h4>3. GET Help</h4>
                <p>Call 911 immediately and continue care until EMS arrives. Don't stop treatment.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-lightbulb"></i> Key Principle</h4>
                    <p><strong>Time is critical.</strong> Every second counts when someone is bleeding severely. Don't hesitate - immediate action saves lives.</p>
                </div>
            `
        },
        {
            title: 'Types of Bleeding',
            content: `
                <h3>Recognizing Types of Bleeding</h3>
                <h4><i class="fas fa-exclamation-circle"></i> Arterial (Life-Threatening)</h4>
                <p><strong>Bright red, spurting blood</strong> - Requires immediate tourniquet application. This is the most dangerous type.</p>
                <h4><i class="fas fa-exclamation-triangle"></i> Venous (Serious)</h4>
                <p><strong>Dark red, steady flow</strong> - Apply direct pressure with dressings. Serious but controllable.</p>
                <h4><i class="fas fa-info-circle"></i> Capillary (Minor)</h4>
                <p><strong>Slow oozing</strong> - Standard first aid is sufficient. Not immediately life-threatening.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-hand-paper"></i> Recognition is Key</h4>
                    <p>Quickly identifying the type of bleeding helps you choose the right intervention. Arterial bleeding = tourniquet NOW.</p>
                </div>
            `
        },
        {
            title: 'Direct Pressure',
            content: `
                <h3>Direct Pressure Technique</h3>
                <p>Your first and most important tool for controlling bleeding:</p>
                <ol>
                    <li><strong>Expose the wound</strong> - Remove or cut clothing away</li>
                    <li><strong>Place gauze/cloth</strong> - Directly on the wound</li>
                    <li><strong>Apply firm pressure</strong> - Use both hands, push hard</li>
                    <li><strong>Maintain for 3+ minutes</strong> - Don't release to "check"</li>
                    <li><strong>Add more dressings</strong> - If blood soaks through, DON'T remove original</li>
                </ol>
                <div class="slide-callout">
                    <h4><i class="fas fa-hand-rock"></i> Push Hard, Don't Stop</h4>
                    <p>You can't hurt them more by pushing too hard. The real danger is not pushing hard enough or releasing pressure too soon.</p>
                </div>
            `
        },
        {
            title: 'Tourniquet Application',
            content: `
                <h3>Tourniquet - When Life is on the Line</h3>
                <h4>When to Use:</h4>
                <p>Arterial bleeding from arm or leg that won't stop with direct pressure. Don't wait - if it's spurting, apply tourniquet immediately.</p>
                <h4>How to Apply:</h4>
                <ul>
                    <li><strong>Placement:</strong> 2-3 inches ABOVE wound, never on a joint</li>
                    <li><strong>Tighten:</strong> Until bleeding stops completely - it will hurt, that's normal</li>
                    <li><strong>Document time:</strong> Write exact time on tourniquet or victim's forehead</li>
                    <li><strong>Never remove:</strong> Only medical professionals can remove it</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-times-circle"></i> Myth Busted</h4>
                    <p><strong>FALSE:</strong> "Tourniquets always cause limb loss." Modern tourniquets are safe and effective. Limb loss is rare; death from bleeding is not.</p>
                </div>
            `
        },
        {
            title: 'Wound Packing',
            content: `
                <h3>Wound Packing for Junctional Bleeding</h3>
                <p>Used when tourniquets can't be applied: neck, groin, armpit, or very deep wounds.</p>
                <h4>Technique:</h4>
                <ol>
                    <li>Use hemostatic gauze (QuikClot, Celox) if available</li>
                    <li>Pack gauze deep into the wound cavity - fill it completely</li>
                    <li>Apply direct pressure over the packed wound</li>
                    <li>Maintain pressure for 3+ minutes minimum</li>
                    <li>Keep pressure until EMS arrives</li>
                </ol>
                <div class="slide-callout">
                    <h4><i class="fas fa-hand-holding-medical"></i> Don't Be Gentle</h4>
                    <p>Pack the wound firmly and deeply. This is not comfortable for the victim, but it saves their life.</p>
                </div>
            `
        },
        {
            title: 'Scene Safety & Protection',
            content: `
                <h3>Protect Yourself First</h3>
                <p><strong>Scene Safety is Priority #1</strong> - You can't help if you become a victim.</p>
                <h4>Before Approaching:</h4>
                <ul>
                    <li>Ensure area is safe (no active threat, fire, hazards)</li>
                    <li>Look for weapons, broken glass, sharp objects</li>
                    <li>Assess for ongoing danger</li>
                </ul>
                <h4>Body Substance Isolation (BSI):</h4>
                <ul>
                    <li><strong>Gloves:</strong> Always wear if available (nitrile or latex)</li>
                    <li><strong>Eye protection:</strong> Protect from blood splatter</li>
                    <li><strong>Avoid contact:</strong> Don't touch blood with bare hands</li>
                    <li><strong>Wash thoroughly:</strong> After care, even if you wore gloves</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> Your Safety Matters</h4>
                    <p>If the scene is unsafe, wait for law enforcement. A dead rescuer helps no one.</p>
                </div>
            `
        },
        {
            title: 'Calling for Help & Shock',
            content: `
                <h3>Get Help & Prevent Shock</h3>
                <h4>Calling 911:</h4>
                <ul>
                    <li>Call immediately or designate someone specific</li>
                    <li>Provide: Location, number of victims, injuries, what you're doing</li>
                    <li>Use radio: Code Red (medical emergency)</li>
                    <li>Continue care while help is coming</li>
                </ul>
                <h4>Shock Management:</h4>
                <p><strong>Signs:</strong> Pale/cold/clammy skin, rapid pulse, confusion, weakness</p>
                <p><strong>Treatment:</strong></p>
                <ul>
                    <li>Lay victim flat</li>
                    <li>Elevate legs 12 inches (if no spinal injury)</li>
                    <li>Keep warm with blanket/jacket</li>
                    <li>Reassure and keep calm</li>
                </ul>
            `
        },
        {
            title: 'Legal Protection',
            content: `
                <h3>Good Samaritan Laws Protect You</h3>
                <p>All 50 states have Good Samaritan laws protecting those who provide emergency care.</p>
                <h4>You Are Protected When:</h4>
                <ul>
                    <li>Acting in good faith to help</li>
                    <li>Not acting with gross negligence</li>
                    <li>Providing care within your training level</li>
                    <li>Not expecting payment for care</li>
                </ul>
                <h4>Consent:</h4>
                <ul>
                    <li><strong>Conscious victims:</strong> Ask permission before helping</li>
                    <li><strong>Unconscious victims:</strong> Implied consent - help immediately</li>
                    <li><strong>Minors:</strong> Implied consent if parent not present</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-gavel"></i> You're Protected</h4>
                    <p>Don't hesitate to help because of legal fears. Good Samaritan laws are designed to encourage people to save lives.</p>
                </div>
            `
        },
        {
            title: 'Module Complete',
            content: `
                <h3>STOP THE BLEED® Training Complete</h3>
                <p>You now have the knowledge to save a life by controlling severe bleeding.</p>
                <h4>Key Takeaways:</h4>
                <ul>
                    <li><strong>Time is critical:</strong> Severe bleeding can kill in 5 minutes</li>
                    <li><strong>Three steps:</strong> Identify, Apply pressure, Get help</li>
                    <li><strong>Direct pressure first:</strong> Your primary tool</li>
                    <li><strong>Tourniquets save lives:</strong> Don't hesitate on arterial bleeding</li>
                    <li><strong>Scene safety first:</strong> Protect yourself</li>
                    <li><strong>You're protected:</strong> Good Samaritan laws in all states</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Module Complete!</h4>
                    <p>You are now prepared to STOP THE BLEED and save lives. Remember: doing something is always better than doing nothing.</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-hands-helping"></i> Next Steps</h4>
                    <p>Practice tourniquet application monthly. Know where STOP THE BLEED® kits are located at your venue. Be ready to act when seconds count.</p>
                </div>
            `
        }
    ],
    'diverse-population': [
        {
            title: 'Interacting with a Diverse Population',
            content: `
                <h3>Cultural Competency and Inclusive Security</h3>
                <p>Welcome to training on interacting with diverse populations. Professional security means serving everyone with respect and dignity.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-users"></i> Why This Matters</h4>
                    <ul>
                        <li>Events attract people from all backgrounds, cultures, and abilities</li>
                        <li>Professional service requires understanding differences</li>
                        <li>Legal requirements under ADA and civil rights laws</li>
                        <li>Your actions represent your employer and the profession</li>
                    </ul>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-handshake"></i> Core Principle</h4>
                    <p><strong>Respect, Awareness, Accessibility, Communication, Fairness</strong> - These are the foundations of inclusive security.</p>
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
            title: 'Cultural Competency',
            content: `
                <h3>Understanding Cultural Differences</h3>
                <h4>Key Principles:</h4>
                <ul>
                    <li><strong>Avoid Stereotypes:</strong> Treat people as individuals</li>
                    <li><strong>Personal Space:</strong> Norms vary by culture - be mindful</li>
                    <li><strong>Eye Contact:</strong> Some cultures view direct eye contact as disrespectful</li>
                    <li><strong>Language Barriers:</strong> Use simple language, gestures, translation apps</li>
                </ul>
                <h4>Religious and Cultural Dress:</h4>
                <ul>
                    <li>Hijabs, turbans, yarmulkes must be respected</li>
                    <li>Screen without requiring removal when possible</li>
                    <li>Offer private screening if needed</li>
                    <li>Never mock or comment on religious dress</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-globe"></i> Remember</h4>
                    <p>Different doesn't mean wrong. Cultural diversity enriches our events and communities.</p>
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
            title: 'Module Complete',
            content: `
                <h3>Diversity Training Complete</h3>
                <p>You now have the knowledge to provide inclusive, professional security services to all people.</p>
                <h4>Key Takeaways:</h4>
                <ul>
                    <li><strong>Everyone deserves respect</strong> - No exceptions</li>
                    <li><strong>ADA compliance is required</strong> - Know service animal rules</li>
                    <li><strong>Behavior, not appearance</strong> - Focus on actions</li>
                    <li><strong>Racial profiling is illegal</strong> - And morally wrong</li>
                    <li><strong>Ask, don't assume</strong> - When unsure, respectfully inquire</li>
                    <li><strong>Intervene against discrimination</strong> - Zero tolerance</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Module Complete!</h4>
                    <p>Professional security means protecting and serving everyone equally. Diversity makes our events and communities stronger.</p>
                </div>
            `
        }
    ],
    'ics-100': [
        {
            title: 'Introduction to Incident Command System (ICS-100)',
            content: `
                <h3>What is ICS?</h3>
                <p>The Incident Command System (ICS) is a standardized approach to command, control, and coordination of emergency response.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-sitemap"></i> Why ICS Matters</h4>
                    <ul>
                        <li>Used by ALL emergency responders nationwide</li>
                        <li>Provides common organizational structure</li>
                        <li>Enables different agencies to work together</li>
                        <li>Required knowledge for security professionals</li>
                    </ul>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-info-circle"></i> Origin</h4>
                    <p>Developed after 1970s California wildfires when agencies couldn't coordinate effectively. Now mandated by Homeland Security Presidential Directive (HSPD-5).</p>
                </div>
            `
        },
        {
            title: 'ICS Organizational Structure',
            content: `
                <h3>ICS Organization</h3>
                <h4>Command Staff:</h4>
                <ul>
                    <li><strong>Incident Commander (IC):</strong> Overall authority</li>
                    <li><strong>Public Information Officer (PIO):</strong> Media liaison</li>
                    <li><strong>Safety Officer (SO):</strong> Monitors safety</li>
                    <li><strong>Liaison Officer (LNO):</strong> Agency coordination</li>
                </ul>
                <h4>General Staff (Section Chiefs):</h4>
                <ul>
                    <li><strong>Operations:</strong> Tactical operations</li>
                    <li><strong>Planning:</strong> Information and planning</li>
                    <li><strong>Logistics:</strong> Resources and support</li>
                    <li><strong>Finance/Admin:</strong> Cost tracking</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> Security's Role</h4>
                    <p>Security typically works in the <strong>Operations Section</strong> performing perimeter control, crowd management, and facility protection.</p>
                </div>
            `
        },
        {
            title: 'Core ICS Principles',
            content: `
                <h3>Key ICS Principles</h3>
                <ul>
                    <li><strong>Common Terminology:</strong> Everyone uses same terms</li>
                    <li><strong>Modular Organization:</strong> Expand/contract as needed</li>
                    <li><strong>Management by Objectives:</strong> Clear goals</li>
                    <li><strong>Span of Control:</strong> 3-7 people per supervisor (ideal: 5)</li>
                    <li><strong>Chain of Command:</strong> Clear reporting relationships</li>
                    <li><strong>Unified Command:</strong> Multiple agencies, one plan</li>
                    <li><strong>Accountability:</strong> Everyone has assignment and supervisor</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Critical Rule</h4>
                    <p>Report to <strong>ONE</strong> supervisor only. Receive assignments from <strong>ONE</strong> supervisor only. Don't skip levels in the chain of command.</p>
                </div>
            `
        },
        {
            title: 'Resource Management',
            content: `
                <h3>Managing Resources in ICS</h3>
                <h4>Resource Types:</h4>
                <ul>
                    <li><strong>Single Resource:</strong> Individual person or equipment</li>
                    <li><strong>Strike Team:</strong> Same type of resources (5 security officers)</li>
                    <li><strong>Task Force:</strong> Different resources (security + medical + fire)</li>
                </ul>
                <h4>Resource Status:</h4>
                <ul>
                    <li><strong>Assigned:</strong> Working on tactical assignment</li>
                    <li><strong>Available:</strong> Ready for assignment</li>
                    <li><strong>Out of Service:</strong> Rest, repair, unavailable</li>
                </ul>
                <h4>Check-In Process:</h4>
                <p><strong>ALWAYS check in</strong> when arriving at an incident. Provide: Name, agency, qualifications, resources.</p>
            `
        },
        {
            title: 'Incident Action Plan (IAP)',
            content: `
                <h3>The Incident Action Plan</h3>
                <p>A plan for managing an incident during an operational period (usually 12-24 hours).</p>
                <h4>IAP Components:</h4>
                <ul>
                    <li><strong>Objectives:</strong> What we want to accomplish</li>
                    <li><strong>Strategies:</strong> How we'll accomplish objectives</li>
                    <li><strong>Tactics:</strong> Specific actions</li>
                    <li><strong>Resource Assignments:</strong> Who does what</li>
                    <li><strong>Safety Considerations:</strong> Hazards and precautions</li>
                    <li><strong>Communications Plan:</strong> Radio frequencies, phone numbers</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-clipboard-list"></i> Your Responsibility</h4>
                    <p>Follow the IAP. If you don't understand your assignment, ask questions before starting work.</p>
                </div>
            `
        },
        {
            title: 'Security Guard Responsibilities',
            content: `
                <h3>Your Role in ICS</h3>
                <h4>What You Must Do:</h4>
                <ol>
                    <li><strong>Check In:</strong> First thing upon arrival</li>
                    <li><strong>Get Assignment:</strong> Clear instructions from supervisor</li>
                    <li><strong>Follow Chain of Command:</strong> Report to assigned supervisor only</li>
                    <li><strong>Maintain Accountability:</strong> Know your location and assignment</li>
                    <li><strong>Communicate:</strong> Report status and problems</li>
                    <li><strong>Document:</strong> Keep activity log (ICS 214)</li>
                    <li><strong>Safety First:</strong> Report hazards immediately</li>
                </ol>
                <div class="slide-callout">
                    <h4><i class="fas fa-tasks"></i> Common Security Assignments</h4>
                    <p>Perimeter security, access control, traffic control, crowd management, facility protection, evidence preservation.</p>
                </div>
            `
        },
        {
            title: 'Module Complete',
            content: `
                <h3>ICS-100 Training Complete</h3>
                <p>You now understand the basics of the Incident Command System and your role in emergency response.</p>
                <h4>Key Takeaways:</h4>
                <ul>
                    <li>ICS provides common structure for ALL incidents</li>
                    <li>Security typically works in Operations Section</li>
                    <li>Always check in upon arrival</li>
                    <li>Follow chain of command - one supervisor only</li>
                    <li>Use common terminology and plain language</li>
                    <li>Maintain accountability at all times</li>
                    <li>Document your activities (ICS 214)</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Module Complete!</h4>
                    <p>ICS knowledge makes you a professional asset. Consider taking the free FEMA ICS-100 online course for official certification.</p>
                </div>
            `
        }
    ],
    'threat-assessment': [
        {
            title: 'Threat Assessment & Situational Awareness',
            content: `
                <h3>Situational Awareness</h3>
                <p>The ability to identify, process, and comprehend critical information about your environment.</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-eye"></i> Cooper's Color Codes</h4>
                    <ul>
                        <li><strong>White:</strong> Unaware - AVOID THIS</li>
                        <li><strong>Yellow:</strong> Relaxed alert - NORMAL for security</li>
                        <li><strong>Orange:</strong> Specific threat identified</li>
                        <li><strong>Red:</strong> Immediate threat, taking action</li>
                    </ul>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-sync"></i> OODA Loop</h4>
                    <p><strong>Observe → Orient → Decide → Act</strong> - Continuously repeat this process to stay ahead of threats.</p>
                </div>
            `
        },
        {
            title: 'Threat Recognition',
            content: `
                <h3>Pre-Attack Indicators</h3>
                <h4>Behavioral Cues:</h4>
                <ul>
                    <li><strong>Surveillance:</strong> Watching security, taking photos</li>
                    <li><strong>Elicitation:</strong> Asking unusual questions</li>
                    <li><strong>Testing Security:</strong> Probing for weaknesses</li>
                    <li><strong>Suspicious Behavior:</strong> Nervous, sweating, avoiding eye contact</li>
                    <li><strong>Inappropriate Dress:</strong> Heavy clothing in warm weather</li>
                </ul>
                <h4>Physical Threat Indicators:</h4>
                <ul>
                    <li>Aggressive posture, clenched fists</li>
                    <li>Target glancing (looking where they'll strike)</li>
                    <li>Blade stance (sideways fighting position)</li>
                    <li>Facial flushing, rapid breathing</li>
                </ul>
            `
        },
        {
            title: 'De-escalation Defined (SG-9)',
            content: `
                <h3>What is De-escalation?</h3>
                <p><strong>Definition:</strong> Techniques used to prevent a situation from escalating to violence.</p>
                <h4>Core Principles:</h4>
                <ul>
                    <li><strong>Respect:</strong> Treat with dignity</li>
                    <li><strong>Empathy:</strong> Understand their perspective</li>
                    <li><strong>Patience:</strong> Allow time for emotions to decrease</li>
                    <li><strong>Calm Presence:</strong> Your composure influences them</li>
                    <li><strong>Active Listening:</strong> Hear what they're really saying</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-comments"></i> Goal</h4>
                    <p>Gain voluntary compliance without use of force. Resolve conflicts through communication rather than confrontation.</p>
                </div>
            `
        },
        {
            title: 'Time, Distance, Cover (SG-10)',
            content: `
                <h3>Tactical De-escalation Tools</h3>
                <h4>Time:</h4>
                <ul>
                    <li>Slow the situation - let emotions cool</li>
                    <li>Give person time to think and respond</li>
                    <li>Wait for backup if needed</li>
                    <li>Anger is exhausting - time works in your favor</li>
                </ul>
                <h4>Distance:</h4>
                <ul>
                    <li>Maintain 6-10 feet when possible</li>
                    <li>21-Foot Rule: Person with knife can close 21 feet in 1.5 seconds</li>
                    <li>Stand at 45-degree angle, not directly facing</li>
                    <li>Always know your escape route</li>
                </ul>
                <h4>Cover vs. Concealment:</h4>
                <ul>
                    <li><strong>Cover:</strong> Stops bullets (concrete, engine blocks)</li>
                    <li><strong>Concealment:</strong> Hides you (bushes, drywall)</li>
                </ul>
            `
        },
        {
            title: 'Communication in De-escalation (SG-11)',
            content: `
                <h3>Verbal De-escalation</h3>
                <h4>The LEAPS Model:</h4>
                <ul>
                    <li><strong>L - Listen:</strong> Actively hear their concerns</li>
                    <li><strong>E - Empathize:</strong> Show you understand feelings</li>
                    <li><strong>A - Ask:</strong> Questions to understand situation</li>
                    <li><strong>P - Paraphrase:</strong> Repeat back what you heard</li>
                    <li><strong>S - Summarize:</strong> Recap and propose solutions</li>
                </ul>
                <h4>Phrases to Use:</h4>
                <ul>
                    <li>"I want to help you, can you tell me what's wrong?"</li>
                    <li>"I understand this is frustrating for you"</li>
                    <li>"Let's work together to find a solution"</li>
                </ul>
                <h4>Phrases to AVOID:</h4>
                <ul>
                    <li>"Calm down" or "Relax" (dismissive)</li>
                    <li>"You need to..." (commanding)</li>
                    <li>"That's not my problem" (uncaring)</li>
                </ul>
            `
        },
        {
            title: 'Module Complete',
            content: `
                <h3>Threat Assessment Training Complete</h3>
                <p>You now have the skills to identify threats and de-escalate potentially violent situations.</p>
                <h4>Key Takeaways:</h4>
                <ul>
                    <li>Maintain yellow level awareness at all times</li>
                    <li>Trust your instincts - if something feels wrong, it probably is</li>
                    <li>Use time and distance as your best de-escalation tools</li>
                    <li>Communication is key - LEAPS model</li>
                    <li>Know when de-escalation won't work</li>
                    <li>Retreat is not failure, it's tactics</li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Module Complete!</h4>
                    <p>Your ability to assess threats and de-escalate situations will prevent violence and save lives.</p>
                </div>
            `
        }
    ]
};

// Initialize slideshow for a module
function startModule(moduleId) {
    currentModuleId = moduleId;
    currentModuleSlides = moduleSlidesData[moduleId];
    currentSlideIndex = 0;
    
    const module = moduleContent[moduleId];
    document.getElementById('moduleTitle').textContent = module.title;
    
    // Generate slide dots
    generateSlideDots();
    
    // Load first slide
    loadSlide(0);
    
    // Show modal
    document.getElementById('moduleModal').classList.add('active');
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
    
    container.innerHTML = `
        <div class="slide active">
            ${slide.content}
        </div>
    `;
    
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

function completeModule() {
    if (currentModuleId && !progressData.completedModules.includes(currentModuleId)) {
        progressData.completedModules.push(currentModuleId);
        addActivity(`Completed module: ${moduleContent[currentModuleId].title}`);
        saveProgress();
    }
    
    // Close modal and navigate to appropriate assessment
    closeModule();
    
    // Map modules to their corresponding assessments
    const moduleToAssessment = {
        'communication-protocols': 'communication',
        'stop-the-bleed': 'emergency-response',
        'threat-assessment': 'threat-assessment',
        'ics-100': 'emergency-response',
        'diverse-population': 'crowd-management',
        'crowd-management': 'crowd-management',
        'use-of-force': 'access-control'
    };
    
    const assessmentId = moduleToAssessment[currentModuleId];
    
    if (assessmentId) {
        navigateToSection('assessment');
        // Small delay to ensure section is visible before starting assessment
        setTimeout(() => {
            if (typeof startAssessment === 'function') {
                startAssessment(assessmentId);
            }
        }, 100);
    } else {
        // Default to assessment section if no specific mapping
        navigateToSection('assessment');
    }
}

function closeModule() {
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
