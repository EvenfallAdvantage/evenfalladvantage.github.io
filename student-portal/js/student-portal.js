// Global State
let currentSection = 'home';
let currentModule = null;
let currentScenario = null;
let canvasItems = [];
// Assessment State
let currentAssessment = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let shuffledQuestions = [];
let assessmentStartTime = null;
let timerInterval = null;
let assessmentAttempts = {}; // Track attempts per assessment

// Load training modules from database
async function loadTrainingModules() {
    const container = document.getElementById('trainingModulesContainer');
    
    try {
        const { data: modules, error } = await supabase
            .from('training_modules')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true});
        
        if (error) throw error;
        
        if (!modules || modules.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 2rem;">No training modules available yet.</p>';
            return;
        }
        
        // Generate module cards with completion indicators
        container.innerHTML = modules.map((module, index) => {
            const completionStatus = getModuleCompletionStatus(module.module_code);
            const isCompleted = completionStatus.completed && !completionStatus.expired;
            const isExpired = completionStatus.expired;
            
            let statusClass = '';
            let statusBadge = '';
            let buttonText = 'Start Module';
            let buttonIcon = 'fa-play';
            
            if (isExpired) {
                statusClass = 'expired';
                statusBadge = `<div class="completion-badge expired"><i class="fas fa-exclamation-triangle"></i> Expired - Recertify</div>`;
                buttonText = 'Recertify';
                buttonIcon = 'fa-redo';
            } else if (isCompleted) {
                statusClass = 'completed';
                const expiresText = completionStatus.expiresIn ? ` (Expires in ${completionStatus.expiresIn})` : '';
                statusBadge = `<div class="completion-badge"><i class="fas fa-check-circle"></i> Certified${expiresText}</div>`;
                buttonText = 'Review Module';
                buttonIcon = 'fa-check-circle';
            }
            
            return `
                <div class="module-card ${statusClass}" data-module="${module.module_code}">
                    ${statusBadge}
                    <div class="module-icon">
                        <i class="fas ${module.icon || 'fa-book'}"></i>
                    </div>
                    <h3>Module ${index + 1}: ${module.module_name}</h3>
                    <p>${module.description || 'No description available'}</p>
                    <div class="module-meta">
                        <span><i class="fas fa-clock"></i> ${module.estimated_time || 'TBD'}</span>
                        <span><i class="fas fa-signal"></i> ${module.difficulty_level || 'Essential'}</span>
                    </div>
                    <button class="btn btn-secondary" onclick="startModule('${module.module_code}')">
                        <i class="fas ${buttonIcon}"></i> ${buttonText}
                    </button>
                </div>
            `;
        }).join('');
        
        console.log(`Loaded ${modules.length} training modules`);
    } catch (error) {
        console.error('Error loading training modules:', error);
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: red;">Error loading modules. Please refresh the page.</p>';
    }
}

// Load assessments from database
async function loadAssessments() {
    const container = document.querySelector('.assessment-list');
    if (!container) return;
    
    try {
        const { data: assessments, error } = await supabase
            .from('assessments')
            .select(`
                *,
                training_modules (
                    module_code,
                    module_name,
                    display_order
                )
            `);
        
        if (error) throw error;
        
        if (!assessments || assessments.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 2rem;">No assessments available yet.</p>';
            return;
        }
        
        // Sort assessments by module display_order
        const sortedAssessments = assessments.sort((a, b) => {
            const orderA = a.training_modules?.display_order || 999;
            const orderB = b.training_modules?.display_order || 999;
            return orderA - orderB;
        });
        
        // Separate assessments by category
        const coreAssessments = sortedAssessments.filter(a => a.category === 'Event Security Core');
        const miscAssessments = sortedAssessments.filter(a => a.category === 'Miscellaneous');
        const comprehensiveAssessments = sortedAssessments.filter(a => 
            a.assessment_name.includes('Comprehensive') || a.category === 'Comprehensive'
        );
        
        // Generate assessment items
        let html = '';
        
        // Event Security Core assessments
        if (coreAssessments.length > 0) {
            html += coreAssessments.map(assessment => {
                const moduleCode = assessment.training_modules?.module_code || assessment.assessment_name.toLowerCase().replace(/\s+/g, '-');
                
                return `
                    <div class="assessment-item" 
                         data-assessment="${moduleCode}" 
                         data-required-module="${moduleCode}"
                         onclick="startAssessment('${moduleCode}')">
                        <i class="fas ${assessment.icon || 'fa-clipboard-check'}"></i>
                        <div>
                            <h4>${assessment.assessment_name}</h4>
                            <p>${assessment.total_questions || 10} questions • ${assessment.time_limit_minutes || 20} minutes</p>
                        </div>
                        <button class="btn btn-small btn-primary">Start</button>
                    </div>
                `;
            }).join('');
        }
        
        // Miscellaneous assessments
        if (miscAssessments.length > 0) {
            html += miscAssessments.map(assessment => {
                const moduleCode = assessment.training_modules?.module_code || assessment.assessment_name.toLowerCase().replace(/\s+/g, '-');
                
                return `
                    <div class="assessment-item" 
                         data-assessment="${moduleCode}" 
                         data-required-module="${moduleCode}"
                         onclick="startAssessment('${moduleCode}')">
                        <i class="fas ${assessment.icon || 'fa-clipboard-check'}"></i>
                        <div>
                            <h4>${assessment.assessment_name}</h4>
                            <p>${assessment.total_questions || 10} questions • ${assessment.time_limit_minutes || 20} minutes</p>
                        </div>
                        <button class="btn btn-small btn-primary">Start</button>
                    </div>
                `;
            }).join('');
        }
        
        // Comprehensive assessment (always at the end)
        if (comprehensiveAssessments.length > 0) {
            html += comprehensiveAssessments.map(assessment => {
                return `
                    <div class="assessment-item" 
                         data-assessment="comprehensive" 
                         data-required-all="true"
                         onclick="startAssessment('comprehensive')">
                        <i class="fas ${assessment.icon || 'fa-certificate'}"></i>
                        <div>
                            <h4>${assessment.assessment_name}</h4>
                            <p>${assessment.total_questions || 50} questions • ${assessment.time_limit_minutes || 75} minutes</p>
                        </div>
                        <button class="btn btn-small btn-primary">Start</button>
                    </div>
                `;
            }).join('');
        }
        
        container.innerHTML = html;
        
        // Update assessment availability after loading
        updateAssessmentAvailability();
        
        console.log(`Loaded ${assessments.length} assessments`);
    } catch (error) {
        console.error('Error loading assessments:', error);
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: red;">Error loading assessments. Please refresh the page.</p>';
    }
}

// Progress State
let progressData = {
    completedModules: [],
    completedScenarios: [],
    assessmentResults: [],
    activities: []
};

// Module expiration periods (in months)
const MODULE_EXPIRATION = {
    'stop-the-bleed': 6,
    'threat-assessment': 6,
    'use-of-force': 6,
    'default': 12
};

// Get module completion status with expiration check
function getModuleCompletionStatus(moduleCode) {
    // Check if assessment was passed
    const passedAssessment = progressData.assessmentResults.find(
        result => (result.module === moduleCode || result.assessment === moduleCode) && result.passed
    );
    
    if (!passedAssessment) {
        return { completed: false, expired: false };
    }
    
    // Get expiration period for this module
    const expirationMonths = MODULE_EXPIRATION[moduleCode] || MODULE_EXPIRATION.default;
    
    // Calculate expiration date
    const completionDate = new Date(passedAssessment.date);
    const expirationDate = new Date(completionDate);
    expirationDate.setMonth(expirationDate.getMonth() + expirationMonths);
    
    const now = new Date();
    const isExpired = now > expirationDate;
    
    // Calculate time until expiration
    let expiresIn = '';
    if (!isExpired) {
        const daysUntilExpiration = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiration <= 30) {
            expiresIn = `${daysUntilExpiration} days`;
        } else {
            const monthsUntilExpiration = Math.floor(daysUntilExpiration / 30);
            expiresIn = `${monthsUntilExpiration} month${monthsUntilExpiration > 1 ? 's' : ''}`;
        }
    }
    
    return {
        completed: true,
        expired: isExpired,
        expiresIn: expiresIn,
        completionDate: completionDate,
        expirationDate: expirationDate
    };
}

// Load progress from localStorage
function loadProgress() {
    const saved = localStorage.getItem('securityTrainingProgress');
    if (saved) {
        progressData = JSON.parse(saved);
    }
    
    // Ensure all arrays exist
    if (!progressData.completedModules) progressData.completedModules = [];
    if (!progressData.completedScenarios) progressData.completedScenarios = [];
    if (!progressData.assessmentResults) progressData.assessmentResults = [];
    if (!progressData.activities) progressData.activities = [];
    
    // Migrate old assessment results that use assessment names instead of module codes
    migrateAssessmentResults();
    
    updateProgressDisplay();
}

// Migrate old assessment results to use module codes
function migrateAssessmentResults() {
    const assessmentNameToModuleCode = {
        'Security Radio Communications': 'communication-protocols',
        'Module 1: Security Radio Communications': 'communication-protocols',
        'STOP THE BLEED®': 'stop-the-bleed',
        'Module 2: STOP THE BLEED®': 'stop-the-bleed',
        'Threat Assessment & Situational Awareness': 'threat-assessment',
        'Module 3: Threat Assessment & Situational Awareness': 'threat-assessment',
        'Introduction to ICS-100': 'ics-100',
        'Module 4: Introduction to ICS-100': 'ics-100',
        'Interacting with Diverse Populations': 'diverse-population',
        'Module 5: Interacting with Diverse Populations': 'diverse-population',
        'Crowd Management & Public Safety': 'crowd-management',
        'Module 6: Crowd Management & Public Safety': 'crowd-management',
        'Legal Aspects & Use of Force': 'use-of-force',
        'Module 7: Legal Aspects & Use of Force': 'use-of-force',
        'Comprehensive Guard Certification': 'comprehensive'
    };
    
    let migrated = false;
    progressData.assessmentResults = progressData.assessmentResults.map(result => {
        // If module is missing or is an assessment name, fix it
        if (!result.module || assessmentNameToModuleCode[result.module]) {
            migrated = true;
            const moduleCode = assessmentNameToModuleCode[result.module] || 
                              assessmentNameToModuleCode[result.assessment] || 
                              result.assessment;
            return {
                ...result,
                module: moduleCode,
                assessment: moduleCode
            };
        }
        return result;
    });
    
    if (migrated) {
        console.log('Migrated assessment results to use module codes');
        saveProgress();
    }
}

// Save progress to localStorage
function saveProgress() {
    localStorage.setItem('securityTrainingProgress', JSON.stringify(progressData));
    updateProgressDisplay();
    updateAssessmentAvailability();
}

// Navigation
function navigateToSection(sectionId) {
    // Update active section
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === sectionId) {
            link.classList.add('active');
        }
    });

    currentSection = sectionId;
}

// Event Listeners for Navigation
document.addEventListener('DOMContentLoaded', () => {
    loadProgress();
    loadTrainingModules(); // Load modules from database
    loadAssessments(); // Load assessments from database
    updateAssessmentAvailability();

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            navigateToSection(section);
            
            // Reload assessments when navigating to assessment section
            if (section === 'assessment') {
                loadAssessments();
            }
        });
    });

    initializeDragAndDrop();
});

// Update assessment availability based on completed modules
function updateAssessmentAvailability() {
    const assessmentItems = document.querySelectorAll('.assessment-item');
    
    assessmentItems.forEach(item => {
        const requiredModule = item.dataset.requiredModule;
        const requiresAll = item.dataset.requiredAll === 'true';
        
        if (requiresAll) {
            // Comprehensive assessment requires all modules
            const allModules = ['communication-protocols', 'stop-the-bleed', 'threat-assessment', 
                               'ics-100', 'diverse-population', 'crowd-management', 'use-of-force'];
            const allCompleted = allModules.every(module => 
                progressData.completedModules.includes(module)
            );
            
            if (allCompleted) {
                item.classList.remove('locked');
                item.onclick = () => startAssessment(item.dataset.assessment);
            } else {
                item.classList.add('locked');
                item.onclick = (e) => {
                    e.stopPropagation();
                    showLockedMessage('Complete all modules to unlock the Comprehensive Certification');
                };
            }
        } else if (requiredModule) {
            // Individual assessments require their corresponding module
            if (progressData.completedModules.includes(requiredModule)) {
                item.classList.remove('locked');
                item.onclick = () => startAssessment(item.dataset.assessment);
            } else {
                item.classList.add('locked');
                item.onclick = (e) => {
                    e.stopPropagation();
                    const moduleName = moduleContent[requiredModule]?.title || 'the required module';
                    showLockedMessage(`Complete ${moduleName} to unlock this assessment`);
                };
            }
        }
    });
}

// Show locked message
function showLockedMessage(message) {
    // Create a simple alert or notification
    const notification = document.createElement('div');
    notification.className = 'locked-notification';
    notification.innerHTML = `
        <i class="fas fa-lock"></i>
        <p>${message}</p>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============= TRAINING MODULES =============

const moduleContent = {
    'crowd-management': {
        title: 'Crowd Management',
        content: `
            <h3>Crowd Management for Event Security</h3>
            <p>Effective crowd management is essential for maintaining safety and order at events with large gatherings.</p>
            
            <h4>Key Principles:</h4>
            <ul>
                <li><strong>Crowd Density:</strong> Monitor and control the number of people in specific areas</li>
                <li><strong>Flow Management:</strong> Direct crowd movement to prevent bottlenecks and congestion</li>
                <li><strong>Behavioral Observation:</strong> Identify signs of agitation, intoxication, or distress</li>
                <li><strong>Communication:</strong> Provide clear signage and verbal directions</li>
                <li><strong>Preventive Positioning:</strong> Strategic placement of security personnel</li>
            </ul>

            <h4>Crowd Control Techniques:</h4>
            <ul>
                <li>Use physical barriers to channel crowd movement</li>
                <li>Establish clear entry and exit points</li>
                <li>Implement queuing systems for orderly access</li>
                <li>Monitor crowd density and adjust access accordingly</li>
                <li>Maintain visible security presence to deter issues</li>
                <li>Use de-escalation techniques for agitated individuals</li>
            </ul>

            <h4>Warning Signs:</h4>
            <ul>
                <li>Overcrowding in specific areas</li>
                <li>Pushing or aggressive behavior</li>
                <li>People appearing distressed or trapped</li>
                <li>Sudden crowd surges or movements</li>
                <li>Blocked emergency exits</li>
            </ul>

            <h4>Best Practices:</h4>
            <ul>
                <li>Conduct pre-event venue assessment</li>
                <li>Calculate and enforce venue capacity limits</li>
                <li>Position guards at strategic choke points</li>
                <li>Maintain radio communication with all personnel</li>
                <li>Have evacuation plans ready</li>
            </ul>
        `
    },
    'emergency-response': {
        title: 'Emergency Response',
        content: `
            <h3>Emergency Response Procedures</h3>
            <p>Security guards must be prepared to respond quickly and effectively to various emergency situations.</p>
            
            <h4>Types of Emergencies:</h4>
            <ul>
                <li><strong>Medical Emergencies:</strong> Injuries, heart attacks, seizures, heat exhaustion</li>
                <li><strong>Fire/Evacuation:</strong> Fire, smoke, structural concerns</li>
                <li><strong>Security Threats:</strong> Active threats, suspicious packages, fights</li>
                <li><strong>Weather Events:</strong> Severe weather requiring shelter or evacuation</li>
                <li><strong>Crowd Incidents:</strong> Stampedes, crushes, mass panic</li>
            </ul>

            <h4>Response Protocol:</h4>
            <ol>
                <li><strong>Assess:</strong> Quickly evaluate the situation and severity</li>
                <li><strong>Alert:</strong> Immediately notify supervisor and emergency services</li>
                <li><strong>Act:</strong> Take appropriate action within your training</li>
                <li><strong>Assist:</strong> Help emergency responders access the scene</li>
                <li><strong>Account:</strong> Document all actions and observations</li>
            </ol>

            <h4>Medical Emergency Response:</h4>
            <ul>
                <li>Call for medical assistance immediately</li>
                <li>Provide first aid if trained and safe to do so</li>
                <li>Clear area and control crowd</li>
                <li>Guide EMS to the patient</li>
                <li>Preserve any evidence if injury resulted from incident</li>
                <li>Complete incident report</li>
            </ul>

            <h4>Evacuation Procedures:</h4>
            <ul>
                <li>Know all emergency exits and assembly points</li>
                <li>Remain calm and give clear, loud instructions</li>
                <li>Direct people to nearest safe exit</li>
                <li>Assist those with mobility issues</li>
                <li>Do not allow re-entry until cleared by authorities</li>
                <li>Account for all personnel</li>
            </ul>

            <h4>Communication During Emergencies:</h4>
            <ul>
                <li>Use radio code words for different emergency types</li>
                <li>Provide clear location and situation updates</li>
                <li>Keep radio traffic brief and essential</li>
                <li>Follow chain of command</li>
            </ul>
        `
    },
    'ics-100': {
        title: 'Introduction to Incident Command System (ICS-100)',
        content: `
            <h3>Module 4: Introduction to Incident Command System (ICS-100)</h3>
            <p><strong>Learning Objectives:</strong> Understand the National Incident Management System (NIMS), ICS structure, and your role in emergency response coordination.</p>
            
            <h4>What is ICS?</h4>
            <ul>
                <li><strong>Incident Command System:</strong> Standardized approach to command, control, and coordination of emergency response</li>
                <li><strong>Purpose:</strong> Provide a common organizational structure for all types of incidents</li>
                <li><strong>Origin:</strong> Developed after 1970s California wildfires</li>
                <li><strong>Requirement:</strong> Mandated by Homeland Security Presidential Directive (HSPD-5)</li>
                <li><strong>Application:</strong> Used by all emergency responders nationwide</li>
            </ul>

            <h3>NIMS (National Incident Management System)</h3>
            <h4>What is NIMS?</h4>
            <ul>
                <li><strong>Definition:</strong> Comprehensive national approach to incident management</li>
                <li><strong>Components:</strong> Preparedness, Communications, Resource Management, Command and Management, Ongoing Management</li>
                <li><strong>Scope:</strong> Applies to all incidents, all hazards, all levels</li>
                <li><strong>Goal:</strong> Enable responders from different jurisdictions to work together</li>
            </ul>

            <h4>Why NIMS/ICS Matters for Security:</h4>
            <ul>
                <li>You will interface with emergency responders using ICS</li>
                <li>Understanding ICS helps you integrate into response efforts</li>
                <li>Common language improves coordination</li>
                <li>Legal requirement for many security positions</li>
                <li>Professional credibility and competence</li>
            </ul>

            <h3>ICS Principles and Features</h3>
            <h4>Core Principles:</h4>
            <ul>
                <li><strong>Common Terminology:</strong> Everyone uses the same terms</li>
                <li><strong>Modular Organization:</strong> Expand or contract based on incident needs</li>
                <li><strong>Management by Objectives:</strong> Clear goals and strategies</li>
                <li><strong>Incident Action Plan (IAP):</strong> Written or verbal plan for each operational period</li>
                <li><strong>Manageable Span of Control:</strong> One supervisor for 3-7 people (ideal is 5)</li>
                <li><strong>Incident Facilities:</strong> Designated locations (ICP, Staging, Base, etc.)</li>
                <li><strong>Comprehensive Resource Management:</strong> Track all personnel and equipment</li>
                <li><strong>Integrated Communications:</strong> Common communications plan</li>
                <li><strong>Unified Command:</strong> Multiple agencies work together under one command structure</li>
                <li><strong>Chain of Command:</strong> Clear reporting relationships</li>
                <li><strong>Accountability:</strong> Everyone has an assignment and supervisor</li>
            </ul>

            <h3>ICS Organizational Structure</h3>
            <h4>Command Staff:</h4>
            <ul>
                <li><strong>Incident Commander (IC):</strong> Overall authority and responsibility for the incident</li>
                <li><strong>Public Information Officer (PIO):</strong> Interface with media and public</li>
                <li><strong>Safety Officer (SO):</strong> Monitors safety conditions and develops safety measures</li>
                <li><strong>Liaison Officer (LNO):</strong> Point of contact for assisting agencies</li>
            </ul>

            <h4>General Staff (Section Chiefs):</h4>
            <ul>
                <li><strong>Operations Section Chief:</strong> Manages tactical operations to meet incident objectives</li>
                <li><strong>Planning Section Chief:</strong> Collects information, develops IAP, maintains resource status</li>
                <li><strong>Logistics Section Chief:</strong> Provides resources and services to support incident</li>
                <li><strong>Finance/Administration Section Chief:</strong> Monitors costs, time tracking, procurement</li>
            </ul>

            <h4>ICS Organizational Chart:</h4>
            <p><strong>Incident Commander</strong> (top)</p>
            <ul>
                <li>Command Staff: PIO, Safety Officer, Liaison Officer (report to IC)</li>
                <li>General Staff: Operations, Planning, Logistics, Finance/Admin (report to IC)</li>
            </ul>

            <h3>Operations Section (Where Security Typically Works)</h3>
            <h4>Operations Section Responsibilities:</h4>
            <ul>
                <li>Direct management of all incident tactical activities</li>
                <li>Implementation of the Incident Action Plan</li>
                <li>Requesting additional resources</li>
                <li>Reporting progress to Incident Commander</li>
            </ul>

            <h4>Operations Section Organization:</h4>
            <ul>
                <li><strong>Branches:</strong> Functional or geographic divisions (if needed)</li>
                <li><strong>Divisions:</strong> Geographic areas of operation</li>
                <li><strong>Groups:</strong> Functional areas (fire suppression, medical, security)</li>
                <li><strong>Strike Teams:</strong> Same type of resources with common leader</li>
                <li><strong>Task Forces:</strong> Different types of resources with common leader</li>
            </ul>

            <h4>Security's Role in Operations:</h4>
            <ul>
                <li>Perimeter control and access restriction</li>
                <li>Crowd management and traffic control</li>
                <li>Protection of incident facilities</li>
                <li>VIP protection if needed</li>
                <li>Evidence preservation</li>
                <li>Coordination with law enforcement</li>
            </ul>

            <h3>Planning Section</h3>
            <h4>Planning Section Responsibilities:</h4>
            <ul>
                <li>Collect and evaluate incident information</li>
                <li>Prepare and document Incident Action Plans</li>
                <li>Conduct planning meetings</li>
                <li>Maintain resource status (who's available, assigned, out of service)</li>
                <li>Prepare incident maps and intelligence</li>
                <li>Develop alternative strategies</li>
            </ul>

            <h4>Planning P (Operational Planning Cycle):</h4>
            <ol>
                <li>Incident briefing (IC briefs command and general staff)</li>
                <li>Initial response and assessment</li>
                <li>Incident Action Plan development</li>
                <li>IAP preparation and approval</li>
                <li>Operations briefing and plan execution</li>
                <li>Execute plan and assess progress</li>
                <li>Repeat cycle for next operational period</li>
            </ol>

            <h3>Logistics Section</h3>
            <h4>Logistics Section Responsibilities:</h4>
            <ul>
                <li>Provide facilities, transportation, supplies, equipment, fuel, food, communications, medical services</li>
                <li>Order resources through proper channels</li>
                <li>Set up and maintain incident facilities</li>
            </ul>

            <h4>Logistics Branches:</h4>
            <ul>
                <li><strong>Service Branch:</strong> Communications, medical, food services</li>
                <li><strong>Support Branch:</strong> Supply, facilities, ground support</li>
            </ul>

            <h3>Finance/Administration Section</h3>
            <h4>Finance/Admin Responsibilities:</h4>
            <ul>
                <li>Track incident costs</li>
                <li>Personnel time tracking</li>
                <li>Procurement of equipment and supplies</li>
                <li>Compensation and claims</li>
                <li>Cost analysis and documentation</li>
            </ul>

            <h3>Incident Facilities</h3>
            <h4>Common ICS Facilities:</h4>
            <ul>
                <li><strong>Incident Command Post (ICP):</strong> Where IC and command staff operate</li>
                <li><strong>Staging Area:</strong> Where resources wait for assignments</li>
                <li><strong>Base:</strong> Location where primary logistics functions are coordinated</li>
                <li><strong>Camp:</strong> Temporary sleeping and support facilities</li>
                <li><strong>Helibase:</strong> Main helicopter operations location</li>
                <li><strong>Helispot:</strong> Temporary helicopter landing area</li>
            </ul>

            <h3>Resource Management</h3>
            <h4>Resource Categories:</h4>
            <ul>
                <li><strong>Single Resource:</strong> Individual person or piece of equipment</li>
                <li><strong>Strike Team:</strong> Set number of same kind/type of resources (5 security officers)</li>
                <li><strong>Task Force:</strong> Combination of different resources (security + medical + fire)</li>
            </ul>

            <h4>Resource Status:</h4>
            <ul>
                <li><strong>Assigned:</strong> Working on tactical assignment</li>
                <li><strong>Available:</strong> Ready for assignment</li>
                <li><strong>Out of Service:</strong> Not available (rest, repair, etc.)</li>
            </ul>

            <h4>Check-In Process:</h4>
            <ul>
                <li>All resources MUST check in when arriving at incident</li>
                <li>Provides accountability and tracking</li>
                <li>Check-in locations: ICP, Staging Areas, Base, Helibases, Division Supervisors</li>
                <li>Provide: Name, agency, qualifications, resources you bring</li>
            </ul>

            <h3>Communications and Information Management</h3>
            <h4>ICS Communications Principles:</h4>
            <ul>
                <li><strong>Common terminology:</strong> Plain language, no codes (except 10-codes if agreed upon)</li>
                <li><strong>Clear text:</strong> No jargon or agency-specific terms</li>
                <li><strong>Integrated communications:</strong> All agencies on same system when possible</li>
                <li><strong>Communications plan:</strong> Part of every IAP</li>
            </ul>

            <h4>Chain of Command:</h4>
            <ul>
                <li>Report to only ONE supervisor</li>
                <li>Receive assignments from only ONE supervisor</li>
                <li>If you need something, ask your supervisor</li>
                <li>Don't skip levels in the chain</li>
            </ul>

            <h3>Unified Command</h3>
            <h4>What is Unified Command?</h4>
            <ul>
                <li>Multiple agencies or jurisdictions share command authority</li>
                <li>Used when incident crosses jurisdictions or involves multiple agencies</li>
                <li>One Incident Action Plan developed together</li>
                <li>Each agency maintains authority over their resources</li>
            </ul>

            <h4>Benefits of Unified Command:</h4>
            <ul>
                <li>Single set of objectives</li>
                <li>Collective approach to strategies</li>
                <li>Improved information flow</li>
                <li>All agencies have a voice</li>
                <li>Better resource utilization</li>
            </ul>

            <h3>Transfer of Command</h3>
            <h4>When Transfer Occurs:</h4>
            <ul>
                <li>More qualified person arrives</li>
                <li>Incident situation changes</li>
                <li>Normal turnover of personnel</li>
                <li>Agency with jurisdiction assumes command</li>
            </ul>

            <h4>Transfer of Command Process:</h4>
            <ul>
                <li>Briefing between outgoing and incoming IC</li>
                <li>Notification to all personnel of transfer</li>
                <li>Transfer of command authority and responsibility</li>
                <li>Documentation of transfer (time, date, names)</li>
            </ul>

            <h3>Incident Action Plan (IAP)</h3>
            <h4>What is an IAP?</h4>
            <ul>
                <li>Plan for managing an incident during an operational period</li>
                <li>Can be verbal (small incidents) or written (larger incidents)</li>
                <li>Developed for each operational period (usually 12-24 hours)</li>
            </ul>

            <h4>IAP Components:</h4>
            <ul>
                <li>Incident objectives (what we want to accomplish)</li>
                <li>Strategies (how we'll accomplish objectives)</li>
                <li>Tactics (specific actions to implement strategies)</li>
                <li>Resource assignments</li>
                <li>Safety considerations</li>
                <li>Communications plan</li>
            </ul>

            <h3>Security Guard's Role in ICS</h3>
            <h4>Your Responsibilities:</h4>
            <ul>
                <li><strong>Check In:</strong> Report to designated check-in location immediately</li>
                <li><strong>Receive Assignment:</strong> Get clear instructions from your supervisor</li>
                <li><strong>Follow Chain of Command:</strong> Report to your assigned supervisor only</li>
                <li><strong>Maintain Accountability:</strong> Know where you are and what you're doing</li>
                <li><strong>Communicate:</strong> Report status, needs, and problems to supervisor</li>
                <li><strong>Document:</strong> Keep records of your activities</li>
                <li><strong>Follow IAP:</strong> Work according to the plan</li>
                <li><strong>Safety First:</strong> Report hazards, don't take unnecessary risks</li>
            </ul>

            <h4>Common Security Assignments in ICS:</h4>
            <ul>
                <li>Perimeter security and access control</li>
                <li>Traffic control and parking management</li>
                <li>Crowd control and movement</li>
                <li>Protection of ICP and other facilities</li>
                <li>Evidence preservation and scene security</li>
                <li>VIP security if needed</li>
                <li>Coordination with law enforcement</li>
            </ul>

            <h4>Working with Other Agencies:</h4>
            <ul>
                <li>Respect their authority and expertise</li>
                <li>Use common terminology</li>
                <li>Share information appropriately</li>
                <li>Follow unified command structure</li>
                <li>Be professional and cooperative</li>
            </ul>

            <h3>Demobilization</h3>
            <h4>What is Demobilization?</h4>
            <ul>
                <li>Orderly, safe return of resources when no longer needed</li>
                <li>Planned process, not just leaving</li>
                <li>Ensures accountability and proper documentation</li>
            </ul>

            <h4>Demobilization Process:</h4>
            <ul>
                <li>Planning Section develops demobilization plan</li>
                <li>Resources released in priority order</li>
                <li>Check-out process (return equipment, complete paperwork)</li>
                <li>Debriefing and lessons learned</li>
                <li>Travel to home location</li>
            </ul>

            <h3>ICS Forms (Common Ones)</h3>
            <h4>Key ICS Forms:</h4>
            <ul>
                <li><strong>ICS 201:</strong> Incident Briefing (initial situation, objectives, organization)</li>
                <li><strong>ICS 202:</strong> Incident Objectives (what we want to accomplish)</li>
                <li><strong>ICS 203:</strong> Organization Assignment List (who's in what position)</li>
                <li><strong>ICS 204:</strong> Assignment List (specific tactical assignments)</li>
                <li><strong>ICS 205:</strong> Communications Plan (radio frequencies, phone numbers)</li>
                <li><strong>ICS 206:</strong> Medical Plan (medical facilities, procedures)</li>
                <li><strong>ICS 211:</strong> Check-In List (resource tracking)</li>
                <li><strong>ICS 214:</strong> Activity Log (what you did during your shift)</li>
            </ul>

            <h3>Best Practices for Security in ICS</h3>
            <ul>
                <li><strong>Get ICS-100 Certified:</strong> Take the free FEMA online course</li>
                <li><strong>Know Your Role:</strong> Understand where security fits in ICS</li>
                <li><strong>Check In Immediately:</strong> First thing upon arrival</li>
                <li><strong>Get Clear Assignment:</strong> Ask questions if unclear</li>
                <li><strong>Maintain Accountability:</strong> Always know your location and assignment</li>
                <li><strong>Use Plain Language:</strong> No codes or jargon</li>
                <li><strong>Follow Chain of Command:</strong> Don't skip levels</li>
                <li><strong>Document Everything:</strong> Keep an activity log (ICS 214)</li>
                <li><strong>Safety First:</strong> Don't become a victim</li>
                <li><strong>Be Flexible:</strong> Incidents are dynamic, adapt to changes</li>
                <li><strong>Cooperate:</strong> Work well with other agencies</li>
                <li><strong>Debrief:</strong> Participate in after-action reviews</li>
            </ul>

            <h4>Key Takeaways:</h4>
            <ul>
                <li>ICS provides common structure for all incidents</li>
                <li>Security typically works in Operations Section</li>
                <li>Check in, get assignment, follow chain of command</li>
                <li>Use common terminology and plain language</li>
                <li>Maintain accountability at all times</li>
                <li>Safety is everyone's responsibility</li>
                <li>ICS knowledge makes you a professional asset</li>
            </ul>
        `
    },
    'access-screening': {
        title: 'Access Control & Screening',
        content: `
            <h3>Access Control and Screening Procedures</h3>
            <p>Controlling access and screening attendees is a critical function for event security guards.</p>
            
            <h4>Entry Control Responsibilities:</h4>
            <ul>
                <li><strong>Ticket Validation:</strong> Verify tickets, passes, or credentials</li>
                <li><strong>Bag Inspection:</strong> Check bags for prohibited items</li>
                <li><strong>Metal Detection:</strong> Operate metal detectors or wands</li>
                <li><strong>ID Verification:</strong> Check identification when required</li>
                <li><strong>Prohibited Items:</strong> Confiscate or refuse entry for banned items</li>
            </ul>

            <h4>Common Prohibited Items:</h4>
            <ul>
                <li>Weapons of any kind (firearms, knives, etc.)</li>
                <li>Outside food and beverages (venue dependent)</li>
                <li>Glass containers</li>
                <li>Illegal substances</li>
                <li>Professional cameras/recording equipment (event dependent)</li>
                <li>Large bags or backpacks</li>
                <li>Fireworks or explosives</li>
                <li>Laser pointers</li>
            </ul>

            <h4>Screening Best Practices:</h4>
            <ul>
                <li>Be courteous but firm with all attendees</li>
                <li>Apply rules consistently to everyone</li>
                <li>Explain reasons for searches professionally</li>
                <li>Conduct searches in view of others (transparency)</li>
                <li>Same-gender searches when possible</li>
                <li>Never physically search a person without proper authority</li>
                <li>Call supervisor for difficult situations</li>
            </ul>

            <h4>Dealing with Denied Entry:</h4>
            <ul>
                <li>Remain calm and professional</li>
                <li>Clearly explain the reason for denial</li>
                <li>Offer alternatives (e.g., return item to vehicle)</li>
                <li>Do not argue or escalate</li>
                <li>Call for supervisor if person refuses to comply</li>
                <li>Document the incident</li>
            </ul>

            <h4>VIP and Backstage Access:</h4>
            <ul>
                <li>Verify credentials match access list</li>
                <li>Check photo ID against pass</li>
                <li>Use wristbands or passes that are difficult to counterfeit</li>
                <li>Escort unauthorized persons out of restricted areas</li>
                <li>Report suspicious credential activity</li>
            </ul>

            <h4>Re-entry Procedures:</h4>
            <ul>
                <li>Use hand stamps, wristbands, or ticket stubs</li>
                <li>Re-screen upon re-entry</li>
                <li>Check for signs of intoxication</li>
                <li>Refuse re-entry if person is impaired or disruptive</li>
            </ul>
        `
    },
    'communication-protocols': {
        title: 'Communication & Protocols',
        content: `
            <h3>Security Radio Communications (MD MSC Module 1)</h3>
            <p><strong>Mission Critical:</strong> If we can't talk, we can't respond. And if we can't respond, we can't protect.</p>
            
            <h4>Basic Radio Operations:</h4>
            <ul>
                <li><strong>Power/Volume:</strong> Always start shift with full battery and spare if available</li>
                <li><strong>Channel Selection:</strong> Command Channel (supervisors), Operations Channel (field units), Emergency Channel (critical incidents)</li>
                <li><strong>PTT Button:</strong> Press and hold, wait 1-2 seconds for tone, then speak</li>
                <li><strong>Hand Mic ("Puck"):</strong> Proper cable routing to reduce snags and avoid "hot mic"</li>
                <li><strong>Battery Management:</strong> Never assume; always verify active channels and batteries</li>
            </ul>

            <h4>Call Signs (Best Practices):</h4>
            <ul>
                <li>Clear and easy to pronounce (2-3 syllables)</li>
                <li>Memorable but not offensive</li>
                <li>Distinguishable from others on the net</li>
                <li>Always say recipient's call sign TWICE, then your own</li>
                <li>Example: "Romeo, Romeo, this is Juliet"</li>
            </ul>

            <h4>NATO Phonetic Alphabet:</h4>
            <ul>
                <li>Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel, India, Juliet</li>
                <li>Kilo, Lima, Mike, November, Oscar, Papa, Quebec, Romeo, Sierra, Tango</li>
                <li>Uniform, Victor, Whiskey, X-ray, Yankee, Zulu</li>
                <li>Numbers: Wun, Too, Tree, Fower, Fife, Six, Seven, Ait, Niner, Zero</li>
            </ul>

            <h4>Standard Radio Phrases (Prowords):</h4>
            <ul>
                <li><strong>Over:</strong> Finished speaking; your turn to reply</li>
                <li><strong>Out:</strong> Conversation ended (no reply needed) - NEVER say "Over and Out"!</li>
                <li><strong>Roger:</strong> Message received and understood</li>
                <li><strong>Wilco:</strong> Will comply (received + understand + will do)</li>
                <li><strong>Affirmative/Negative:</strong> Yes/No</li>
                <li><strong>Say Again:</strong> Repeat your last message</li>
                <li><strong>Stand By:</strong> Wait a moment</li>
                <li><strong>Radio Check:</strong> Test signal (response: "Loud and Clear" or "5 by 5")</li>
            </ul>

            <h4>Event Codes (Company-Specific):</h4>
            <ul>
                <li><strong>Code Blue:</strong> Non-urgent assistance (minor spill, found child)</li>
                <li><strong>Code Yellow:</strong> Immediate but non-dangerous (suspicious bag)</li>
                <li><strong>Code Red:</strong> Emergency - immediate backup (fight, medical)</li>
                <li><strong>Code Black:</strong> Bomb threat or evacuation</li>
                <li><strong>Code Silver:</strong> Active shooter or weapon sighted</li>
                <li><strong>Code Adam:</strong> Missing child</li>
            </ul>

            <h4>ABC's of Radio Transmission:</h4>
            <ul>
                <li><strong>A - Actionable info first:</strong> "FIRE at (location), requesting fire response" then details</li>
                <li><strong>B - Brief transmissions:</strong> Include only pertinent info, 30 seconds or less</li>
                <li><strong>C - Clear communication:</strong> Clear head, clear information, clear the channel</li>
            </ul>

            <h4>Radio Protocol (8-Step Process):</h4>
            <ol>
                <li><strong>Agent Initiates:</strong> "Command, Command - this is Bravo 3"</li>
                <li><strong>Command Acknowledges:</strong> "Bravo 3 - go for Command"</li>
                <li><strong>Agent Sends Traffic:</strong> "Requesting backup at Gate 4"</li>
                <li><strong>Command Receives:</strong> "Backup en route. Hold position"</li>
                <li><strong>Command Notifies Units:</strong> "Bravo 1 - respond to Gate 4"</li>
                <li><strong>Unit Acknowledges:</strong> "Bravo 1 copies - en route"</li>
                <li><strong>Resolution Update:</strong> "Gate 4 secure. Returning to patrol"</li>
                <li><strong>Command Logs:</strong> Time, agent, incident, response, outcome</li>
            </ol>

            <h4>Emergency Communication (4 Essentials):</h4>
            <ul>
                <li><strong>WHO:</strong> Use call signs, not names</li>
                <li><strong>WHAT:</strong> Specific incident type (medical, fight, fire)</li>
                <li><strong>WHERE:</strong> Exact location with landmarks</li>
                <li><strong>SEVERITY:</strong> Priority level and resources needed</li>
            </ul>

            <h4>Key Rules for New Agents:</h4>
            <ul>
                <li>Always listen for ongoing traffic before transmitting</li>
                <li>Think and compose transmission in your head first</li>
                <li>Wait 1-2 seconds after pressing PTT before speaking</li>
                <li>Speak clearly and slowly - don't yell (overloads mic)</li>
                <li>Shield mic from wind and background noise</li>
                <li>Always acknowledge receipt: "10-4", "Copy", or "Roger"</li>
                <li>Never swear on the radio - assume it's being monitored</li>
                <li>Don't speak over others unless it's life safety priority</li>
            </ul>

            <h4>Case Study - Astroworld 2021:</h4>
            <p><strong>Communication Failure:</strong> 10 deaths, hundreds injured due to crowd surge. Key failures:</p>
            <ul>
                <li>Calls for help buried in unrelated radio traffic</li>
                <li>Critical delays in dispatch and triage</li>
                <li>Confusion over command structure and channel assignments</li>
                <li>No centralized medical dispatch or designated emergency channel</li>
                <li><strong>Lesson:</strong> Radio discipline under pressure saves lives</li>
            </ul>
        `
    },
    'stop-the-bleed': {
        title: 'STOP THE BLEED® Emergency Medical Response',
        content: `
            <h3>STOP THE BLEED® - Life-Saving Hemorrhage Control</h3>
            <p><strong>Mission:</strong> Empower security personnel to save lives by controlling severe bleeding until professional medical help arrives.</p>
            
            <h4>Why STOP THE BLEED®?</h4>
            <ul>
                <li>Severe bleeding can cause death in 5 minutes or less</li>
                <li>Immediate action by bystanders/security can save lives</li>
                <li>Developed by the American College of Surgeons</li>
                <li>Based on lessons from military combat medicine</li>
                <li>You don't need medical training to help - just knowledge and action</li>
            </ul>

            <h4>The Three Steps to STOP THE BLEED®:</h4>
            <ol>
                <li><strong>IDENTIFY the bleeding:</strong> Remove or cut clothing to locate source</li>
                <li><strong>APPLY pressure:</strong> Use hands, dressings, or tourniquets</li>
                <li><strong>GET help:</strong> Call 911 and continue care until EMS arrives</li>
            </ol>

            <h4>Types of Bleeding:</h4>
            <ul>
                <li><strong>Arterial (Life-Threatening):</strong> Bright red, spurting blood - requires immediate tourniquet</li>
                <li><strong>Venous (Serious):</strong> Dark red, steady flow - apply direct pressure</li>
                <li><strong>Capillary (Minor):</strong> Slow oozing - standard first aid sufficient</li>
            </ul>

            <h4>Direct Pressure Technique:</h4>
            <ul>
                <li>Expose the wound by removing/cutting clothing</li>
                <li>Place gauze or clean cloth directly on wound</li>
                <li>Apply firm, steady pressure with both hands</li>
                <li>Maintain pressure for at least 3 minutes</li>
                <li>If blood soaks through, add more dressings - don't remove original</li>
                <li>Pack deep wounds with gauze (wound packing)</li>
            </ul>

            <h4>Tourniquet Application (Life-Threatening Limb Bleeding):</h4>
            <ul>
                <li><strong>When to use:</strong> Arterial bleeding from arm or leg that won't stop with pressure</li>
                <li><strong>Placement:</strong> 2-3 inches above wound, never on a joint</li>
                <li><strong>Application:</strong> Tighten until bleeding stops completely</li>
                <li><strong>Time:</strong> Note exact time applied - write on tourniquet or victim's forehead</li>
                <li><strong>Never remove:</strong> Only medical professionals should remove tourniquets</li>
                <li><strong>Commercial vs Improvised:</strong> Use commercial CAT or SOFTT if available</li>
            </ul>

            <h4>Wound Packing (Junctional Bleeding):</h4>
            <ul>
                <li>Used for wounds in areas where tourniquets can't be applied (neck, groin, armpit)</li>
                <li>Use hemostatic gauze (QuikClot, Celox) if available</li>
                <li>Pack gauze deep into wound cavity</li>
                <li>Apply direct pressure over packed wound for 3+ minutes</li>
                <li>Maintain pressure until EMS arrives</li>
            </ul>

            <h4>Scene Safety & BSI (Body Substance Isolation):</h4>
            <ul>
                <li><strong>Scene Safety First:</strong> Ensure area is safe before approaching victim</li>
                <li><strong>Gloves:</strong> Always wear gloves if available (nitrile or latex)</li>
                <li><strong>Eye Protection:</strong> Protect from blood splatter</li>
                <li><strong>Hand Washing:</strong> Wash thoroughly after care, even with gloves</li>
                <li><strong>Sharps Safety:</strong> Be careful with scissors, broken glass, weapons</li>
            </ul>

            <h4>Calling for Help:</h4>
            <ul>
                <li>Call 911 immediately or designate someone specific to call</li>
                <li>Provide: Location, number of victims, type of injuries, what you're doing</li>
                <li>Use radio codes: Code Red (medical emergency)</li>
                <li>Guide EMS to exact location</li>
                <li>Continue care until EMS takes over</li>
            </ul>

            <h4>Shock Prevention & Management:</h4>
            <ul>
                <li><strong>Signs of shock:</strong> Pale/cold/clammy skin, rapid pulse, confusion, weakness</li>
                <li><strong>Treatment:</strong> Lay victim flat, elevate legs 12 inches (if no spinal injury)</li>
                <li><strong>Keep warm:</strong> Cover with blanket or jacket</li>
                <li><strong>Reassure:</strong> Keep victim calm and still</li>
                <li><strong>Monitor:</strong> Check breathing and pulse regularly</li>
            </ul>

            <h4>STOP THE BLEED® Kit Contents:</h4>
            <ul>
                <li>CAT or SOFTT-W Tourniquet (commercial grade)</li>
                <li>Hemostatic gauze (QuikClot Combat Gauze)</li>
                <li>Compressed gauze or trauma dressings</li>
                <li>Nitrile gloves</li>
                <li>Trauma shears (scissors)</li>
                <li>Chest seals (for penetrating chest wounds)</li>
                <li>Emergency blanket</li>
                <li>Permanent marker (to note tourniquet time)</li>
            </ul>

            <h4>Legal Protections (Good Samaritan Laws):</h4>
            <ul>
                <li>All 50 states have Good Samaritan laws protecting those who help in emergencies</li>
                <li>Protection applies when acting in good faith without gross negligence</li>
                <li>Obtain consent before helping conscious victims</li>
                <li>Implied consent for unconscious victims</li>
                <li>Document your actions and time of interventions</li>
            </ul>

            <h4>Special Considerations for Security Personnel:</h4>
            <ul>
                <li>Know location of all STOP THE BLEED® kits at your venue</li>
                <li>Conduct regular kit inspections and inventory</li>
                <li>Practice tourniquet application monthly</li>
                <li>Coordinate with venue medical staff and EMS</li>
                <li>Include hemorrhage control in emergency action plans</li>
                <li>Document all medical interventions in incident reports</li>
            </ul>

            <h4>Key Reminders:</h4>
            <ul>
                <li><strong>Time is critical:</strong> Severe bleeding can kill in 5 minutes</li>
                <li><strong>Don't hesitate:</strong> Immediate action saves lives</li>
                <li><strong>Tourniquet myths:</strong> Modern tourniquets are safe and effective</li>
                <li><strong>You can't make it worse:</strong> Doing something is better than doing nothing</li>
                <li><strong>Stay calm:</strong> Your composure helps the victim and others</li>
            </ul>
        `
    },
    'threat-assessment': {
        title: 'Threat Assessment & Situational Awareness',
        content: `
            <h3>Module 2: Threat Assessment & Situational Awareness (MD MSC)</h3>
            <p><strong>Learning Objectives:</strong> Identify potential threats, maintain situational awareness, and use de-escalation techniques to prevent violence.</p>
            
            <h4>Module Coverage (MPCTC Objectives):</h4>
            <ul>
                <li><strong>SG-9:</strong> Define de-escalation</li>
                <li><strong>SG-10:</strong> Time/distance/cover for de-escalation</li>
                <li><strong>SG-11:</strong> Communication in de-escalation</li>
            </ul>

            <h3>Situational Awareness Fundamentals</h3>
            <h4>What is Situational Awareness?</h4>
            <ul>
                <li><strong>Definition:</strong> The ability to identify, process, and comprehend critical information about your environment</li>
                <li><strong>Purpose:</strong> Anticipate and prevent incidents before they escalate</li>
                <li><strong>Goal:</strong> Stay ahead of threats through observation and analysis</li>
            </ul>

            <h4>Cooper's Color Codes of Awareness:</h4>
            <ul>
                <li><strong>White (Unaware):</strong> Oblivious to surroundings - AVOID THIS STATE</li>
                <li><strong>Yellow (Relaxed Alert):</strong> Aware of surroundings, no specific threats - NORMAL STATE for security</li>
                <li><strong>Orange (Focused Alert):</strong> Specific threat identified, assessing options</li>
                <li><strong>Red (Condition Red):</strong> Threat is immediate, taking action</li>
            </ul>

            <h4>The OODA Loop (Observe, Orient, Decide, Act):</h4>
            <ul>
                <li><strong>Observe:</strong> Scan environment, identify anomalies</li>
                <li><strong>Orient:</strong> Analyze what you're seeing in context</li>
                <li><strong>Decide:</strong> Determine appropriate response</li>
                <li><strong>Act:</strong> Execute your decision</li>
                <li><strong>Loop:</strong> Continuously repeat this process</li>
            </ul>

            <h4>Environmental Scanning Techniques:</h4>
            <ul>
                <li><strong>360-Degree Awareness:</strong> Regularly scan all directions, not just forward</li>
                <li><strong>Baseline vs. Anomaly:</strong> Know what's normal, identify what's not</li>
                <li><strong>Choke Points:</strong> Monitor entrances, exits, stairwells, elevators</li>
                <li><strong>Crowd Behavior:</strong> Watch for sudden movements, changes in noise level</li>
                <li><strong>Blind Spots:</strong> Be aware of areas you can't see</li>
            </ul>

            <h3>Threat Assessment & Recognition</h3>
            <h4>Pre-Attack Indicators (Behavioral Cues):</h4>
            <ul>
                <li><strong>Surveillance:</strong> Person watching security, taking photos/notes of procedures</li>
                <li><strong>Elicitation:</strong> Asking unusual questions about security measures</li>
                <li><strong>Testing Security:</strong> Probing for weaknesses in access control</li>
                <li><strong>Acquiring Supplies:</strong> Suspicious purchases or possession of items</li>
                <li><strong>Suspicious Behavior:</strong> Nervous, sweating, avoiding eye contact</li>
                <li><strong>Inappropriate Dress:</strong> Heavy clothing in warm weather (concealment)</li>
                <li><strong>Unusual Interest:</strong> Fixation on specific areas or people</li>
            </ul>

            <h4>Verbal Threat Indicators:</h4>
            <ul>
                <li>Direct threats ("I'm going to hurt you")</li>
                <li>Conditional threats ("If you don't... then I'll...")</li>
                <li>Veiled threats ("You'll be sorry")</li>
                <li>Escalating language (profanity, raised voice)</li>
                <li>Irrational statements or delusions</li>
            </ul>

            <h4>Physical Threat Indicators:</h4>
            <ul>
                <li><strong>Aggressive Posture:</strong> Squared shoulders, clenched fists, invasion of space</li>
                <li><strong>Target Glancing:</strong> Looking at where they plan to strike</li>
                <li><strong>Blade Stance:</strong> Body turned sideways (fighting stance)</li>
                <li><strong>Thousand-Yard Stare:</strong> Fixed, intense eye contact</li>
                <li><strong>Facial Flushing:</strong> Reddening face, visible anger</li>
                <li><strong>Rapid Breathing:</strong> Preparing for physical action</li>
            </ul>

            <h4>Threat Assessment Matrix:</h4>
            <ul>
                <li><strong>Low Threat:</strong> Verbal complaint, no aggression - monitor</li>
                <li><strong>Medium Threat:</strong> Raised voice, agitated - intervene with de-escalation</li>
                <li><strong>High Threat:</strong> Physical aggression, weapons - immediate action/call law enforcement</li>
                <li><strong>Critical Threat:</strong> Active violence - protect life, evacuate, call 911</li>
            </ul>

            <h3>De-escalation Defined (SG-9)</h3>
            <h4>What is De-escalation?</h4>
            <ul>
                <li><strong>Definition:</strong> Techniques used to prevent a situation from escalating to violence</li>
                <li><strong>Goal:</strong> Gain voluntary compliance without use of force</li>
                <li><strong>Philosophy:</strong> Resolve conflicts through communication rather than confrontation</li>
                <li><strong>Outcome:</strong> Peaceful resolution that preserves dignity and safety</li>
            </ul>

            <h4>Core Principles of De-escalation:</h4>
            <ul>
                <li><strong>Respect:</strong> Treat person with dignity regardless of behavior</li>
                <li><strong>Empathy:</strong> Understand their perspective and emotions</li>
                <li><strong>Patience:</strong> Allow time for emotions to decrease</li>
                <li><strong>Calm Presence:</strong> Your composure influences their state</li>
                <li><strong>Active Listening:</strong> Hear what they're really saying</li>
                <li><strong>Non-threatening:</strong> Body language and tone matter</li>
            </ul>

            <h4>When De-escalation is Appropriate:</h4>
            <ul>
                <li>Person is agitated but not yet violent</li>
                <li>Verbal conflict or argument</li>
                <li>Mental health crisis without immediate danger</li>
                <li>Intoxicated person causing disturbance</li>
                <li>Frustrated customer or guest</li>
                <li>Any situation where time allows for communication</li>
            </ul>

            <h4>When De-escalation is NOT Appropriate:</h4>
            <ul>
                <li>Active violence in progress</li>
                <li>Weapon is displayed or threatened</li>
                <li>Imminent threat to life</li>
                <li>Person is beyond reasoning (extreme intoxication, psychosis)</li>
                <li>Your safety or others' safety is at immediate risk</li>
            </ul>

            <h3>Time, Distance, and Cover (SG-10)</h3>
            <h4>The Reactionary Gap:</h4>
            <ul>
                <li><strong>Definition:</strong> Minimum safe distance to react to a threat</li>
                <li><strong>21-Foot Rule:</strong> Person with knife can close 21 feet in 1.5 seconds</li>
                <li><strong>Application:</strong> Maintain distance to give yourself reaction time</li>
                <li><strong>Goal:</strong> Create time and space to assess and respond</li>
            </ul>

            <h4>Time as a De-escalation Tool:</h4>
            <ul>
                <li><strong>Slowing the Situation:</strong> Don't rush - let emotions cool</li>
                <li><strong>Allowing Processing:</strong> Give person time to think and respond</li>
                <li><strong>Waiting for Help:</strong> Backup may be en route</li>
                <li><strong>Fatigue Factor:</strong> Anger is exhausting - time works in your favor</li>
                <li><strong>Patience Pays:</strong> Most situations resolve with time</li>
            </ul>

            <h4>Distance Management:</h4>
            <ul>
                <li><strong>Personal Space:</strong> Maintain 6-10 feet when possible</li>
                <li><strong>Interview Stance:</strong> Stand at 45-degree angle, not directly facing</li>
                <li><strong>Hands Visible:</strong> Keep your hands where they can see them</li>
                <li><strong>Escape Route:</strong> Always know your exit path</li>
                <li><strong>Never Cornered:</strong> Don't trap yourself or the subject</li>
                <li><strong>Barriers:</strong> Use desks, counters, vehicles as separation</li>
            </ul>

            <h4>Cover vs. Concealment:</h4>
            <ul>
                <li><strong>Cover:</strong> Stops bullets/projectiles (concrete walls, engine blocks, thick trees)</li>
                <li><strong>Concealment:</strong> Hides you but doesn't stop bullets (bushes, drywall, car doors)</li>
                <li><strong>Use Cover When:</strong> Weapons involved or imminent threat</li>
                <li><strong>Use Concealment When:</strong> Breaking line of sight to reposition</li>
                <li><strong>Know Your Environment:</strong> Identify cover options in advance</li>
            </ul>

            <h4>Tactical Positioning:</h4>
            <ul>
                <li>Position yourself near exits</li>
                <li>Keep subject between you and help (not isolated)</li>
                <li>Use environmental advantages (higher ground, lighting)</li>
                <li>Avoid being silhouetted (backlit)</li>
                <li>Watch their hands - hands kill, not people</li>
            </ul>

            <h3>Communication in De-escalation (SG-11)</h3>
            <h4>Verbal De-escalation Techniques:</h4>
            <ul>
                <li><strong>Calm Tone:</strong> Speak slowly, evenly, at moderate volume</li>
                <li><strong>Simple Language:</strong> Short sentences, clear words</li>
                <li><strong>Empathetic Statements:</strong> "I understand you're frustrated"</li>
                <li><strong>Acknowledgment:</strong> "I hear what you're saying"</li>
                <li><strong>Offer Choices:</strong> "Would you prefer to sit or stand?"</li>
                <li><strong>Set Boundaries:</strong> "I want to help, but I need you to lower your voice"</li>
                <li><strong>Avoid Triggers:</strong> Don't say "calm down" or "relax"</li>
            </ul>

            <h4>Active Listening Skills:</h4>
            <ul>
                <li><strong>Give Full Attention:</strong> Stop other activities, focus on them</li>
                <li><strong>Maintain Eye Contact:</strong> Shows you're engaged (culturally appropriate)</li>
                <li><strong>Nod and Acknowledge:</strong> "Mm-hmm," "I see," "Go on"</li>
                <li><strong>Paraphrase:</strong> "So what you're saying is..."</li>
                <li><strong>Ask Clarifying Questions:</strong> "Can you tell me more about..."</li>
                <li><strong>Don't Interrupt:</strong> Let them finish speaking</li>
                <li><strong>Validate Feelings:</strong> "That must be frustrating"</li>
            </ul>

            <h4>Non-Verbal Communication:</h4>
            <ul>
                <li><strong>Open Body Language:</strong> Uncrossed arms, relaxed posture</li>
                <li><strong>Appropriate Distance:</strong> Not too close, not too far</li>
                <li><strong>Calm Gestures:</strong> Slow, deliberate hand movements</li>
                <li><strong>Facial Expression:</strong> Neutral to concerned, not angry</li>
                <li><strong>Avoid Pointing:</strong> Accusatory and aggressive</li>
                <li><strong>Lower Your Center:</strong> Sit if they're sitting (when safe)</li>
            </ul>

            <h4>The LEAPS Model:</h4>
            <ul>
                <li><strong>L - Listen:</strong> Actively hear their concerns</li>
                <li><strong>E - Empathize:</strong> Show you understand their feelings</li>
                <li><strong>A - Ask:</strong> Questions to understand the situation</li>
                <li><strong>P - Paraphrase:</strong> Repeat back what you heard</li>
                <li><strong>S - Summarize:</strong> Recap and propose solutions</li>
            </ul>

            <h4>Phrases to Use:</h4>
            <ul>
                <li>"I want to help you, can you tell me what's wrong?"</li>
                <li>"I understand this is frustrating for you"</li>
                <li>"Let's work together to find a solution"</li>
                <li>"I hear what you're saying"</li>
                <li>"What can I do to help?"</li>
                <li>"I appreciate you talking with me"</li>
            </ul>

            <h4>Phrases to Avoid:</h4>
            <ul>
                <li>"Calm down" or "Relax" (dismissive)</li>
                <li>"You need to..." (commanding)</li>
                <li>"That's not my problem" (uncaring)</li>
                <li>"You're wrong" (argumentative)</li>
                <li>"I don't care" (inflammatory)</li>
                <li>"Or else..." (threatening)</li>
            </ul>

            <h3>De-escalation Step-by-Step Process</h3>
            <ol>
                <li><strong>Assess the Situation:</strong> Threat level, environment, resources available</li>
                <li><strong>Ensure Safety:</strong> Position yourself safely, identify exits and cover</li>
                <li><strong>Call for Backup:</strong> Request assistance early if needed</li>
                <li><strong>Approach Calmly:</strong> Non-threatening posture, appropriate distance</li>
                <li><strong>Introduce Yourself:</strong> "Hi, I'm Officer Smith. I'm here to help"</li>
                <li><strong>Listen Actively:</strong> Let them vent, don't interrupt</li>
                <li><strong>Show Empathy:</strong> Acknowledge their feelings</li>
                <li><strong>Set Boundaries:</strong> Clear expectations for behavior</li>
                <li><strong>Offer Solutions:</strong> Present options and choices</li>
                <li><strong>Give Time:</strong> Allow them to process and decide</li>
                <li><strong>Follow Through:</strong> Do what you said you'd do</li>
                <li><strong>Document:</strong> Record the incident and your actions</li>
            </ol>

            <h3>Special Populations & De-escalation</h3>
            <h4>Mental Health Crisis:</h4>
            <ul>
                <li>Recognize signs: confusion, paranoia, hallucinations</li>
                <li>Speak calmly and simply</li>
                <li>Don't argue with delusions</li>
                <li>Offer reassurance and safety</li>
                <li>Call mental health crisis team if available</li>
            </ul>

            <h4>Intoxicated Individuals:</h4>
            <ul>
                <li>Impaired judgment and impulse control</li>
                <li>May not remember conversation</li>
                <li>Keep it simple and direct</li>
                <li>Separate from alcohol source</li>
                <li>Medical evaluation if severely intoxicated</li>
            </ul>

            <h4>Juveniles:</h4>
            <ul>
                <li>Developing brains, less impulse control</li>
                <li>Peer pressure influences behavior</li>
                <li>Separate from group when possible</li>
                <li>Speak respectfully, not condescendingly</li>
                <li>Contact parents/guardians when appropriate</li>
            </ul>

            <h3>When De-escalation Fails</h3>
            <h4>Recognizing Failure:</h4>
            <ul>
                <li>Escalating aggression despite efforts</li>
                <li>Threats becoming more specific</li>
                <li>Physical indicators of imminent attack</li>
                <li>Weapon displayed or reached for</li>
                <li>Your safety is compromised</li>
            </ul>

            <h4>Transitioning to Force:</h4>
            <ul>
                <li>Disengage if possible - create distance</li>
                <li>Call for law enforcement immediately</li>
                <li>Use only necessary force to protect life</li>
                <li>Document why de-escalation failed</li>
                <li>Be prepared to explain your decision</li>
            </ul>

            <h4>After-Action Review:</h4>
            <ul>
                <li>What worked? What didn't?</li>
                <li>Could anything have been done differently?</li>
                <li>Were there warning signs missed?</li>
                <li>How can we improve for next time?</li>
                <li>Debrief with team and supervisors</li>
            </ul>

            <h4>Best Practices Summary:</h4>
            <ul>
                <li><strong>Stay Alert:</strong> Maintain yellow level awareness at all times</li>
                <li><strong>Trust Your Instincts:</strong> If something feels wrong, it probably is</li>
                <li><strong>Communicate Early:</strong> Radio suspicious activity immediately</li>
                <li><strong>Use Time and Distance:</strong> Your best de-escalation tools</li>
                <li><strong>Stay Calm:</strong> Your composure influences the outcome</li>
                <li><strong>Know When to Disengage:</strong> Retreat is not failure, it's tactics</li>
                <li><strong>Document Everything:</strong> Write it down while it's fresh</li>
                <li><strong>Learn Continuously:</strong> Every situation teaches something</li>
            </ul>
        `
    },
    'diverse-population': {
        title: 'Interacting with a Diverse Population',
        content: `
            <h3>Module Learning Objectives</h3>
            <p>This module will teach you to:</p>
            <ul>
                <li>Understand diversity in security settings</li>
                <li>Develop bias awareness and cultural sensitivity</li>
                <li>Know protected classes and anti-discrimination laws (SG-12)</li>
                <li>Communicate effectively across cultures (SG-13)</li>
                <li>Recognize and respect individual differences</li>
                <li>Use de-escalation through empathy and awareness</li>
                <li>Distinguish biased responses from inclusive responses</li>
            </ul>

            <h3>Understanding Diversity in Security Settings</h3>
            <p><strong>Mission:</strong> Provide professional, respectful, and effective security services to all individuals regardless of background, ability, or identity.</p>
            
            <h4>What is Diversity?</h4>
            <ul>
                <li><strong>Visible Diversity:</strong> Race, ethnicity, age, gender, physical ability</li>
                <li><strong>Invisible Diversity:</strong> Religion, sexual orientation, socioeconomic status, mental health</li>
                <li><strong>Cultural Diversity:</strong> Language, customs, values, communication styles</li>
                <li><strong>Ability Diversity:</strong> Physical, sensory, cognitive, and developmental differences</li>
            </ul>

            <h4>Why Diversity Matters in Security:</h4>
            <ul>
                <li>Events attract people from all backgrounds, cultures, and abilities</li>
                <li>Professional service requires understanding and respecting differences</li>
                <li>Inclusive practices improve safety and guest experience</li>
                <li>Legal requirements under ADA and civil rights laws</li>
                <li>Your actions represent your employer and the security profession</li>
                <li>Diverse populations have diverse needs and expectations</li>
            </ul>

            <h4>Core Principles of Inclusive Security:</h4>
            <ul>
                <li><strong>Respect:</strong> Treat everyone with dignity regardless of differences</li>
                <li><strong>Awareness:</strong> Recognize your own biases and cultural assumptions</li>
                <li><strong>Accessibility:</strong> Ensure services are available to people with disabilities</li>
                <li><strong>Communication:</strong> Adapt your approach to different needs</li>
                <li><strong>Fairness:</strong> Apply rules consistently without discrimination</li>
            </ul>

            <h3>Bias Awareness & Cultural Sensitivity</h3>
            <h4>Understanding Bias:</h4>
            <ul>
                <li><strong>Explicit Bias:</strong> Conscious prejudices we are aware of</li>
                <li><strong>Implicit Bias:</strong> Unconscious attitudes that affect our actions without us realizing it</li>
                <li><strong>Confirmation Bias:</strong> Seeking information that confirms our existing beliefs</li>
                <li><strong>Stereotyping:</strong> Making assumptions about individuals based on group membership</li>
            </ul>

            <h4>Recognizing Your Own Biases:</h4>
            <ul>
                <li>Everyone has biases - it's part of being human</li>
                <li>Self-awareness is the first step to managing bias</li>
                <li>Question your assumptions about people</li>
                <li>Notice when you make snap judgments</li>
                <li>Seek to understand rather than judge</li>
                <li>Actively challenge stereotypes in your thinking</li>
            </ul>

            <h4>Cultural Sensitivity:</h4>
            <ul>
                <li><strong>Cultural Awareness:</strong> Recognize that different cultures have different norms</li>
                <li><strong>Cultural Knowledge:</strong> Learn about cultures you commonly encounter</li>
                <li><strong>Cultural Respect:</strong> Value differences rather than judging them</li>
                <li><strong>Cultural Humility:</strong> Acknowledge what you don't know and be willing to learn</li>
            </ul>

            <h3>Protected Classes & Anti-Discrimination Laws (SG-12)</h3>
            <h4>Federal Protected Classes:</h4>
            <ul>
                <li><strong>Race:</strong> Protected under Title VI of Civil Rights Act of 1964</li>
                <li><strong>Color:</strong> Skin color discrimination prohibited</li>
                <li><strong>National Origin:</strong> Country of origin, ethnicity, accent</li>
                <li><strong>Religion:</strong> Religious beliefs, practices, and dress</li>
                <li><strong>Sex/Gender:</strong> Including pregnancy and gender identity</li>
                <li><strong>Age:</strong> Protection for individuals 40 and older (employment)</li>
                <li><strong>Disability:</strong> Physical and mental disabilities under ADA</li>
            </ul>

            <h4>State and Local Protections:</h4>
            <ul>
                <li><strong>Sexual Orientation:</strong> Protected in many states and localities</li>
                <li><strong>Gender Identity:</strong> Transgender protections in many jurisdictions</li>
                <li><strong>Marital Status:</strong> Some states prohibit discrimination</li>
                <li><strong>Military/Veteran Status:</strong> Protected in many areas</li>
            </ul>

            <h4>Key Anti-Discrimination Laws:</h4>
            <ul>
                <li><strong>Title VI (Civil Rights Act 1964):</strong> Race, color, national origin</li>
                <li><strong>Title VII (Civil Rights Act 1964):</strong> Employment discrimination</li>
                <li><strong>ADA (Americans with Disabilities Act):</strong> Disability accommodations</li>
                <li><strong>Age Discrimination Act:</strong> Protects older individuals</li>
                <li><strong>Fair Housing Act:</strong> Housing discrimination (less relevant to security)</li>
                <li><strong>State Human Rights Laws:</strong> Additional protections vary by state</li>
            </ul>

            <h4>Legal Consequences of Discrimination:</h4>
            <ul>
                <li>Civil lawsuits and monetary damages</li>
                <li>Loss of employment and professional licenses</li>
                <li>Criminal charges in some cases</li>
                <li>Employer liability for employee actions</li>
                <li>Damage to professional reputation</li>
            </ul>

            <h3>Effective Communication Across Cultures (SG-13)</h3>
            <h4>Verbal Communication:</h4>
            <ul>
                <li><strong>Speak Clearly:</strong> Use simple language, avoid slang and jargon</li>
                <li><strong>Adjust Pace:</strong> Speak slower for non-native speakers</li>
                <li><strong>Confirm Understanding:</strong> Ask if they understand, not "Do you speak English?"</li>
                <li><strong>Be Patient:</strong> Allow time for processing and response</li>
                <li><strong>Avoid Idioms:</strong> Phrases like "ballpark figure" may confuse</li>
            </ul>

            <h4>Non-Verbal Communication:</h4>
            <ul>
                <li><strong>Eye Contact:</strong> Direct eye contact is respectful in some cultures, disrespectful in others</li>
                <li><strong>Personal Space:</strong> Comfort zones vary widely by culture</li>
                <li><strong>Gestures:</strong> Hand signals can have different meanings across cultures</li>
                <li><strong>Touch:</strong> Handshakes, pats on back - acceptable varies by culture and gender</li>
                <li><strong>Facial Expressions:</strong> Smiling, nodding have different meanings</li>
            </ul>

            <h4>Language Barriers:</h4>
            <ul>
                <li>Use translation apps or services when available</li>
                <li>Learn basic phrases in common languages at your venue</li>
                <li>Use visual aids, gestures, and demonstrations</li>
                <li>Write down key information when possible</li>
                <li>Never mock accents or language difficulties</li>
                <li>Arrange for interpreters in complex situations</li>
                <li>Speak TO the person, not their translator</li>
            </ul>

            <h4>Active Listening:</h4>
            <ul>
                <li>Give full attention without interrupting</li>
                <li>Show you're listening through body language</li>
                <li>Paraphrase to confirm understanding</li>
                <li>Ask clarifying questions respectfully</li>
                <li>Suspend judgment while listening</li>
            </ul>

            <h3>Recognizing & Respecting Individual Differences</h3>

            <h4>Cultural Competency:</h4>
            <ul>
                <li><strong>Cultural Awareness:</strong> Recognize that different cultures have different norms</li>
                <li><strong>Avoid Stereotypes:</strong> Don't make assumptions based on appearance</li>
                <li><strong>Language Barriers:</strong> Use simple language, gestures, translation apps when needed</li>
                <li><strong>Personal Space:</strong> Respect varies by culture - be mindful</li>
                <li><strong>Eye Contact:</strong> Some cultures view direct eye contact as disrespectful</li>
                <li><strong>Religious Practices:</strong> Accommodate prayer times, dietary needs, dress codes</li>
            </ul>

            <h4>Working with People with Disabilities (ADA Compliance):</h4>
            <ul>
                <li><strong>Mobility Disabilities:</strong> Ensure accessible routes, seating, restrooms</li>
                <li><strong>Visual Impairments:</strong> Offer verbal directions, allow service animals</li>
                <li><strong>Hearing Impairments:</strong> Face the person, speak clearly, use written notes</li>
                <li><strong>Cognitive Disabilities:</strong> Be patient, use simple language, allow extra time</li>
                <li><strong>Service Animals:</strong> Must be allowed - only ask "Is this a service animal?" and "What task is it trained to perform?"</li>
                <li><strong>Wheelchairs/Mobility Devices:</strong> Never touch without permission, ensure accessible paths</li>
            </ul>

            <h4>LGBTQ+ Inclusion:</h4>
            <ul>
                <li>Use the name and pronouns people request</li>
                <li>Don't make assumptions about gender or relationships</li>
                <li>Treat same-sex couples the same as opposite-sex couples</li>
                <li>Intervene if you witness harassment or discrimination</li>
                <li>Respect privacy - don't ask invasive personal questions</li>
            </ul>

            <h4>Age Considerations:</h4>
            <ul>
                <li><strong>Children:</strong> Be friendly but professional, involve parents in decisions</li>
                <li><strong>Teenagers:</strong> Treat with respect, don't assume troublemakers</li>
                <li><strong>Elderly:</strong> Be patient, offer assistance, speak clearly and respectfully</li>
                <li><strong>Never patronize:</strong> Avoid baby talk or condescending tones</li>
            </ul>

            <h4>Religious and Cultural Dress:</h4>
            <ul>
                <li>Hijabs, turbans, yarmulkes, and other religious head coverings must be respected</li>
                <li>Security screening can be done without requiring removal in most cases</li>
                <li>Offer private screening areas if needed</li>
                <li>Never mock or make comments about religious dress</li>
                <li>Understand that some cultures have modesty requirements</li>
            </ul>

            <h4>Language Access:</h4>
            <ul>
                <li>Speak slowly and clearly, avoid slang and jargon</li>
                <li>Use translation apps or services when available</li>
                <li>Learn basic phrases in common languages at your venue</li>
                <li>Use visual aids and gestures to communicate</li>
                <li>Never mock someone's accent or language skills</li>
                <li>Arrange for interpreters for complex situations</li>
            </ul>

            <h4>Implicit Bias and Profiling:</h4>
            <ul>
                <li><strong>Implicit Bias:</strong> Unconscious attitudes that affect our actions</li>
                <li><strong>Racial Profiling is Illegal:</strong> Never base security decisions on race alone</li>
                <li><strong>Behavior-Based Security:</strong> Focus on actions, not appearance</li>
                <li><strong>Self-Awareness:</strong> Recognize when bias may be influencing you</li>
                <li><strong>Fair Treatment:</strong> Apply the same standards to everyone</li>
            </ul>

            <h3>De-escalation Through Empathy & Awareness</h3>
            <h4>The Role of Empathy in Security:</h4>
            <ul>
                <li><strong>Empathy:</strong> Understanding and sharing the feelings of another person</li>
                <li><strong>Perspective-Taking:</strong> Seeing the situation from their point of view</li>
                <li><strong>Emotional Intelligence:</strong> Recognizing and managing emotions (yours and theirs)</li>
                <li><strong>Compassion:</strong> Caring about the person's wellbeing while maintaining safety</li>
            </ul>

            <h4>De-escalation Techniques with Diverse Populations:</h4>
            <ul>
                <li><strong>Remain Calm:</strong> Your composure sets the tone regardless of background</li>
                <li><strong>Listen Actively:</strong> Show you're trying to understand their perspective</li>
                <li><strong>Acknowledge Feelings:</strong> "I can see you're frustrated" validates emotions</li>
                <li><strong>Cultural Awareness:</strong> Recognize cultural differences may be causing confusion</li>
                <li><strong>Avoid Assumptions:</strong> Don't assume you know what they're thinking</li>
                <li><strong>Give Space:</strong> Respect personal space preferences</li>
                <li><strong>Offer Choices:</strong> Empowers people and reduces defensiveness</li>
                <li><strong>Seek Help:</strong> Use community liaisons or cultural experts when needed</li>
            </ul>

            <h4>Cultural Considerations in De-escalation:</h4>
            <ul>
                <li>Some cultures value indirect communication over direct confrontation</li>
                <li>Authority figures may be viewed differently across cultures</li>
                <li>Saving face is critically important in many cultures</li>
                <li>Family or community involvement may be expected</li>
                <li>Time perception varies - some cultures are less time-urgent</li>
            </ul>

            <h3>Scenario Discussion: Biased Response vs. Inclusive Response</h3>
            
            <h4>Scenario 1: Language Barrier</h4>
            <p><strong>Situation:</strong> A guest who doesn't speak English well is trying to ask you a question.</p>
            <p><strong>❌ Biased Response:</strong> "This is America, speak English!" or walking away in frustration.</p>
            <p><strong>✅ Inclusive Response:</strong> Speak slowly and clearly, use gestures, pull up a translation app, or find someone who speaks their language. Show patience and respect.</p>
            
            <h4>Scenario 2: Religious Head Covering</h4>
            <p><strong>Situation:</strong> A person wearing a hijab approaches the security checkpoint.</p>
            <p><strong>❌ Biased Response:</strong> Requiring removal of hijab or subjecting them to extra screening based on appearance.</p>
            <p><strong>✅ Inclusive Response:</strong> Screen respectfully without requiring removal. Offer private screening if needed. Treat the same as anyone else - focus on behavior, not appearance.</p>
            
            <h4>Scenario 3: Service Animal</h4>
            <p><strong>Situation:</strong> Someone enters with a dog wearing a service animal vest.</p>
            <p><strong>❌ Biased Response:</strong> "You don't look disabled" or demanding to see medical documentation.</p>
            <p><strong>✅ Inclusive Response:</strong> Ask only the two permitted questions: "Is this a service animal?" and "What task is it trained to perform?" Allow entry if answered appropriately.</p>
            
            <h4>Scenario 4: Wheelchair User</h4>
            <p><strong>Situation:</strong> A person in a wheelchair needs assistance.</p>
            <p><strong>❌ Biased Response:</strong> Speaking to their companion instead of them, or grabbing the wheelchair without permission.</p>
            <p><strong>✅ Inclusive Response:</strong> Speak directly to the person, ask "How can I help you?" and never touch the wheelchair without permission. Ensure accessible routes are clear.</p>
            
            <h4>Scenario 5: Same-Sex Couple</h4>
            <p><strong>Situation:</strong> A same-sex couple is displaying affection similar to opposite-sex couples.</p>
            <p><strong>❌ Biased Response:</strong> Asking them to stop or treating them differently than other couples.</p>
            <p><strong>✅ Inclusive Response:</strong> Treat them exactly the same as any other couple. Apply the same standards to everyone regardless of sexual orientation.</p>
            
            <h4>Scenario 6: Elderly Guest</h4>
            <p><strong>Situation:</strong> An elderly person is moving slowly and asking repeated questions.</p>
            <p><strong>❌ Biased Response:</strong> Speaking loudly in a patronizing tone or showing impatience.</p>
            <p><strong>✅ Inclusive Response:</strong> Be patient, speak clearly (not loudly unless they indicate hearing difficulty), offer assistance respectfully, and treat with dignity.</p>

            <h4>Learning from Scenarios:</h4>
            <ul>
                <li><strong>Biased responses</strong> are based on stereotypes, assumptions, and lack of awareness</li>
                <li><strong>Inclusive responses</strong> focus on individual needs, respect, and professional service</li>
                <li>The difference often comes down to awareness, empathy, and training</li>
                <li>Your choice of response impacts safety, guest experience, and legal liability</li>
                <li>Inclusive responses are not just morally right - they're professionally required</li>
            </ul>

            <h4>Handling Discrimination and Harassment:</h4>
            <ul>
                <li><strong>Intervene:</strong> Stop discriminatory behavior immediately</li>
                <li><strong>Support Victims:</strong> Offer assistance and document incidents</li>
                <li><strong>Report:</strong> All discrimination incidents must be reported to supervisors</li>
                <li><strong>Don't Participate:</strong> Never join in jokes or comments about protected groups</li>
                <li><strong>Zero Tolerance:</strong> Discrimination has no place in professional security</li>
            </ul>

            <h4>Legal Protections (Civil Rights Laws):</h4>
            <ul>
                <li><strong>Title VI:</strong> Prohibits discrimination based on race, color, national origin</li>
                <li><strong>ADA:</strong> Requires reasonable accommodations for disabilities</li>
                <li><strong>Title VII:</strong> Prohibits employment discrimination (applies to staff)</li>
                <li><strong>State Laws:</strong> Many states have additional protections for LGBTQ+ individuals</li>
                <li><strong>Consequences:</strong> Discrimination can result in lawsuits, job loss, criminal charges</li>
            </ul>

            <h4>Best Practices for Inclusive Security:</h4>
            <ul>
                <li>Treat every person as an individual, not a stereotype</li>
                <li>When in doubt, ask respectfully how you can help</li>
                <li>Apologize if you make a mistake and learn from it</li>
                <li>Continuously educate yourself about different cultures and communities</li>
                <li>Lead by example - model inclusive behavior for others</li>
                <li>Remember: diversity makes events richer and more vibrant</li>
            </ul>

            <h4>Key Reminders:</h4>
            <ul>
                <li><strong>Everyone deserves respect:</strong> No exceptions</li>
                <li><strong>Accessibility is required:</strong> Not optional under ADA</li>
                <li><strong>Behavior, not appearance:</strong> Base decisions on actions</li>
                <li><strong>Ask, don't assume:</strong> When unsure, respectfully inquire</li>
                <li><strong>Your role:</strong> Protect everyone equally and professionally</li>
            </ul>
        `
    },
    'use-of-force': {
        title: 'Use of Force & Legal Responsibilities',
        content: `
            <h3>Use of Force and Legal Authority</h3>
            <p>Understanding your legal authority and the appropriate use of force is critical for unarmed security guards.</p>
            
            <h4>Legal Status of Security Guards:</h4>
            <ul>
                <li><strong>Private Citizens:</strong> Security guards have the same legal authority as any private citizen</li>
                <li><strong>No Special Powers:</strong> You do NOT have police powers or authority to arrest (except citizen's arrest)</li>
                <li><strong>Property Rights:</strong> Your authority comes from the property owner's rights</li>
                <li><strong>State Licensing:</strong> Must comply with state-specific security guard regulations</li>
                <li><strong>Liability:</strong> You and your employer can be held liable for improper actions</li>
            </ul>

            <h4>Use of Force Continuum:</h4>
            <ol>
                <li><strong>Presence:</strong> Uniformed, visible security presence deters issues</li>
                <li><strong>Verbal Commands:</strong> Clear, calm directions and de-escalation</li>
                <li><strong>Empty Hand Control:</strong> Guiding, escorting without strikes</li>
                <li><strong>Defensive Tactics:</strong> Only to defend yourself or others from harm</li>
                <li><strong>Deadly Force:</strong> NEVER authorized for unarmed security guards</li>
            </ol>

            <h4>When Force May Be Used:</h4>
            <ul>
                <li><strong>Self-Defense:</strong> To protect yourself from imminent physical harm</li>
                <li><strong>Defense of Others:</strong> To protect another person from imminent harm</li>
                <li><strong>Reasonable Force Only:</strong> Must be proportional to the threat</li>
                <li><strong>Duty to Retreat:</strong> Avoid confrontation when safely possible</li>
                <li><strong>Stop When Threat Ends:</strong> Force must cease when threat is neutralized</li>
            </ul>

            <h4>What You CANNOT Do:</h4>
            <ul>
                <li>Use force to detain someone for shoplifting (in most states)</li>
                <li>Chase suspects off property</li>
                <li>Search people without consent</li>
                <li>Use weapons (firearms, batons, pepper spray) unless specifically licensed</li>
                <li>Make arrests (except citizen's arrest in limited circumstances)</li>
                <li>Use force to eject trespassers (call police instead)</li>
            </ul>

            <h4>Citizen's Arrest (State-Dependent):</h4>
            <ul>
                <li>Only for felonies committed in your presence (most states)</li>
                <li>Must immediately turn person over to police</li>
                <li>High liability risk - consult company policy</li>
                <li>Generally NOT recommended for security guards</li>
                <li>Call police instead whenever possible</li>
            </ul>

            <h4>Liability and Legal Consequences:</h4>
            <ul>
                <li><strong>Criminal Charges:</strong> Assault, battery, false imprisonment</li>
                <li><strong>Civil Lawsuits:</strong> Personal injury, violation of rights</li>
                <li><strong>License Revocation:</strong> Loss of security guard license</li>
                <li><strong>Job Termination:</strong> Immediate dismissal for policy violations</li>
                <li><strong>Employer Liability:</strong> Your company can be sued for your actions</li>
            </ul>

            <h4>Best Practices:</h4>
            <ul>
                <li>Always try verbal de-escalation first</li>
                <li>Call police for situations requiring force</li>
                <li>Document everything thoroughly</li>
                <li>Know your company's use of force policy</li>
                <li>Understand your state's specific laws</li>
                <li>When in doubt, observe and report only</li>
                <li>Your safety comes first - retreat if necessary</li>
            </ul>

            <h4>State-Specific Requirements:</h4>
            <p><strong>Important:</strong> Security guard laws vary significantly by state. You must:</p>
            <ul>
                <li>Complete state-mandated training hours</li>
                <li>Obtain proper licensing/registration</li>
                <li>Understand your state's use of force laws</li>
                <li>Know citizen's arrest limitations in your state</li>
                <li>Follow state-specific reporting requirements</li>
            </ul>
        `
    }
};

// Module functions are now in slideshow.js

// ============= SAND TABLE =============

const scenarios = {
    'concert-venue': {
        title: 'Outdoor Concert Security',
        description: 'Set up security for a 5,000-person outdoor concert',
        requirements: [
            'Position security guards at all entry gates',
            'Set up metal detectors and checkpoints at entrances',
            'Place barriers to control crowd flow',
            'Establish a command post for coordination',
            'Position guards near the stage and emergency exits',
            'Set up first aid station with medical staff'
        ],
        requiredComponents: ['guard', 'checkpoint', 'metal-detector', 'barrier', 'command-post', 'first-aid'],
        optionalComponents: ['camera', 'supervisor', 'emergency-exit', 'medic']
    },
    'sports-event': {
        title: 'Stadium Sports Event',
        description: 'Plan security for a stadium sporting event with 20,000 attendees',
        requirements: [
            'Deploy guards at all entry gates with screening',
            'Position supervisors in each section',
            'Set up command post for incident coordination',
            'Place cameras at strategic locations',
            'Ensure all emergency exits are monitored',
            'Station medical staff throughout venue'
        ],
        requiredComponents: ['guard', 'supervisor', 'gate', 'command-post', 'emergency-exit', 'medic'],
        optionalComponents: ['camera', 'checkpoint', 'barrier', 'usher', 'first-aid']
    },
    'conference-center': {
        title: 'Conference/Convention Security',
        description: 'Secure a multi-day conference with VIP attendees',
        requirements: [
            'Set up credential checkpoints at all entrances',
            'Position guards at VIP and restricted areas',
            'Establish command post for coordination',
            'Deploy cameras for monitoring',
            'Place ushers to assist with crowd management',
            'Set up first aid station'
        ],
        requiredComponents: ['checkpoint', 'guard', 'command-post', 'camera', 'usher', 'first-aid'],
        optionalComponents: ['supervisor', 'gate', 'barrier', 'medic']
    },
    'festival-grounds': {
        title: 'Multi-Day Festival',
        description: 'Plan comprehensive security for a 3-day music festival',
        requirements: [
            'Deploy guards at all perimeter entry points',
            'Set up multiple checkpoints with metal detectors',
            'Use barriers to create controlled access zones',
            'Establish command post with supervisor oversight',
            'Position guards at each stage and high-traffic areas',
            'Set up multiple first aid stations with medical staff',
            'Install cameras at key locations',
            'Mark all emergency exits clearly'
        ],
        requiredComponents: ['guard', 'checkpoint', 'metal-detector', 'barrier', 'command-post', 'supervisor', 'first-aid', 'emergency-exit'],
        optionalComponents: ['camera', 'medic', 'usher', 'gate']
    }
};

function loadScenario(scenarioId) {
    if (!scenarioId) {
        clearCanvas();
        document.getElementById('scenarioTitle').textContent = 'Select a scenario to begin';
        document.getElementById('scenarioDescription').innerHTML = '';
        return;
    }

    currentScenario = scenarioId;
    const scenario = scenarios[scenarioId];
    
    clearCanvas();
    document.getElementById('scenarioTitle').textContent = scenario.title;
    
    let descriptionHTML = `
        <h4>Scenario: ${scenario.description}</h4>
        <ul>
    `;
    scenario.requirements.forEach(req => {
        descriptionHTML += `<li>${req}</li>`;
    });
    descriptionHTML += '</ul>';
    
    document.getElementById('scenarioDescription').innerHTML = descriptionHTML;
}

function clearCanvas() {
    canvasItems = [];
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="canvas-placeholder"><i class="fas fa-hand-pointer"></i><p>Drag security resources to the event layout to create your security plan</p></div>';
}

function validateSolution() {
    if (!currentScenario) {
        showFeedback('error', 'No Scenario Selected', 'Please select a scenario first.');
        return;
    }

    const scenario = scenarios[currentScenario];
    const placedTypes = canvasItems.map(item => item.type);
    
    // Check required components
    const missingComponents = scenario.requiredComponents.filter(
        comp => !placedTypes.includes(comp)
    );
    
    const score = Math.round(
        ((scenario.requiredComponents.length - missingComponents.length) / 
        scenario.requiredComponents.length) * 100
    );

    if (missingComponents.length === 0) {
        showFeedback(
            'success',
            'Excellent Work!',
            `You've successfully completed the scenario with a score of ${score}%.`,
            '<p>All required components are in place. Your solution demonstrates a solid understanding of security architecture.</p>'
        );
        
        if (!progressData.completedScenarios.includes(currentScenario)) {
            progressData.completedScenarios.push(currentScenario);
            addActivity(`Completed scenario: ${scenario.title}`);
            saveProgress();
        }
    } else {
        let detailsHTML = '<p><strong>Missing components:</strong></p><ul>';
        missingComponents.forEach(comp => {
            detailsHTML += `<li>${comp.charAt(0).toUpperCase() + comp.slice(1)}</li>`;
        });
        detailsHTML += '</ul><p>Add these components and try again.</p>';
        
        showFeedback(
            'error',
            'Incomplete Solution',
            `Your solution is ${score}% complete.`,
            detailsHTML
        );
    }
}

function showFeedback(type, title, message, details = '') {
    const panel = document.getElementById('feedbackPanel');
    const icon = document.getElementById('feedbackIcon');
    
    icon.className = `feedback-icon ${type}`;
    icon.innerHTML = type === 'success' ? 
        '<i class="fas fa-check-circle"></i>' : 
        '<i class="fas fa-times-circle"></i>';
    
    document.getElementById('feedbackTitle').textContent = title;
    document.getElementById('feedbackMessage').textContent = message;
    document.getElementById('feedbackDetails').innerHTML = details;
    
    panel.classList.remove('hidden');
}

function closeFeedback() {
    document.getElementById('feedbackPanel').classList.add('hidden');
}

// Drag and Drop Implementation
function initializeDragAndDrop() {
    const toolItems = document.querySelectorAll('.tool-item');
    const canvas = document.getElementById('canvas');

    toolItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
    });

    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);
}

function handleDragStart(e) {
    const type = e.target.closest('.tool-item').dataset.type;
    e.dataTransfer.setData('componentType', type);
    e.dataTransfer.effectAllowed = 'copy';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function handleDrop(e) {
    e.preventDefault();
    
    const type = e.dataTransfer.getData('componentType');
    if (!type) return;

    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    addCanvasItem(type, x, y);
}

function addCanvasItem(type, x, y) {
    const canvas = document.getElementById('canvas');
    
    // Remove placeholder if exists
    const placeholder = canvas.querySelector('.canvas-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    const item = document.createElement('div');
    item.className = 'canvas-item';
    item.style.left = `${x}px`;
    item.style.top = `${y}px`;
    
    const iconMap = {
        'guard': 'fa-user-shield',
        'supervisor': 'fa-user-tie',
        'medic': 'fa-user-md',
        'usher': 'fa-user',
        'barrier': 'fa-road',
        'checkpoint': 'fa-clipboard-check',
        'metal-detector': 'fa-magnet',
        'gate': 'fa-door-open',
        'camera': 'fa-video',
        'command-post': 'fa-broadcast-tower',
        'emergency-exit': 'fa-sign-out-alt',
        'first-aid': 'fa-first-aid'
    };

    const labelMap = {
        'guard': 'Security Guard',
        'supervisor': 'Supervisor',
        'medic': 'Medical Staff',
        'usher': 'Usher',
        'barrier': 'Barrier',
        'checkpoint': 'Checkpoint',
        'metal-detector': 'Metal Detector',
        'gate': 'Entry Gate',
        'camera': 'Camera',
        'command-post': 'Command Post',
        'emergency-exit': 'Emergency Exit',
        'first-aid': 'First Aid Station'
    };

    const itemId = itemIdCounter++;
    item.dataset.itemId = itemId;
    
    item.innerHTML = `
        <i class="fas ${iconMap[type]}"></i>
        <span>${labelMap[type]}</span>
        <button class="delete-btn" onclick="removeCanvasItem(${itemId})">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Make item draggable within canvas
    item.addEventListener('mousedown', startDragging);

    canvas.appendChild(item);
    
    canvasItems.push({ id: itemId, type, x, y });
}

function removeCanvasItem(itemId) {
    const item = document.querySelector(`[data-item-id="${itemId}"]`);
    if (item) {
        item.remove();
        canvasItems = canvasItems.filter(i => i.id !== itemId);
        
        // Add placeholder back if canvas is empty
        if (canvasItems.length === 0) {
            const canvas = document.getElementById('canvas');
            canvas.innerHTML = '<div class="canvas-placeholder"><i class="fas fa-hand-pointer"></i><p>Drag components from the toolbox to build your solution</p></div>';
        }
    }
}

// Canvas item dragging
let draggedItem = null;
let dragOffset = { x: 0, y: 0 };

function startDragging(e) {
    if (e.target.closest('.delete-btn')) return;
    
    draggedItem = e.currentTarget;
    const rect = draggedItem.getBoundingClientRect();
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();
    
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDragging);
}

function drag(e) {
    if (!draggedItem) return;
    
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();
    
    let x = e.clientX - canvasRect.left - dragOffset.x;
    let y = e.clientY - canvasRect.top - dragOffset.y;
    
    // Keep within canvas bounds
    x = Math.max(0, Math.min(x, canvasRect.width - draggedItem.offsetWidth));
    y = Math.max(0, Math.min(y, canvasRect.height - draggedItem.offsetHeight));
    
    draggedItem.style.left = `${x}px`;
    draggedItem.style.top = `${y}px`;
}

function stopDragging() {
    draggedItem = null;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDragging);
}

// ============= ASSESSMENTS =============

const assessmentQuestions = {
    'crowd-management': [
        {
            question: 'What is the primary goal of crowd management at events?',
            options: [
                'To maximize revenue by allowing as many people as possible',
                'To maintain safety and order for all attendees',
                'To provide entertainment and enhance the guest experience',
                'To promote merchandise sales and concession purchases'
            ],
            correct: 1
        },
        {
            question: 'What should you do if you notice overcrowding in a specific area?',
            options: [
                'Ignore it and focus on your assigned duties only',
                'Alert supervisor and help redirect crowd flow away from the area',
                'Leave your post to personally investigate the situation',
                'Take a break and let someone else handle the problem'
            ],
            correct: 1
        },
        {
            question: 'Which is a warning sign of potential crowd problems?',
            options: [
                'People laughing and enjoying themselves at the event',
                'Sudden crowd surges or pushing in a specific direction',
                'People taking photos and videos with their phones',
                'Normal conversation and social interaction among guests'
            ],
            correct: 1
        },
        {
            question: 'What is the purpose of using barriers at events?',
            options: [
                'To serve as decoration and enhance the venue aesthetics',
                'To control crowd flow and create safe pathways for movement',
                'To completely block all movement in certain directions',
                'To create obstacles that slow down crowd movement'
            ],
            correct: 1
        },
        {
            question: 'When managing queues, you should:',
            options: [
                'Let people push and shove to get through faster',
                'Maintain orderly lines and enforce fair access for everyone',
                'Allow friends and family members to cut in line together',
                'Ignore the situation and let people self-organize naturally'
            ],
            correct: 1
        },
        {
            question: 'If someone appears distressed in a crowd, you should:',
            options: [
                'Ignore them and continue monitoring the larger crowd',
                'Assist them to a less crowded area and assess their condition',
                'Tell them to deal with it themselves and move along',
                'Walk away and radio for someone else to handle it'
            ],
            correct: 1
        },
        {
            question: 'What is crowd density?',
            options: [
                'How loud the crowd is and the noise level',
                'The number of people per square meter in an area',
                'How happy and energetic the people are feeling',
                'The average age and demographics of attendees'
            ],
            correct: 1
        },
        {
            question: 'Emergency exits should be:',
            options: [
                'Blocked for security purposes to prevent unauthorized access',
                'Kept clear and accessible at all times for safe evacuation',
                'Used for storage of equipment and supplies during events',
                'Locked during events to prevent people from leaving early'
            ],
            correct: 1
        },
        {
            question: 'If you see aggressive behavior starting in a crowd, you should:',
            options: [
                'Join in to help control the aggressive individuals physically',
                'Alert supervisor and attempt to de-escalate if safe to do so',
                'Ignore it unless someone specifically asks for your help',
                'Encourage people to resolve their differences on their own'
            ],
            correct: 1
        },
        {
            question: 'Preventive positioning means:',
            options: [
                'Hiding from the crowd in a secure location backstage',
                'Strategically placing guards to deter problems before they start',
                'Standing in one spot all day without moving around',
                'Avoiding problem areas and staying in comfortable zones'
            ],
            correct: 1
        },
        {
            question: 'At what crowd density level does the situation become critically dangerous?',
            options: [
                'Less than 2 people per square meter',
                'More than 6 people per square meter',
                '2-4 people per square meter',
                '4-6 people per square meter'
            ],
            correct: 1
        },
        {
            question: 'What are the "3 B\'s" of crowd management?',
            options: [
                'Barriers, Badges, Backup',
                'Behavior, Bottlenecks, Briefings',
                'Buildings, Boundaries, Broadcasts',
                'Balance, Bravery, Boldness'
            ],
            correct: 1
        },
        {
            question: 'Which phase of crowd development is often the most dangerous?',
            options: [
                'Arrival',
                'Dispersal (exit phase)',
                'Occupation',
                'Pre-event setup'
            ],
            correct: 1
        },
        {
            question: 'What does "Show presence, not pressure" mean?',
            options: [
                'Hide from the crowd to avoid confrontation',
                'Visual deterrence through non-aggressive posture prevents problems',
                'Use maximum force to show authority',
                'Pressure crowds to move faster'
            ],
            correct: 1
        },
        {
            question: 'What is the difference between crowd management and crowd control?',
            options: [
                'They mean the same thing',
                'Management is proactive, control is reactive',
                'Control is easier than management',
                'Management requires law enforcement'
            ],
            correct: 1
        }
    ],
    'emergency-response': [
        {
            question: 'What does the "A" in the emergency response protocol "5 A\'s" stand for?',
            options: [
                'Attack the problem immediately without hesitation',
                'Assess the situation quickly and evaluate severity',
                'Avoid getting involved until backup arrives on scene',
                'Announce the emergency over the PA system first'
            ],
            correct: 1
        },
        {
            question: 'If you discover a medical emergency, your first action should be:',
            options: [
                'Move the person to a more comfortable location immediately',
                'Call for medical assistance and alert your supervisor right away',
                'Give them water or other liquids to help them feel better',
                'Take a photo to document the incident for your records'
            ],
            correct: 1
        },
        {
            question: 'During an evacuation, you should:',
            options: [
                'Run and save yourself',
                'Remain calm, give clear directions, and assist attendees to exits',
                'Lock all doors',
                'Hide'
            ],
            correct: 1
        },
        {
            question: 'What is Code 3 typically used for?',
            options: [
                'Lunch break time and scheduled rest periods for staff',
                'Emergency situation requiring immediate response and assistance',
                'Normal patrol activities and routine security rounds',
                'End of shift procedures and signing out for the day'
            ],
            correct: 1
        },
        {
            question: 'If someone is having a seizure, you should:',
            options: [
                'Hold them down',
                'Clear the area, protect their head, and call for medical help',
                'Give them food',
                'Pour water on them'
            ],
            correct: 1
        },
        {
            question: 'When guiding EMS to an emergency, you should:',
            options: [
                'Let them find it themselves',
                'Meet them and provide fastest route, clearing path',
                'Give vague directions',
                'Tell them to wait'
            ],
            correct: 1
        },
        {
            question: 'What should you do if you smell smoke?',
            options: [
                'Ignore it',
                'Investigate safely, alert supervisor, and be ready to evacuate',
                'Start filming',
                'Leave immediately without telling anyone'
            ],
            correct: 1
        },
        {
            question: 'In an active threat situation, your priority is:',
            options: [
                'Confront the threat alone',
                'Alert authorities, help people evacuate safely, follow Run-Hide-Fight protocol',
                'Take photos',
                'Do nothing'
            ],
            correct: 1
        },
        {
            question: 'After an emergency, you must:',
            options: [
                'Forget about it',
                'Complete an incident report with all details',
                'Tell your friends',
                'Change the story'
            ],
            correct: 1
        },
        {
            question: 'Heat exhaustion symptoms include:',
            options: [
                'Feeling cold',
                'Heavy sweating, weakness, nausea, dizziness',
                'Increased energy',
                'Improved mood'
            ],
            correct: 1
        },
        {
            question: 'If someone is choking and cannot speak, you should:',
            options: [
                'Give them water',
                'Perform abdominal thrusts (Heimlich) and call for medical help',
                'Slap their back hard',
                'Wait and see'
            ],
            correct: 1
        },
        {
            question: 'When should you move an injured person?',
            options: [
                'Always move them immediately',
                'Only if they are in immediate danger (fire, traffic, etc.)',
                'Never move them',
                'When you feel like it'
            ],
            correct: 1
        }
    ],
    'access-screening': [
        {
            question: 'When checking tickets at entry, you should:',
            options: [
                'Let everyone through quickly to avoid creating long lines',
                'Verify each ticket carefully and check for signs of tampering',
                'Only check some tickets randomly to save time and effort',
                'Ignore the tickets and just count people entering the venue'
            ],
            correct: 1
        },
        {
            question: 'If someone refuses to allow a bag search, you should:',
            options: [
                'Let them in anyway',
                'Politely explain policy and deny entry if they refuse, call supervisor',
                'Force them',
                'Argue with them'
            ],
            correct: 1
        },
        {
            question: 'Which item is typically prohibited at events?',
            options: [
                'Cell phones and other personal electronic devices',
                'Weapons and glass containers that pose safety risks',
                'Clothing items with offensive logos or messages',
                'Shoes and footwear that don\'t meet dress code'
            ],
            correct: 1
        },
        {
            question: 'When operating a metal detector, if it alarms you should:',
            options: [
                'Let them through',
                'Conduct secondary screening with hand wand and ask about metal objects',
                'Send them away',
                'Ignore it'
            ],
            correct: 1
        },
        {
            question: 'If you find a prohibited item, you should:',
            options: [
                'Keep it for yourself',
                'Confiscate per policy, document it, and offer alternatives like returning to vehicle',
                'Throw it away secretly',
                'Give it back'
            ],
            correct: 1
        },
        {
            question: 'VIP credentials should be:',
            options: [
                'Ignored',
                'Verified against access list and checked for authenticity',
                'Accepted without checking',
                'Shared with friends'
            ],
            correct: 1
        },
        {
            question: 'If someone tries to bribe you for entry, you should:',
            options: [
                'Accept the money',
                'Refuse, deny entry, and report to supervisor',
                'Negotiate',
                'Let them in'
            ],
            correct: 1
        },
        {
            question: 'When denying entry, you should:',
            options: [
                'Be rude and aggressive',
                'Be professional, explain reason clearly, and remain calm',
                'Argue loudly',
                'Push them away'
            ],
            correct: 1
        },
        {
            question: 'Re-entry procedures typically include:',
            options: [
                'No checks needed',
                'Hand stamps/wristbands verification and re-screening',
                'Just waving people through',
                'Denying all re-entry'
            ],
            correct: 1
        },
        {
            question: 'If you suspect a fake ticket, you should:',
            options: [
                'Let them in',
                'Detain ticket, call supervisor, and verify with box office',
                'Accuse them loudly',
                'Ignore it'
            ],
            correct: 1
        }
    ],
    'communication-protocols': [
        {
            question: 'What is the proper order of a SITREP (Situation Report)?',
            options: [
                'What, Where, Who, When, What\'s Needed',
                'Who, What, Where, When, What\'s Needed',
                'Where, What, Who, What\'s Needed, When',
                'When, Where, What, Who, What\'s Needed'
            ],
            correct: 1
        },
        {
            question: 'What should you say instead of "Repeat" on the radio?',
            options: [
                'Again',
                'Say again',
                'Repeat that',
                'Come back'
            ],
            correct: 1
        },
        {
            question: 'Who should you report to first in a non-emergency situation?',
            options: [
                'Event Manager',
                'Security Manager',
                'Your immediate supervisor',
                'Any available supervisor'
            ],
            correct: 2
        },
        {
            question: 'What does "10-4" mean on the radio?',
            options: [
                'Emergency situation',
                'Message received and understood',
                'Out of service',
                'Need backup'
            ],
            correct: 1
        },
        {
            question: 'The Pause-Press-Speak formula means:',
            options: [
                'Press PTT, pause, then speak immediately',
                'Think before keying, press PTT and wait 1 second, then speak',
                'Pause between each word while speaking',
                'Press PTT multiple times before speaking'
            ],
            correct: 1
        },
        {
            question: 'What should you do if your radio dies during your shift?',
            options: [
                'Continue working and report it at end of shift',
                'Immediately notify supervisor using backup communication method',
                'Go home since you can\'t communicate',
                'Borrow another guard\'s radio'
            ],
            correct: 1
        },
        {
            question: 'What does "10-33" mean?',
            options: [
                'Arrived on scene',
                'Emergency traffic - clear the channel',
                'Out of service',
                'What is your location?'
            ],
            correct: 1
        },
        {
            question: 'When should you use face-to-face communication instead of radio?',
            options: [
                'For all communications to be more personal',
                'For delivering sensitive information and resolving conflicts',
                'Never - radio is always preferred',
                'Only when your radio is broken'
            ],
            correct: 1
        },
        {
            question: 'What is the primary reason for regular radio check-ins during quiet periods?',
            options: [
                'To keep yourself entertained',
                'To ensure your radio is working and team knows you\'re alert',
                'To practice your radio skills',
                'Because it\'s required by law'
            ],
            correct: 1
        },
        {
            question: 'Code 3 indicates:',
            options: [
                'Non-emergency situation',
                'Urgent but not emergency',
                'Emergency - immediate response needed',
                'End of shift'
            ],
            correct: 2
        },
        {
            question: 'What should you include in a radio incident report?',
            options: [
                'Your personal opinions about what happened',
                'Location, nature of incident, people involved, injuries, assistance needed',
                'Only the most dramatic details',
                'Wait and include everything in written report later'
            ],
            correct: 1
        },
        {
            question: 'Why should you never use profanity on the radio?',
            options: [
                'It might hurt someone\'s feelings',
                'Everything is recorded and can be used in legal proceedings',
                'Your supervisor might hear it',
                'It\'s just a suggestion, not a rule'
            ],
            correct: 1
        },
        {
            question: 'What does "10-7" mean?',
            options: [
                'In service and available',
                'Out of service / on break',
                'Emergency',
                'Arrived on scene'
            ],
            correct: 1
        },
        {
            question: 'When three units are trying to transmit at once causing confusion, what should happen?',
            options: [
                'Everyone keeps trying until someone gets through',
                'The loudest person wins',
                'Supervisor takes control: "All units standby, Command has the channel"',
                'Switch to a different channel'
            ],
            correct: 2
        },
        {
            question: 'The chain of command helps to:',
            options: [
                'Make sure everyone knows who the boss is',
                'Reduce radio clutter and ensure efficient operations',
                'Prevent guards from talking to each other',
                'Slow down emergency response'
            ],
            correct: 1
        },
        {
            question: 'What is radio discipline?',
            options: [
                'Punishing people who misuse radios',
                'Keeping radio channels clear and professional for operational effectiveness',
                'Only using radio during emergencies',
                'Speaking in a military tone'
            ],
            correct: 1
        },
        {
            question: 'An attendee is yelling at you about a policy. What should you do?',
            options: [
                'Yell back to establish authority',
                'Immediately call for backup on radio',
                'Stay calm, listen, and explain the policy professionally',
                'Walk away and ignore them'
            ],
            correct: 2
        },
        {
            question: 'What does "10-8" mean?',
            options: [
                'Out of service',
                'In service and available',
                'Emergency',
                'Need backup'
            ],
            correct: 1
        },
        {
            question: 'When should you report an incident?',
            options: [
                'Only if it\'s a major emergency',
                'Report early and report often',
                'Wait until you have all the details',
                'Only if someone asks you'
            ],
            correct: 1
        },
        {
            question: 'What is the main purpose of your radio in security work?',
            options: [
                'To look professional',
                'Your lifeline for safety and coordination',
                'To communicate with friends',
                'Required equipment but rarely used'
            ],
            correct: 1
        }
    ],
    'threat-assessment': [
        {
            question: 'What is situational awareness?',
            options: [
                'Being aware of your schedule and appointments',
                'The ability to identify, process, and comprehend critical information about your environment',
                'Knowing where all exits are located',
                'Watching security cameras constantly'
            ],
            correct: 1
        },
        {
            question: 'In Cooper\'s Color Codes, what does "Condition Yellow" mean?',
            options: [
                'Unaware of surroundings - avoid this state',
                'Relaxed alert - aware of surroundings, no specific threats (normal for security)',
                'Specific threat identified, assessing options',
                'Immediate threat, taking action'
            ],
            correct: 1
        },
        {
            question: 'What is de-escalation?',
            options: [
                'Using force to control a situation',
                'Techniques used to prevent a situation from escalating to violence',
                'Calling for backup immediately',
                'Removing yourself from any conflict'
            ],
            correct: 1
        },
        {
            question: 'The "21-Foot Rule" states that:',
            options: [
                'You must stay 21 feet away from all threats',
                'A person with a knife can close 21 feet in about 1.5 seconds',
                'You should maintain 21 feet of personal space',
                'Backup must arrive within 21 seconds'
            ],
            correct: 1
        },
        {
            question: 'What does the "L" in the LEAPS de-escalation model stand for?',
            options: [
                'Look for weapons',
                'Listen actively to their concerns',
                'Leave the area if unsafe',
                'Lock down the perimeter'
            ],
            correct: 1
        },
        {
            question: 'Which phrase should you AVOID when de-escalating?',
            options: [
                '"I want to help you"',
                '"Calm down" or "Relax"',
                '"I understand this is frustrating"',
                '"Let\'s work together to find a solution"'
            ],
            correct: 1
        },
        {
            question: 'What is the difference between cover and concealment?',
            options: [
                'There is no difference, they mean the same thing',
                'Cover stops bullets, concealment only hides you',
                'Concealment stops bullets, cover only hides you',
                'Cover is for active shooters, concealment is for fights'
            ],
            correct: 1
        },
        {
            question: 'Pre-attack indicators include all of the following EXCEPT:',
            options: [
                'Surveillance of security procedures',
                'Asking unusual questions about security',
                'Wearing appropriate clothing for the weather',
                'Testing security by probing for weaknesses'
            ],
            correct: 2
        },
        {
            question: 'When is de-escalation NOT appropriate?',
            options: [
                'When someone is frustrated or angry',
                'When a weapon is displayed or there\'s imminent threat to life',
                'When someone is intoxicated',
                'When someone is arguing loudly'
            ],
            correct: 1
        },
        {
            question: 'What is the recommended distance to maintain during a tense interaction?',
            options: [
                '1-2 feet to show you\'re not afraid',
                '6-10 feet when possible',
                '15-20 feet minimum',
                'As close as needed to hear them'
            ],
            correct: 1
        },
        {
            question: 'The OODA Loop stands for:',
            options: [
                'Observe, Operate, Decide, Act',
                'Observe, Orient, Decide, Act',
                'Order, Orient, Deploy, Assess',
                'Observe, Organize, Defend, Alert'
            ],
            correct: 1
        },
        {
            question: 'What should you do if de-escalation fails and the situation becomes violent?',
            options: [
                'Continue trying to talk them down',
                'Disengage if possible, call law enforcement, use only necessary force to protect life',
                'Immediately use maximum force',
                'Wait for the person to calm down on their own'
            ],
            correct: 1
        },
        {
            question: 'A threat is defined as:',
            options: [
                'Any dangerous situation',
                'Intent + Capability',
                'Only physical violence',
                'Something that scares you'
            ],
            correct: 1
        },
        {
            question: 'What are the 3 stages of the threat assessment cycle?',
            options: [
                'See, Report, Act',
                'Detection, Evaluation, Response',
                'Observe, Decide, Execute',
                'Identify, Contain, Resolve'
            ],
            correct: 1
        },
        {
            question: 'What does "baseline vs. anomaly" mean?',
            options: [
                'Comparing different security posts',
                'Knowing normal behavior to spot abnormal behavior',
                'Measuring crowd sizes',
                'Checking equipment standards'
            ],
            correct: 1
        },
        {
            question: 'The risk formula is:',
            options: [
                'Risk = Threat + Vulnerability',
                'Risk = Threat × Vulnerability × Consequence',
                'Risk = Threat - Protection',
                'Risk = Danger × Time'
            ],
            correct: 1
        },
        {
            question: 'What is the "25-50-100 Rule"?',
            options: [
                'Maximum crowd capacity limits',
                'Know your 25, 50, and 100-foot environment',
                'Response time standards',
                'Radio check intervals'
            ],
            correct: 1
        },
        {
            question: 'Weapon pre-indicators include:',
            options: [
                'Smiling and waving',
                'Blading body, adjusting waistband, hand near pocket',
                'Walking slowly',
                'Making eye contact'
            ],
            correct: 1
        },
        {
            question: 'The Ask-Tell-Command progression means:',
            options: [
                'Always command first to show authority',
                'Start with asking, escalate to telling, then commanding if needed',
                'Never ask, only tell and command',
                'Ask three times before giving up'
            ],
            correct: 1
        },
        {
            question: 'What critical mindset should you have about reporting threats?',
            options: [
                'Only report if you\'re 100% certain',
                'You don\'t have to be right—you just have to speak up',
                'Wait for someone else to report it',
                'Never report unless supervisor asks'
            ],
            correct: 1
        }
    ],
    'ics-100': [
        {
            question: 'What does ICS stand for?',
            options: [
                'Internal Command Structure',
                'Incident Command System',
                'Integrated Communications System',
                'International Crisis Standards'
            ],
            correct: 1
        },
        {
            question: 'Who has overall authority and responsibility for the incident?',
            options: [
                'Operations Section Chief',
                'Incident Commander (IC)',
                'Safety Officer',
                'Planning Section Chief'
            ],
            correct: 1
        },
        {
            question: 'What is the ideal span of control in ICS?',
            options: [
                '1-3 people per supervisor',
                '5 people per supervisor',
                '10-12 people per supervisor',
                'As many as needed'
            ],
            correct: 1
        },
        {
            question: 'In which section do security guards typically work?',
            options: [
                'Planning Section',
                'Operations Section',
                'Logistics Section',
                'Finance/Administration Section'
            ],
            correct: 1
        },
        {
            question: 'What is the first thing you must do when arriving at an incident?',
            options: [
                'Start working immediately',
                'Check in at designated location',
                'Find the Incident Commander',
                'Set up your equipment'
            ],
            correct: 1
        },
        {
            question: 'How many supervisors should you report to in ICS?',
            options: [
                'As many as assign you tasks',
                'ONE supervisor only',
                'Two - one primary and one backup',
                'The Incident Commander and your Section Chief'
            ],
            correct: 1
        },
        {
            question: 'What is an Incident Action Plan (IAP)?',
            options: [
                'A plan for your personal actions during the incident',
                'A plan for managing an incident during an operational period',
                'A plan for evacuating the area',
                'A plan for calling additional resources'
            ],
            correct: 1
        },
        {
            question: 'What does "Unified Command" mean?',
            options: [
                'Everyone follows one commander without question',
                'Multiple agencies share command authority and develop one plan together',
                'The military takes over command',
                'All agencies work independently'
            ],
            correct: 1
        },
        {
            question: 'Which ICS form is used as an activity log?',
            options: [
                'ICS 201',
                'ICS 214',
                'ICS 205',
                'ICS 211'
            ],
            correct: 1
        },
        {
            question: 'What are the three resource status categories in ICS?',
            options: [
                'Ready, Working, Resting',
                'Assigned, Available, Out of Service',
                'Active, Standby, Released',
                'Deployed, Staged, Demobilized'
            ],
            correct: 1
        },
        {
            question: 'What is the purpose of NIMS (National Incident Management System)?',
            options: [
                'To provide military support for incidents',
                'To enable responders from different jurisdictions to work together',
                'To replace local emergency plans',
                'To federalize all emergency response'
            ],
            correct: 1
        },
        {
            question: 'During a crowd surge simulation, who should the Incident Commander contact first when law enforcement arrives and starts overriding security orders?',
            options: [
                'The media',
                'The Liaison Officer to coordinate with law enforcement',
                'All security personnel directly',
                'The venue owner'
            ],
            correct: 1
        },
        {
            question: 'In the simulation, when multiple radio calls are happening at once during mass panic, what should the IC do?',
            options: [
                'Let everyone talk until they finish',
                'Turn off the radio',
                'Regain control by asserting command of the channel',
                'Switch to a different frequency'
            ],
            correct: 2
        },
        {
            question: 'What is the primary purpose of the After Action Review (AAR)?',
            options: [
                'To assign blame for mistakes',
                'To identify what went well, what failed, and what to do differently',
                'To write reports for management',
                'To determine who gets promoted'
            ],
            correct: 1
        },
        {
            question: 'During the simulation, when should security personnel document their activities?',
            options: [
                'Only at the end of the incident',
                'Never - that\'s someone else\'s job',
                'Throughout the incident using ICS 214 activity logs',
                'Only if something goes wrong'
            ],
            correct: 2
        }
    ],
    'diverse-population': [
        {
            question: 'What is the primary goal when interacting with a diverse population as a security guard?',
            options: [
                'Treat everyone exactly the same without any accommodations',
                'Provide professional, respectful service to all individuals regardless of background',
                'Focus only on people who speak English fluently',
                'Apply stricter security measures to unfamiliar cultural groups'
            ],
            correct: 1
        },
        {
            question: 'Under the ADA, what questions can you ask about a service animal?',
            options: [
                'What is your disability? and Can I see certification?',
                'Is this a service animal? and What task is it trained to perform?',
                'Where did you get the animal? and How much did it cost?',
                'You cannot ask any questions about service animals'
            ],
            correct: 1
        },
        {
            question: 'What is implicit bias?',
            options: [
                'Openly stated prejudices that you are aware of',
                'Unconscious attitudes that affect our actions and decisions',
                'Company policies about who to screen more carefully',
                'Legal profiling based on statistical crime data'
            ],
            correct: 1
        },
        {
            question: 'How should you handle religious head coverings during security screening?',
            options: [
                'Always require removal for proper security screening',
                'Respect them and screen without requiring removal when possible',
                'Only allow them if the person has documentation',
                'Ask the person to prove their religion is legitimate'
            ],
            correct: 1
        },
        {
            question: 'When communicating with someone who has a hearing impairment, you should:',
            options: [
                'Speak louder and exaggerate your mouth movements',
                'Face the person, speak clearly, and use written notes if needed',
                'Avoid interacting and find someone else to help them',
                'Use hand gestures only without speaking at all'
            ],
            correct: 1
        },
        {
            question: 'What is racial profiling and why is it prohibited?',
            options: [
                'A legal security technique based on crime statistics',
                'Basing security decisions on race alone - it is illegal discrimination',
                'A required practice for high-security venues and events',
                'Profiling is only illegal if done by law enforcement'
            ],
            correct: 1
        },
        {
            question: 'How should you interact with someone using a wheelchair?',
            options: [
                'Lean on or touch the wheelchair to be friendly',
                'Never touch the wheelchair without permission and ensure accessible paths',
                'Speak to their companion instead of directly to them',
                'Offer to push them even if they don\'t ask for help'
            ],
            correct: 1
        },
        {
            question: 'What should you do if you witness discrimination or harassment at your venue?',
            options: [
                'Ignore it unless the victim files a formal complaint',
                'Intervene immediately, support the victim, and report to supervisors',
                'Only get involved if it becomes physically violent',
                'Wait until your shift ends to mention it to someone'
            ],
            correct: 1
        },
        {
            question: 'When someone has difficulty speaking English, you should:',
            options: [
                'Speak louder and slower in English until they understand',
                'Use simple language, gestures, and translation apps when available',
                'Refuse to help them and direct them to find a translator',
                'Mock their accent to lighten the mood and reduce tension'
            ],
            correct: 1
        },
        {
            question: 'What is the best approach to cultural differences in personal space?',
            options: [
                'Maintain American standards of personal space with everyone',
                'Be mindful that personal space norms vary by culture',
                'Stand as close as possible to show you are friendly',
                'Avoid interacting with people from different cultures'
            ],
            correct: 1
        },
        {
            question: 'How should you address someone whose gender presentation is unclear to you?',
            options: [
                'Guess their gender based on their appearance',
                'Use the name and pronouns the person requests',
                'Avoid speaking to them to prevent making a mistake',
                'Ask invasive questions about their gender identity'
            ],
            correct: 1
        },
        {
            question: 'What is behavior-based security?',
            options: [
                'Profiling people based on their ethnic background',
                'Focusing on suspicious actions rather than appearance',
                'Treating everyone as a potential threat equally',
                'Only screening people who look nervous or anxious'
            ],
            correct: 1
        },
        {
            question: 'What does "Security isn\'t about sameness—it\'s about skill in difference" mean?',
            options: [
                'Everyone should be treated exactly the same way',
                'Professional service means adapting your approach while maintaining standards',
                'Different groups require different security standards',
                'Security should focus only on similarities'
            ],
            correct: 1
        },
        {
            question: 'When writing a report, which description is appropriate?',
            options: [
                '"Suspicious Middle Eastern male loitering"',
                '"Male, approximately 30s, pacing near entrance for 15 minutes, repeatedly checking phone"',
                '"He looked like he was up to something"',
                '"Typical troublemaker from that neighborhood"'
            ],
            correct: 1
        },
        {
            question: 'What is the best way to communicate with someone who doesn\'t speak English?',
            options: [
                'Speak louder until they understand',
                'Use gestures, simple language, translation apps, or find someone who speaks their language',
                'Give up and call law enforcement',
                'Refuse to help them'
            ],
            correct: 1
        }
    ],
    'stop-the-bleed': [
        {
            question: 'What are the 3 steps to stop bleeding?',
            options: [
                'Call 911, wait, and watch',
                'Apply pressure, pack the wound, apply tourniquet',
                'Elevate, ice, and bandage',
                'Clean, cover, and transport'
            ],
            correct: 1
        },
        {
            question: 'How quickly can severe bleeding cause death?',
            options: [
                'Within 30 minutes',
                'Within 5 minutes or less',
                'Within 15-20 minutes',
                'Within 1 hour'
            ],
            correct: 1
        },
        {
            question: 'What does the ABC acronym stand for in identifying life-threatening bleeding?',
            options: [
                'Airway, Breathing, Circulation',
                'Alert, Bleeding, Compress',
                'Assess, Bandage, Call',
                'Arterial, Blood, Capillary'
            ],
            correct: 1
        },
        {
            question: 'What is the FIRST priority before providing bleeding control?',
            options: [
                'Call 911',
                'Ensure scene safety',
                'Put on gloves',
                'Locate the bleeding'
            ],
            correct: 1
        },
        {
            question: 'What is the primary tool for stopping bleeding?',
            options: [
                'Tourniquet',
                'Direct pressure',
                'Wound packing',
                'Elevation'
            ],
            correct: 1
        },
        {
            question: 'When should you pack a wound?',
            options: [
                'For all bleeding wounds',
                'For deep wounds in junctional areas (neck, groin, armpit)',
                'Only for arm and leg wounds',
                'Never - always use tourniquets'
            ],
            correct: 1
        },
        {
            question: 'Where should a tourniquet be placed?',
            options: [
                'Directly on the wound',
                '2-3 inches above the wound, never on a joint',
                'On the nearest joint',
                'As close to the body as possible'
            ],
            correct: 1
        },
        {
            question: 'How tight should a tourniquet be?',
            options: [
                'Tight enough to slow bleeding',
                'Tight enough to stop bleeding completely',
                'Just snug, not too tight',
                'As tight as possible regardless of bleeding'
            ],
            correct: 1
        },
        {
            question: 'What should you do after applying a tourniquet?',
            options: [
                'Loosen it every 5 minutes',
                'Write the exact time on the tourniquet or victim\'s forehead',
                'Remove it once bleeding stops',
                'Apply a second one for safety'
            ],
            correct: 1
        },
        {
            question: 'Can you remove a tourniquet once applied?',
            options: [
                'Yes, after 10 minutes',
                'No, only trained medical professionals can remove it',
                'Yes, once bleeding stops',
                'Yes, if the victim complains of pain'
            ],
            correct: 1
        },
        {
            question: 'Why is a belt NOT a good tourniquet?',
            options: [
                'It\'s too short',
                'It\'s too wide and won\'t provide enough pressure',
                'It\'s too expensive',
                'It\'s too uncomfortable'
            ],
            correct: 1
        },
        {
            question: 'When calling for help, what should you say?',
            options: [
                'Someone is hurt',
                'Life-threatening bleeding at [specific location]',
                'Send an ambulance',
                'We need help now'
            ],
            correct: 1
        },
        {
            question: 'What critical rule applies when calling for help?',
            options: [
                'Call quietly so you don\'t panic the victim',
                'Don\'t assume someone else called - delegate out loud',
                'Wait until you\'ve stopped the bleeding',
                'Only call if the victim asks you to'
            ],
            correct: 1
        },
        {
            question: 'What happens if you remove a tourniquet prematurely?',
            options: [
                'Nothing serious',
                'It can kill the victim',
                'The victim will feel better',
                'Blood flow will gradually return'
            ],
            correct: 1
        },
        {
            question: 'What should you do if blood soaks through the first dressing?',
            options: [
                'Remove it and apply a new one',
                'Add more dressings on top without removing the original',
                'Switch to a tourniquet immediately',
                'Stop and wait for EMS'
            ],
            correct: 1
        },
        {
            question: 'What is the key principle of direct pressure?',
            options: [
                'Be gentle to avoid pain',
                'Direct pressure buys time - push hard and don\'t let up',
                'Apply for 30 seconds then check',
                'Use one hand only'
            ],
            correct: 1
        },
        {
            question: 'What does "Do not become a second victim" mean?',
            options: [
                'Don\'t help if you\'re scared',
                'Ensure scene safety before approaching',
                'Let professionals handle it',
                'Only help people you know'
            ],
            correct: 1
        },
        {
            question: 'What should you say to reassure a bleeding victim?',
            options: [
                'Everything will be fine',
                'I\'m here. Help is on the way.',
                'Don\'t worry about it',
                'This happens all the time'
            ],
            correct: 1
        },
        {
            question: 'What is the #1 preventable cause of death in trauma?',
            options: [
                'Head injuries',
                'Bleeding',
                'Broken bones',
                'Burns'
            ],
            correct: 1
        },
        {
            question: 'What does "MacGyver is not better than medical-grade" mean?',
            options: [
                'Always improvise tools',
                'Use real equipment when possible - improvised tools are last resort',
                'Never use improvised tools',
                'Medical equipment is too expensive'
            ],
            correct: 1
        }
    ],
    'use-of-force': [
        {
            question: 'What is the legal status of a security guard?',
            options: [
                'A law enforcement officer with arrest powers',
                'A private citizen with the same authority as any citizen',
                'A government official with special legal authority',
                'An agent of the police department with limited powers'
            ],
            correct: 1
        },
        {
            question: 'The use of force continuum starts with which level?',
            options: [
                'Verbal commands and clear directions to subjects',
                'Officer presence in uniform as a visible deterrent',
                'Empty hand control techniques for physical guidance',
                'Defensive tactics when facing immediate threats'
            ],
            correct: 1
        },
        {
            question: 'When is a security guard legally allowed to use physical force?',
            options: [
                'To enforce company rules and remove trespassers',
                'Only for self-defense or defense of others from imminent harm',
                'Whenever someone refuses to follow verbal commands',
                'To detain suspects until police arrive on scene'
            ],
            correct: 1
        },
        {
            question: 'What does "reasonable force" mean?',
            options: [
                'Any force necessary to gain compliance from subjects',
                'Force that is proportional to the threat being faced',
                'The maximum force allowed by company policy guidelines',
                'Force approved by your supervisor before taking action'
            ],
            correct: 1
        },
        {
            question: 'Can unarmed security guards make arrests?',
            options: [
                'Yes, for any crime committed on the property',
                'Only citizen\'s arrest in limited circumstances (not recommended)',
                'Yes, but only with supervisor approval first',
                'Yes, for felonies and misdemeanors witnessed directly'
            ],
            correct: 1
        },
        {
            question: 'What should you do if someone refuses to leave the property?',
            options: [
                'Physically escort them off the property immediately',
                'Call police and let them handle the removal',
                'Use reasonable force to drag them to the exit',
                'Threaten them with arrest if they don\'t comply'
            ],
            correct: 1
        },
        {
            question: 'Which action is prohibited for unarmed security guards?',
            options: [
                'Observing and reporting suspicious activity to police',
                'Using weapons like batons or pepper spray without licensing',
                'Asking people to voluntarily show identification',
                'Calling emergency services for medical situations'
            ],
            correct: 1
        },
        {
            question: 'What is the main risk of attempting a citizen\'s arrest?',
            options: [
                'The suspect might file a complaint with management',
                'High liability for false arrest, assault, and battery lawsuits',
                'You might lose your security guard license temporarily',
                'Your employer will require extensive paperwork filing'
            ],
            correct: 1
        },
        {
            question: 'If you use excessive force, you could face:',
            options: [
                'A written warning in your employment file',
                'Criminal charges, civil lawsuits, and license revocation',
                'Mandatory retraining and probation at work',
                'Suspension without pay for up to one week'
            ],
            correct: 1
        },
        {
            question: 'Security guard licensing requirements:',
            options: [
                'Are exactly the same in every state nationwide',
                'Vary significantly by state and must be researched',
                'Only apply to armed security guard positions',
                'Are optional and recommended but not required'
            ],
            correct: 1
        },
        {
            question: 'Your authority as a security guard comes from:',
            options: [
                'Your security guard license issued by the state',
                'The property owner\'s rights to control their property',
                'Special powers granted by local law enforcement',
                'Federal regulations governing private security industry'
            ],
            correct: 1
        },
        {
            question: 'What is the best practice when facing a situation requiring force?',
            options: [
                'Handle it yourself to show competence and initiative',
                'Observe, report, and call police to handle the situation',
                'Use minimal force and document it thoroughly later',
                'Consult with coworkers before taking any action'
            ],
            correct: 1
        },
        {
            question: 'What does Maryland Public Safety Article §19 define?',
            options: [
                'Police officer training requirements',
                'Licensing, conduct, and training for security guards',
                'Building security codes and standards',
                'Emergency response protocols'
            ],
            correct: 1
        },
        {
            question: 'What is Title 42 U.S.C. §1983?',
            options: [
                'Federal law about security guard licensing',
                'Law allowing lawsuits against those acting "under color of law" for civil rights violations',
                'Regulation about use of force training',
                'State law about false imprisonment'
            ],
            correct: 1
        },
        {
            question: 'What does "You are a guardian, not a warrior" mean?',
            options: [
                'Security guards should avoid all confrontation',
                'Your job is to observe, report, and protect—not punish',
                'Only warriors can use force legally',
                'Guardians have more authority than warriors'
            ],
            correct: 1
        }
    ],
    'comprehensive': [
        {
            question: 'What is the most important responsibility of an event security guard?',
            options: [
                'Looking intimidating to deter potential troublemakers',
                'Ensuring safety and security of all attendees at the event',
                'Checking social media for updates about the event',
                'Selling tickets and helping with merchandise sales'
            ],
            correct: 1
        },
        {
            question: 'When should you use your radio?',
            options: [
                'For personal conversations with other security staff',
                'For official security communications and emergencies only',
                'To play music and entertainment during slow periods',
                'Never use it to avoid cluttering the channel'
            ],
            correct: 1
        },
        {
            question: 'What does "10-4" mean on the radio?',
            options: [
                'Emergency situation requiring all units to respond',
                'Message received and understood clearly by recipient',
                'Out of service and unavailable for assignments',
                'Need backup assistance at your current location'
            ],
            correct: 1
        },
        {
            question: 'If you witness a fight, you should:',
            options: [
                'Join in to help physically separate the individuals',
                'Call for backup, attempt verbal de-escalation if safe, protect bystanders',
                'Film it with your phone to capture evidence',
                'Walk away and let them resolve it themselves'
            ],
            correct: 1
        },
        {
            question: 'Professional appearance includes:',
            options: [
                'Wearing whatever you want',
                'Clean uniform, proper grooming, visible ID',
                'Casual clothes',
                'Hiding your badge'
            ],
            correct: 1
        },
        {
            question: 'If an attendee is intoxicated and disruptive, you should:',
            options: [
                'Serve them more alcohol',
                'Assess situation, deny further service, arrange safe removal if needed',
                'Ignore them',
                'Laugh at them'
            ],
            correct: 1
        },
        {
            question: 'Chain of command means:',
            options: [
                'Everyone is equal',
                'Following proper reporting structure and authority levels',
                'Ignoring supervisors',
                'Doing whatever you want'
            ],
            correct: 1
        },
        {
            question: 'When writing an incident report, you should:',
            options: [
                'Make up details',
                'Be factual, objective, and include all relevant information',
                'Exaggerate',
                'Leave out important facts'
            ],
            correct: 1
        },
        {
            question: 'If you find a suspicious unattended bag, you should:',
            options: [
                'Open it carefully to see what\'s inside before reporting',
                'Do not touch it, clear the area, alert supervisor and authorities',
                'Kick it to a corner out of the way of foot traffic',
                'Take it home to lost and found after your shift'
            ],
            correct: 1
        },
        {
            question: 'De-escalation techniques include:',
            options: [
                'Yelling louder',
                'Calm voice, active listening, offering solutions, maintaining distance',
                'Physical confrontation',
                'Insults'
            ],
            correct: 1
        },
        {
            question: 'Your post assignment means:',
            options: [
                'You can leave whenever',
                'You stay at assigned location unless relieved or emergency',
                'You can wander around',
                'You can switch with anyone'
            ],
            correct: 1
        },
        {
            question: 'If you need to leave your post, you must:',
            options: [
                'Just leave',
                'Get supervisor approval and ensure post is covered',
                'Tell a friend',
                'Sneak away'
            ],
            correct: 1
        },
        {
            question: 'Customer service in security means:',
            options: [
                'Being rude to assert authority',
                'Being helpful, professional, and respectful while enforcing rules',
                'Ignoring people',
                'Only helping VIPs'
            ],
            correct: 1
        },
        {
            question: 'If you see a lost child, you should:',
            options: [
                'Ignore them',
                'Stay with child, call supervisor, use PA system, reunite with parent safely',
                'Send them away',
                'Take them home'
            ],
            correct: 1
        },
        {
            question: 'Situational awareness means:',
            options: [
                'Staring at your phone to monitor social media',
                'Being alert to your surroundings and potential threats',
                'Daydreaming about what you\'ll do after work',
                'Closing your eyes periodically to rest and relax'
            ],
            correct: 1
        },
        {
            question: 'If someone asks for directions, you should:',
            options: [
                'Ignore them',
                'Provide clear, helpful directions while maintaining security awareness',
                'Tell them to figure it out',
                'Give wrong directions'
            ],
            correct: 1
        },
        {
            question: 'What should you do during a shift briefing?',
            options: [
                'Sleep',
                'Pay attention, take notes, ask questions about your assignment',
                'Talk to friends',
                'Leave early'
            ],
            correct: 1
        },
        {
            question: 'If you witness theft, you should:',
            options: [
                'Chase the suspect alone',
                'Observe and report details to supervisor and police, ensure safety first',
                'Ignore it',
                'Tackle them'
            ],
            correct: 1
        },
        {
            question: 'Proper radio etiquette includes:',
            options: [
                'Interrupting others',
                'Waiting for clear channel, being concise, using proper codes',
                'Talking constantly',
                'Using slang'
            ],
            correct: 1
        },
        {
            question: 'If weather becomes severe during an outdoor event, you should:',
            options: [
                'Continue as normal',
                'Follow emergency weather protocol, help evacuate to shelter if needed',
                'Run away',
                'Ignore warnings'
            ],
            correct: 1
        },
        {
            question: 'Confidentiality means:',
            options: [
                'Posting everything on social media',
                'Not discussing security details, incidents, or private information publicly',
                'Telling everyone',
                'Sharing passwords'
            ],
            correct: 1
        },
        {
            question: 'If you make a mistake, you should:',
            options: [
                'Hide it',
                'Report it to supervisor immediately and learn from it',
                'Blame others',
                'Lie about it'
            ],
            correct: 1
        },
        {
            question: 'Physical force should be used:',
            options: [
                'Whenever you want',
                'Only as last resort for self-defense or defense of others, within legal limits',
                'To intimidate people',
                'Never, even in emergencies'
            ],
            correct: 1
        },
        {
            question: 'If you feel unsafe in a situation, you should:',
            options: [
                'Act tough',
                'Call for backup and prioritize your safety',
                'Handle it alone',
                'Ignore your instincts'
            ],
            correct: 1
        },
        {
            question: 'End-of-shift procedures include:',
            options: [
                'Just leaving',
                'Completing reports, briefing relief, returning equipment, signing out',
                'Disappearing',
                'Taking equipment home'
            ],
            correct: 1
        },
        {
            question: 'As a security guard, your legal authority comes from:',
            options: [
                'Your security guard license issued by the state',
                'The property owner\'s rights to control their property',
                'Special powers granted by local law enforcement',
                'Federal regulations governing the private security industry'
            ],
            correct: 1
        },
        {
            question: 'The first level of the use of force continuum is:',
            options: [
                'Verbal commands and clear directions to subjects',
                'Officer presence in uniform as a visible deterrent',
                'Empty hand control techniques for physical guidance',
                'Defensive tactics when facing immediate physical threats'
            ],
            correct: 1
        },
        {
            question: 'When can you legally use physical force as a security guard?',
            options: [
                'To enforce company rules and remove trespassers',
                'Only for self-defense or defense of others from harm',
                'Whenever someone refuses to follow your commands',
                'To detain suspects until police arrive on scene'
            ],
            correct: 1
        },
        {
            question: 'Reasonable force means:',
            options: [
                'Any force necessary to gain compliance from subjects',
                'Force that is proportional to the threat you face',
                'The maximum force allowed by your company policy',
                'Force approved by your supervisor before taking action'
            ],
            correct: 1
        },
        {
            question: 'If someone refuses to leave private property, you should:',
            options: [
                'Physically escort them off the property immediately',
                'Call police and let them handle the removal',
                'Use reasonable force to drag them to the exit',
                'Threaten them with arrest if they don\'t comply'
            ],
            correct: 1
        },
        {
            question: 'Citizen\'s arrest by security guards is:',
            options: [
                'Recommended for all felonies committed on property',
                'Not recommended due to high liability risks',
                'Required by law when you witness a crime',
                'Only allowed with written permission from employer'
            ],
            correct: 1
        },
        {
            question: 'Using excessive force can result in:',
            options: [
                'A written warning placed in your employment file',
                'Criminal charges, civil lawsuits, and license revocation',
                'Mandatory retraining and probation at your job',
                'Suspension without pay for up to one week'
            ],
            correct: 1
        },
        {
            question: 'Security guard laws and requirements:',
            options: [
                'Are exactly the same in every state nationwide',
                'Vary significantly by state and must be researched',
                'Only apply to armed security guard positions',
                'Are optional and recommended but not legally required'
            ],
            correct: 1
        },
        {
            question: 'What should you do when facing a situation that may require force?',
            options: [
                'Handle it yourself to show competence to supervisors',
                'Observe, report, and call police to handle it',
                'Use minimal force and document it thoroughly later',
                'Consult with coworkers before taking any action'
            ],
            correct: 1
        },
        {
            question: 'Stand your ground laws:',
            options: [
                'Apply equally in all 50 states across the nation',
                'Vary by state - some have duty to retreat instead',
                'Only apply to law enforcement officers on duty',
                'Give security guards the same powers as police'
            ],
            correct: 1
        },
        {
            question: 'What are the three steps of STOP THE BLEED®?',
            options: [
                'Call 911, apply bandage, wait for help',
                'Identify the bleeding, apply pressure, get help',
                'Assess scene, treat shock, call for backup',
                'Remove clothing, elevate limb, apply tourniquet'
            ],
            correct: 1
        },
        {
            question: 'Where should a tourniquet be placed?',
            options: [
                'Directly on the wound for maximum pressure',
                '2-3 inches above the wound, never on a joint',
                'As close to the body as possible',
                'On the joint closest to the wound'
            ],
            correct: 1
        },
        {
            question: 'Under the ADA, what questions can you ask about a service animal?',
            options: [
                'What is your disability? and Can I see certification?',
                'Is this a service animal? and What task is it trained to perform?',
                'Where did you get the animal? and How much did it cost?',
                'You cannot ask any questions about service animals'
            ],
            correct: 1
        },
        {
            question: 'What is racial profiling?',
            options: [
                'A legal security technique based on statistics',
                'Basing security decisions on race alone - it is illegal',
                'A required practice for high-security venues',
                'Profiling only illegal if done by law enforcement'
            ],
            correct: 1,
            moduleReference: 'Module 5: Interacting with Diverse Populations - Implicit Bias and Profiling'
        },
        {
            question: 'What is the first priority before providing medical care?',
            options: [
                'Call 911 and get professional help',
                'Ensure scene safety for yourself and others',
                'Put on gloves and protective equipment',
                'Locate the source of bleeding'
            ],
            correct: 1
        },
        {
            question: 'How should you handle religious head coverings during screening?',
            options: [
                'Always require removal for proper screening',
                'Respect them and screen without requiring removal when possible',
                'Only allow them with documentation',
                'Ask the person to prove their religion'
            ],
            correct: 1
        },
        {
            question: 'When using the radio, you should:',
            options: [
                'Talk immediately after pressing the button',
                'Wait 1-2 seconds after pressing PTT before speaking',
                'Hold the button while listening',
                'Press and release quickly for each word'
            ],
            correct: 1
        },
        {
            question: 'What should you do if you witness discrimination?',
            options: [
                'Ignore it unless the victim complains',
                'Intervene immediately, support victim, and report to supervisors',
                'Only get involved if it becomes violent',
                'Wait until your shift ends to mention it'
            ],
            correct: 1
        },
        {
            question: 'Who can remove a tourniquet once applied?',
            options: [
                'Anyone trained in STOP THE BLEED®',
                'Only medical professionals (EMS, doctors, nurses)',
                'The person who applied it if bleeding stopped',
                'A supervisor or team leader on scene'
            ],
            correct: 1
        }
    ]
};


// Load state laws from database
async function loadStateLaws() {
    try {
        const { data: states, error } = await supabase
            .from('state_laws')
            .select('*')
            .order('state_name');
        
        if (error) throw error;
        
        // Convert to the format expected by the app
        const stateLawsObj = {};
        states.forEach(state => {
            stateLawsObj[state.state_code] = {
                name: state.state_name,
                licensing: state.licensing,
                trainingHours: state.training_hours,
                minAge: state.min_age,
                useOfForce: state.use_of_force,
                citizensArrest: state.citizens_arrest,
                weapons: state.weapons,
                agency: state.regulatory_agency,
                notes: state.notes
            };
        });
        
        // Store in window for global access
        window.stateLaws = stateLawsObj;
        console.log(`Loaded ${states.length} state laws from database`);
        return stateLawsObj;
    } catch (error) {
        console.error('Error loading state laws:', error);
        // Fallback to hardcoded if database fails
        return window.stateLaws || {};
    }
}

// Load assessment questions from database
async function loadAssessmentQuestions(moduleCode) {
    try {
        // Get module and assessment
        const { data: module, error: moduleError } = await supabase
            .from('training_modules')
            .select('id')
            .eq('module_code', moduleCode)
            .single();
        
        if (moduleError || !module) {
            console.warn('No module found for code:', moduleCode);
            return null;
        }
        
        const { data: assessment, error: assessmentError } = await supabase
            .from('assessments')
            .select('id, questions_json, assessment_name')
            .eq('module_id', module.id)
            .single();
        
        if (assessmentError || !assessment) {
            console.warn('No assessment found for module:', moduleCode);
            return null;
        }
        
        // Parse questions from JSON column
        let questions = [];
        if (assessment.questions_json && Array.isArray(assessment.questions_json)) {
            questions = assessment.questions_json.map(q => ({
                question: q.question,
                options: q.options,
                correct: q.correctAnswer,
                explanation: q.explanation || ''
            }));
        }
        
        // Special handling for Module 7 (Use of Force) - combine with state-specific questions
        if (moduleCode === 'use-of-force') {
            const selectedState = localStorage.getItem('selectedState');
            
            // Ensure state laws are loaded
            if (!window.stateLaws || Object.keys(window.stateLaws).length === 0) {
                await loadStateLaws();
            }
            
            if (selectedState && window.stateLaws && window.stateLaws[selectedState]) {
                const stateInfo = window.stateLaws[selectedState];
                
                // Generate 7 state-specific questions
                const stateQuestions = [
                    {
                        question: `What is the licensing requirement for security guards in ${stateInfo.name}?`,
                        options: [
                            'No license required in any circumstance',
                            stateInfo.licensing,
                            'Federal license required from DHS',
                            'Only armed guards need licensing'
                        ],
                        correct: 1
                    },
                    {
                        question: `What are the training hour requirements in ${stateInfo.name}?`,
                        options: [
                            'No mandatory training required',
                            '100 hours minimum before starting',
                            stateInfo.trainingHours,
                            'Training is optional and recommended'
                        ],
                        correct: 2
                    },
                    {
                        question: `What is the minimum age to work as a security guard in ${stateInfo.name}?`,
                        options: [
                            '16 years old',
                            '21 years old',
                            stateInfo.minAge,
                            '25 years old'
                        ],
                        correct: 2
                    },
                    {
                        question: `Regarding use of force in ${stateInfo.name}:`,
                        options: [
                            'Security guards have the same authority as police',
                            'Any force is allowed to protect property',
                            stateInfo.useOfForce,
                            'Force is never allowed under any circumstances'
                        ],
                        correct: 2
                    },
                    {
                        question: `What is the citizen's arrest law in ${stateInfo.name}?`,
                        options: [
                            'Citizen\'s arrest is completely prohibited',
                            'Allowed for any crime witnessed',
                            stateInfo.citizensArrest,
                            'Only police can make arrests'
                        ],
                        correct: 2
                    },
                    {
                        question: `What are the weapons regulations for security guards in ${stateInfo.name}?`,
                        options: [
                            'All guards can carry any weapons',
                            'Weapons are completely prohibited',
                            stateInfo.weapons,
                            'Only pepper spray is allowed'
                        ],
                        correct: 2
                    },
                    {
                        question: `Which agency regulates security guards in ${stateInfo.name}?`,
                        options: [
                            'Federal Bureau of Investigation (FBI)',
                            'Department of Homeland Security',
                            stateInfo.agency,
                            'Local police departments only'
                        ],
                        correct: 2
                    }
                ];
                
                // Combine state-specific questions (first) with general questions (from database)
                questions = [...stateQuestions, ...questions];
                console.log(`Loaded ${questions.length} questions for ${moduleCode} (7 state-specific + ${questions.length - 7} general)`);
            }
        }
        
        if (questions.length === 0) {
            console.warn('No questions found for assessment:', assessment.id);
            return null;
        }
        
        console.log(`Loaded ${questions.length} questions from database for ${moduleCode}`);
        return questions;
        
    } catch (error) {
        console.error('Error loading assessment questions:', error);
        return null;
    }
}

// Shuffle array helper function
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

async function startAssessment(assessmentId) {
    // Check attempt limit
    if (!assessmentAttempts[assessmentId]) {
        assessmentAttempts[assessmentId] = 0;
    }
    
    if (assessmentAttempts[assessmentId] >= 3) {
        alert('You have reached the maximum number of attempts (3) for this assessment. Please contact your instructor for assistance.');
        return;
    }
    
    assessmentAttempts[assessmentId]++;
    
    currentAssessment = assessmentId;
    currentQuestionIndex = 0;
    userAnswers = [];
    assessmentStartTime = Date.now();

    // Try to load questions from database first
    let questions = await loadAssessmentQuestions(assessmentId);
    
    // Fallback to hardcoded questions if database load fails
    if (!questions || questions.length === 0) {
        // Check for state-specific questions (Module 7)
        questions = assessmentQuestions[assessmentId];
        if (window.getStateSpecificQuestions) {
            const stateQuestions = window.getStateSpecificQuestions(assessmentId);
            if (stateQuestions) {
                questions = stateQuestions;
            }
        }
    }
    
    // Check if questions exist
    if (!questions || questions.length === 0) {
        alert('This assessment does not have any questions yet. Please contact your instructor.');
        assessmentAttempts[assessmentId]--; // Don't count this as an attempt
        return;
    }
    
    // Shuffle answer options for each question
    shuffledQuestions = questions.map(q => {
        const shuffledOptions = q.options.map((option, index) => ({
            text: option,
            originalIndex: index
        }));
        
        // Shuffle the options
        const shuffled = shuffleArray(shuffledOptions);
        
        // Find new position of correct answer
        const newCorrectIndex = shuffled.findIndex(opt => opt.originalIndex === q.correct);
        
        return {
            question: q.question,
            options: shuffled.map(opt => opt.text),
            correct: newCorrectIndex
        };
    });
    
    // Initialize answers array
    for (let i = 0; i < shuffledQuestions.length; i++) {
        userAnswers.push(null);
    }

    // Show quiz interface
    document.querySelector('.assessment-selector').style.display = 'none';
    document.getElementById('assessmentQuiz').classList.remove('hidden');

    // Set title
    const titles = {
        'communication-protocols': 'Module 1: Security Radio Communications Assessment',
        'stop-the-bleed': 'Module 2: STOP THE BLEED® Emergency Medical Response Assessment',
        'threat-assessment': 'Module 3: Threat Assessment & Situational Awareness Assessment',
        'ics-100': 'Module 4: Introduction to ICS-100 Assessment',
        'diverse-population': 'Module 5: Interacting with Diverse Populations Assessment',
        'crowd-management': 'Module 6: Crowd Management & Public Safety Assessment',
        'use-of-force': 'Module 7: Legal Aspects & Use of Force Assessment',
        'comprehensive': 'Comprehensive Guard Certification Exam'
    };
    
    let assessmentTitle = titles[assessmentId];
    
    // Add state name for Module 7
    if (assessmentId === 'use-of-force') {
        const selectedState = localStorage.getItem('selectedState');
        if (selectedState && window.stateLaws && window.stateLaws[selectedState]) {
            assessmentTitle = `Module 7: Legal Aspects & Use of Force Assessment (${window.stateLaws[selectedState].name})`;
        }
    }
    
    document.getElementById('quizTitle').textContent = assessmentTitle;

    // Start timer
    const duration = assessmentId === 'comprehensive' ? 75 : 
                    (assessmentId === 'use-of-force' || assessmentId === 'stop-the-bleed' || assessmentId === 'crowd-management') ? 20 : 15;
    startTimer(duration);

    // Load first question
    loadQuestion(0);
}

function startTimer(minutes) {
    let timeLeft = minutes * 60; // Convert to seconds
    
    timerInterval = setInterval(() => {
        timeLeft--;
        
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        document.getElementById('quizTimer').textContent = 
            `${mins}:${secs.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitAssessment();
        }
    }, 1000);
}

function loadQuestion(index) {
    const question = shuffledQuestions[index];
    
    document.getElementById('quizProgress').textContent = 
        `Question ${index + 1} of ${shuffledQuestions.length}`;
    
    let html = `
        <div class="question">
            <h4>${index + 1}. ${question.question}</h4>
            <div class="options">
    `;
    
    question.options.forEach((option, i) => {
        const selected = userAnswers[index] === i ? 'selected' : '';
        html += `
            <div class="option ${selected}" onclick="selectAnswer(${i})">
                <div class="option-label">${String.fromCharCode(65 + i)}</div>
                <div>${option}</div>
            </div>
        `;
    });
    
    html += '</div></div>';
    
    document.getElementById('questionContainer').innerHTML = html;
    
    // Update button visibility
    document.getElementById('prevBtn').style.display = index === 0 ? 'none' : 'inline-flex';
    document.getElementById('nextBtn').style.display = 
        index === shuffledQuestions.length - 1 ? 'none' : 'inline-flex';
    document.getElementById('submitBtn').classList.toggle(
        'hidden', 
        index !== shuffledQuestions.length - 1
    );
}

function selectAnswer(optionIndex) {
    userAnswers[currentQuestionIndex] = optionIndex;
    loadQuestion(currentQuestionIndex);
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadQuestion(currentQuestionIndex);
    }
}

function nextQuestion() {
    if (currentQuestionIndex < shuffledQuestions.length - 1) {
        currentQuestionIndex++;
        loadQuestion(currentQuestionIndex);
    }
}

function submitAssessment() {
    clearInterval(timerInterval);
    
    let correctCount = 0;
    
    shuffledQuestions.forEach((question, index) => {
        if (userAnswers[index] === question.correct) {
            correctCount++;
        }
    });
    
    const percentage = Math.round((correctCount / shuffledQuestions.length) * 100);
    const timeTaken = Math.floor((Date.now() - assessmentStartTime) / 1000);
    const minutes = Math.floor(timeTaken / 60);
    const seconds = timeTaken % 60;
    
    // Hide quiz, show results
    document.getElementById('assessmentQuiz').classList.add('hidden');
    document.getElementById('assessmentResults').classList.remove('hidden');
    
    // Update results
    document.getElementById('scorePercentage').textContent = `${percentage}%`;
    document.getElementById('correctAnswers').textContent = correctCount;
    document.getElementById('incorrectAnswers').textContent = shuffledQuestions.length - correctCount;
    document.getElementById('timeTaken').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Animate score circle
    const circumference = 2 * Math.PI * 90;
    const offset = circumference - (percentage / 100) * circumference;
    document.getElementById('scoreCircle').style.strokeDashoffset = offset;
    
    // Feedback
    let feedback = '';
    if (percentage >= 90) {
        feedback = '<p><strong>Outstanding!</strong> You have demonstrated excellent understanding of security concepts.</p>';
    } else if (percentage >= 70) {
        feedback = '<p><strong>Good job!</strong> You have a solid grasp of the material. Review the areas where you missed questions.</p>';
    } else if (percentage >= 50) {
        feedback = '<p><strong>Passing.</strong> Consider reviewing the training materials to strengthen your understanding.</p>';
    } else {
        feedback = '<p><strong>Needs improvement.</strong> Please review the training modules and retake the assessment.</p>';
    }
    document.getElementById('resultsFeedback').innerHTML = feedback;
    
    // Save to progress
    if (percentage >= 70) {
        progressData.assessmentResults.push({
            module: currentAssessment,
            assessment: currentAssessment,
            score: percentage,
            date: new Date().toISOString()
        });
        addActivity(`Passed assessment: ${document.getElementById('quizTitle').textContent} (${percentage}%)`);
        saveProgress();
    }
}

function reviewAnswers() {
    console.log('reviewAnswers() called - v2.5');
    
    // Hide results, show review
    document.getElementById('assessmentResults').classList.add('hidden');
    document.getElementById('assessmentQuiz').classList.remove('hidden');
    
    // Count incorrect answers
    let incorrectCount = 0;
    shuffledQuestions.forEach((q, index) => {
        if (userAnswers[index] !== q.correct) {
            incorrectCount++;
        }
    });
    
    // Build review HTML
    let reviewHTML = `
        <div class="review-header">
            <h3>Assessment Review - ${document.getElementById('quizTitle').textContent}</h3>
            <p>You have <strong>${incorrectCount} incorrect answer(s)</strong> marked in red below. You can change your answers for the incorrect questions only.</p>
            <p><strong>Attempts remaining: ${3 - assessmentAttempts[currentAssessment]} of 3</strong></p>
        </div>
        <div class="review-content">
    `;
    
    // Show ALL questions in order
    shuffledQuestions.forEach((q, index) => {
        const userAnswerIndex = userAnswers[index];
        const isCorrect = userAnswerIndex === q.correct; // Use q.correct, not q.correctAnswerIndex
        const moduleRef = q.moduleReference || 'Review training materials';
        
        if (isCorrect) {
            // Show correct answers as locked/read-only
            const correctAnswerText = q.options[userAnswerIndex];
            reviewHTML += `
                <div class="review-question correct locked">
                    <div class="review-question-header">
                        <span class="question-number">Question ${index + 1}</span>
                        <span class="review-status correct">
                            <i class="fas fa-check-circle"></i>
                            Correct
                        </span>
                    </div>
                    <p class="review-question-text"><strong>${q.question}</strong></p>
                    <div class="locked-message">
                        <i class="fas fa-lock"></i> <strong>Your Answer:</strong> ${correctAnswerText}
                    </div>
                </div>
            `;
        } else {
            // Show incorrect answers as editable
            reviewHTML += `
                <div class="review-question incorrect editable">
                    <div class="review-question-header">
                        <span class="question-number">Question ${index + 1}</span>
                        <span class="review-status incorrect">
                            <i class="fas fa-times-circle"></i>
                            Incorrect - Change Your Answer
                        </span>
                    </div>
                    <p class="review-question-text"><strong>${q.question}</strong></p>
                    <div class="review-answer-section">
                        <p class="module-reference"><strong>📚 Study Reference:</strong> ${moduleRef}</p>
                    </div>
                    <div class="review-options">
                        ${q.options.map((optionText, optIndex) => `
                            <div class="option ${userAnswerIndex === optIndex ? 'was-selected' : ''}" 
                                 onclick="selectReviewAnswer(${index}, ${optIndex})">
                                <input type="radio" 
                                       name="review-question-${index}" 
                                       id="review-q${index}-opt${optIndex}"
                                       ${userAnswerIndex === optIndex ? 'checked' : ''}>
                                <label for="review-q${index}-opt${optIndex}">
                                    <span class="option-label">${String.fromCharCode(65 + optIndex)}</span>
                                    <span class="option-text">${optionText}</span>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    });
    
    reviewHTML += `
        </div>
        <div class="review-actions">
            <button class="btn btn-secondary" onclick="closeReview()">Cancel</button>
            ${assessmentAttempts[currentAssessment] < 3 ? 
                '<button class="btn btn-primary" onclick="resubmitAssessment()">Resubmit Assessment</button>' : 
                '<p style="color: var(--danger); margin-top: 1rem;">Maximum attempts reached. Contact instructor for assistance.</p>'}
        </div>
    `;
    
    // Hide the quiz header and footer, show only the body with review content
    console.log('Setting review HTML, length:', reviewHTML.length);
    console.log('Incorrect count:', incorrectCount);
    
    const quizHeader = document.querySelector('.quiz-header');
    const quizFooter = document.querySelector('.quiz-footer');
    const quizBody = document.querySelector('.quiz-body');
    
    console.log('Quiz header found:', !!quizHeader);
    console.log('Quiz footer found:', !!quizFooter);
    console.log('Quiz body found:', !!quizBody);
    
    if (quizHeader) quizHeader.style.display = 'none';
    if (quizFooter) quizFooter.style.display = 'none';
    if (quizBody) {
        quizBody.innerHTML = reviewHTML;
        console.log('Review HTML inserted successfully');
    } else {
        console.error('Quiz body not found!');
    }
}

function selectReviewAnswer(questionIndex, optionIndex) {
    // Update the user's answer for this question
    userAnswers[questionIndex] = optionIndex;
    
    // Update UI to show selection - questions are in order now
    const allQuestions = document.querySelectorAll('.review-question');
    const questionDiv = allQuestions[questionIndex];
    
    if (questionDiv) {
        questionDiv.querySelectorAll('.option').forEach((opt, idx) => {
            if (idx === optionIndex) {
                opt.classList.add('selected');
                opt.classList.remove('was-selected');
                opt.querySelector('input').checked = true;
            } else {
                opt.classList.remove('selected');
                opt.querySelector('input').checked = false;
            }
        });
    }
}

function resubmitAssessment() {
    console.log('Resubmitting assessment with updated answers');
    
    // Restore quiz header and footer
    const quizHeader = document.querySelector('.quiz-header');
    const quizFooter = document.querySelector('.quiz-footer');
    if (quizHeader) quizHeader.style.display = '';
    if (quizFooter) quizFooter.style.display = '';
    
    // Hide quiz, show results
    document.getElementById('assessmentQuiz').classList.add('hidden');
    document.getElementById('assessmentResults').classList.remove('hidden');
    
    // Recalculate and display results
    let correctCount = 0;
    shuffledQuestions.forEach((q, index) => {
        if (userAnswers[index] === q.correct) {
            correctCount++;
        }
    });
    
    const percentage = Math.round((correctCount / shuffledQuestions.length) * 100);
    
    // Calculate time taken (use original start time)
    const timeTaken = Math.floor((Date.now() - assessmentStartTime) / 1000);
    const minutes = Math.floor(timeTaken / 60);
    const seconds = timeTaken % 60;
    
    // Update results display
    document.getElementById('scorePercentage').textContent = `${percentage}%`;
    document.getElementById('correctAnswers').textContent = correctCount;
    document.getElementById('incorrectAnswers').textContent = shuffledQuestions.length - correctCount;
    document.getElementById('timeTaken').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Animate score circle
    const circumference = 2 * Math.PI * 90;
    const offset = circumference - (percentage / 100) * circumference;
    document.getElementById('scoreCircle').style.strokeDashoffset = offset;
    
    // Update feedback
    let feedback = '';
    if (percentage >= 90) {
        feedback = '<p><strong>Outstanding!</strong> You have demonstrated excellent understanding of security concepts.</p>';
    } else if (percentage >= 70) {
        feedback = '<p><strong>Good job!</strong> You have a solid grasp of the material. Review the areas where you missed questions.</p>';
    } else if (percentage >= 50) {
        feedback = '<p><strong>Passing.</strong> Consider reviewing the training materials to strengthen your understanding.</p>';
    } else {
        feedback = '<p><strong>Needs improvement.</strong> Please review the training modules and retake the assessment.</p>';
    }
    document.getElementById('resultsFeedback').innerHTML = feedback;
    
    // Save to progress (save all attempts, not just passing)
    progressData.assessmentResults.push({
        module: currentAssessment,
        assessment: currentAssessment,
        score: percentage,
        date: new Date().toISOString(),
        questions: shuffledQuestions,
        userAnswers: [...userAnswers],
        passed: percentage >= 70
    });
    
    if (percentage >= 70) {
        addActivity(`Passed assessment: ${document.getElementById('quizTitle').textContent} (${percentage}%)`);
    } else {
        addActivity(`Attempted assessment: ${document.getElementById('quizTitle').textContent} (${percentage}%)`);
    }
    saveProgress();
}

function closeReview() {
    // Restore quiz header and footer
    document.querySelector('.quiz-header').style.display = '';
    document.querySelector('.quiz-footer').style.display = '';
    
    document.getElementById('assessmentQuiz').classList.add('hidden');
    document.querySelector('.assessment-selector').style.display = 'block';
    currentAssessment = null;
}

function retakeAssessment() {
    const assessmentId = currentAssessment;
    closeReview();
    startAssessment(assessmentId);
}

function closeAssessment() {
    document.getElementById('assessmentResults').classList.add('hidden');
    document.querySelector('.assessment-selector').style.display = 'block';
    currentAssessment = null;
}

// ============= PROGRESS TRACKING =============

function addActivity(description) {
    const activity = {
        description,
        date: new Date().toISOString()
    };
    progressData.activities.unshift(activity);
    if (progressData.activities.length > 10) {
        progressData.activities.pop();
    }
}

// Get best assessment attempt for each unique module
function getBestAssessmentAttempts() {
    const bestByModule = {};
    
    // Group by module and keep only the highest score
    progressData.assessmentResults.forEach(result => {
        const moduleCode = result.module || result.assessment;
        if (!moduleCode) return;
        
        if (!bestByModule[moduleCode] || result.score > bestByModule[moduleCode].score) {
            bestByModule[moduleCode] = result;
        }
    });
    
    return Object.values(bestByModule);
}

function updateProgressDisplay() {
    // Ensure progressData has all required properties
    if (!progressData.completedModules) progressData.completedModules = [];
    if (!progressData.completedScenarios) progressData.completedScenarios = [];
    if (!progressData.assessmentResults) progressData.assessmentResults = [];
    if (!progressData.activities) progressData.activities = [];
    
    // Update stats
    document.getElementById('completedModules').textContent = progressData.completedModules.length;
    document.getElementById('completedScenarios').textContent = progressData.completedScenarios.length;
    
    // Get best attempt for each unique assessment
    const bestAttempts = getBestAssessmentAttempts();
    
    // Count only passed assessments (using best attempts)
    const passedAssessments = bestAttempts.filter(r => r.score >= 70).length;
    document.getElementById('completedAssessments').textContent = passedAssessments;
    
    // Calculate average score using only best attempts
    const avgScore = bestAttempts.length > 0 ?
        Math.round(bestAttempts.reduce((sum, r) => sum + r.score, 0) / bestAttempts.length) : 0;
    document.getElementById('averageScore').textContent = `${avgScore}%`;
    
    // Update module progress (use database modules if available, sorted by display_order)
    updateModuleProgressDisplay();
    
    // Update assessment history
    if (progressData.assessmentResults.length > 0) {
        const assessmentTitles = {
            'communication-protocols': 'Module 1: Security Radio Communications',
            'stop-the-bleed': 'Module 2: STOP THE BLEED®',
            'threat-assessment': 'Module 3: Threat Assessment & Situational Awareness',
            'ics-100': 'Module 4: Introduction to ICS-100',
            'diverse-population': 'Module 5: Interacting with Diverse Populations',
            'crowd-management': 'Module 6: Crowd Management & Public Safety',
            'use-of-force': 'Module 7: Legal Aspects & Use of Force',
            'comprehensive': 'Comprehensive Guard Certification'
        };
        
        const assessmentHistoryHTML = progressData.assessmentResults
            .slice()
            .reverse() // Show most recent first
            .map((result, index) => {
                const date = new Date(result.date);
                const passed = result.score >= 70;
                const statusClass = passed ? 'success' : 'danger';
                const statusIcon = passed ? 'fa-check-circle' : 'fa-times-circle';
                const statusText = passed ? 'Passed' : 'Failed';
                
                // Use module or assessment property for lookup
                const moduleCode = result.module || result.assessment;
                const title = assessmentTitles[moduleCode] || moduleCode || 'Unknown Assessment';
                
                return `
                    <div class="assessment-history-item">
                        <div class="assessment-history-header">
                            <div>
                                <h4>${title}</h4>
                                <span style="color: var(--text-secondary); font-size: 0.875rem;">
                                    ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}
                                </span>
                            </div>
                            <div class="assessment-history-score">
                                <span class="score-badge ${statusClass}">
                                    <i class="fas ${statusIcon}"></i> ${result.score}%
                                </span>
                            </div>
                        </div>
                        <div class="assessment-history-actions">
                            <span class="status-text ${statusClass}">${statusText}</span>
                            <button class="btn btn-small btn-secondary" onclick="reviewPastAssessment(${progressData.assessmentResults.length - 1 - index})">
                                <i class="fas fa-eye"></i> Review Answers
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        document.getElementById('assessmentHistory').innerHTML = assessmentHistoryHTML;
    }
    
    // Update activity list
    if (progressData.activities.length > 0) {
        const activityHTML = progressData.activities.map(activity => {
            const date = new Date(activity.date);
            return `
                <div class="activity-item">
                    <i class="fas fa-check-circle"></i>
                    <p>${activity.description}</p>
                    <span style="color: var(--text-secondary); font-size: 0.875rem;">
                        ${date.toLocaleDateString()}
                    </span>
                </div>
            `;
        }).join('');
        document.getElementById('activityList').innerHTML = activityHTML;
    }
    
    // Update achievements
    const achievements = [
        { id: 'first-module', condition: progressData.completedModules.length >= 1, icon: 'fa-medal', label: 'First Module' },
        { id: 'perfect-score', condition: progressData.assessmentResults.some(r => r.score === 100), icon: 'fa-trophy', label: 'Perfect Score' },
        { id: 'five-day-streak', condition: false, icon: 'fa-fire', label: '5 Day Streak' },
        { id: 'all-modules', condition: progressData.completedModules.length === 7, icon: 'fa-crown', label: 'All 7 Modules' }
    ];
    
    const achievementsHTML = achievements.map(achievement => {
        const locked = achievement.condition ? '' : 'locked';
        return `
            <div class="achievement-badge ${locked}">
                <i class="fas ${achievement.icon}"></i>
                <span>${achievement.label}</span>
            </div>
        `;
    }).join('');
    document.getElementById('achievementsGrid').innerHTML = achievementsHTML;
}

// Update module progress display with proper ordering
async function updateModuleProgressDisplay() {
    try {
        // Get modules from database, sorted by display_order
        const { data: modules, error } = await supabase
            .from('training_modules')
            .select('id, module_code, module_name, display_order')
            .order('display_order', { ascending: true });
        
        if (error) throw error;
        
        if (modules && modules.length > 0) {
            // Use database modules (properly ordered)
            const moduleProgressHTML = modules.map(module => {
                const completed = progressData.completedModules.includes(module.module_code);
                const percentage = completed ? 100 : 0;
                return `
                    <div class="progress-item">
                        <div class="progress-item-header">
                            <span>${module.module_name}</span>
                            <span>${percentage}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
            document.getElementById('moduleProgress').innerHTML = moduleProgressHTML;
        } else {
            // Fallback to static moduleContent if database is unavailable
            const moduleProgressHTML = Object.keys(moduleContent).map(moduleId => {
                const completed = progressData.completedModules.includes(moduleId);
                const percentage = completed ? 100 : 0;
                return `
                    <div class="progress-item">
                        <div class="progress-item-header">
                            <span>${moduleContent[moduleId].title}</span>
                            <span>${percentage}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
            document.getElementById('moduleProgress').innerHTML = moduleProgressHTML;
        }
    } catch (error) {
        console.error('Error updating module progress display:', error);
        // Fallback to static content on error
        const moduleProgressHTML = Object.keys(moduleContent).map(moduleId => {
            const completed = progressData.completedModules.includes(moduleId);
            const percentage = completed ? 100 : 0;
            return `
                <div class="progress-item">
                    <div class="progress-item-header">
                        <span>${moduleContent[moduleId].title}</span>
                        <span>${percentage}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');
        document.getElementById('moduleProgress').innerHTML = moduleProgressHTML;
    }
}

// Review past assessment from history
function reviewPastAssessment(resultIndex) {
    console.log('reviewPastAssessment called with index:', resultIndex);
    console.log('Total results:', progressData.assessmentResults.length);
    
    const result = progressData.assessmentResults[resultIndex];
    console.log('Result:', result);
    
    if (!result) {
        alert('Assessment result not found.');
        return;
    }
    
    if (!result.questions || !result.userAnswers) {
        alert('Assessment data not available for review. This assessment was completed before the review feature was added.');
        return;
    }
    
    // Set up the review with the saved data
    currentAssessment = result.assessment;
    shuffledQuestions = result.questions;
    userAnswers = result.userAnswers;
    
    // Build review HTML (same as reviewAnswers but read-only)
    let incorrectCount = 0;
    shuffledQuestions.forEach((q, index) => {
        if (userAnswers[index] !== q.correct) {
            incorrectCount++;
        }
    });
    
    const assessmentTitles = {
        'communication-protocols': 'Module 1: Security Radio Communications Assessment',
        'stop-the-bleed': 'Module 2: STOP THE BLEED® Emergency Medical Response Assessment',
        'threat-assessment': 'Module 3: Threat Assessment & Situational Awareness Assessment',
        'ics-100': 'Module 4: Introduction to ICS-100 Assessment',
        'diverse-population': 'Module 5: Interacting with Diverse Populations Assessment',
        'crowd-management': 'Module 6: Crowd Management & Public Safety Assessment',
        'use-of-force': 'Module 7: Legal Aspects & Use of Force Assessment',
        'comprehensive': 'Comprehensive Guard Certification Exam'
    };
    
    let reviewHTML = `
        <div class="review-header">
            <h3>Assessment Review - ${assessmentTitles[result.assessment]}</h3>
            <p>Score: <strong>${result.score}%</strong> (${shuffledQuestions.length - incorrectCount} correct, ${incorrectCount} incorrect)</p>
            <p style="color: var(--text-secondary);">Completed: ${new Date(result.date).toLocaleString()}</p>
            <p><em>This is a past assessment review. You cannot change answers.</em></p>
        </div>
        <div class="review-content">
    `;
    
    // Show ALL questions
    shuffledQuestions.forEach((q, index) => {
        const userAnswerIndex = userAnswers[index];
        const isCorrect = userAnswerIndex === q.correct;
        const moduleRef = q.moduleReference || 'Review training materials';
        
        if (isCorrect) {
            const correctAnswerText = q.options[userAnswerIndex];
            reviewHTML += `
                <div class="review-question correct locked">
                    <div class="review-question-header">
                        <span class="question-number">Question ${index + 1}</span>
                        <span class="review-status correct">
                            <i class="fas fa-check-circle"></i>
                            Correct
                        </span>
                    </div>
                    <p class="review-question-text"><strong>${q.question}</strong></p>
                    <div class="locked-message">
                        <i class="fas fa-lock"></i> <strong>Your Answer:</strong> ${correctAnswerText}
                    </div>
                </div>
            `;
        } else {
            const userAnswerText = userAnswerIndex !== null ? q.options[userAnswerIndex] : 'No answer';
            const correctAnswerText = q.options[q.correct];
            reviewHTML += `
                <div class="review-question incorrect">
                    <div class="review-question-header">
                        <span class="question-number">Question ${index + 1}</span>
                        <span class="review-status incorrect">
                            <i class="fas fa-times-circle"></i>
                            Incorrect
                        </span>
                    </div>
                    <p class="review-question-text"><strong>${q.question}</strong></p>
                    <div class="review-answer-section">
                        <p class="your-answer"><strong>Your Answer:</strong> ${userAnswerText}</p>
                        <p class="correct-answer"><strong>Correct Answer:</strong> ${correctAnswerText}</p>
                        <p class="module-reference"><strong>📚 Study Reference:</strong> ${moduleRef}</p>
                    </div>
                </div>
            `;
        }
    });
    
    reviewHTML += `
        </div>
        <div class="review-actions">
            <button class="btn btn-primary" onclick="closePastReview()">Close Review</button>
        </div>
    `;
    
    // Show in a modal or overlay
    console.log('Showing review modal...');
    
    // Hide progress section, show assessment section
    document.getElementById('progress').classList.remove('active');
    document.getElementById('assessment').classList.add('active');
    
    // Update nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        const onclick = link.getAttribute('onclick');
        if (onclick && onclick.includes('assessment')) {
            link.classList.add('active');
        }
    });
    
    // Hide assessment selector, show quiz
    document.querySelector('.assessment-selector').style.display = 'none';
    document.getElementById('assessmentResults').classList.add('hidden');
    document.getElementById('assessmentQuiz').classList.remove('hidden');
    
    // Hide quiz header and footer, show review content
    const quizHeader = document.querySelector('.quiz-header');
    const quizFooter = document.querySelector('.quiz-footer');
    const quizBody = document.querySelector('.quiz-body');
    
    if (quizHeader) quizHeader.style.display = 'none';
    if (quizFooter) quizFooter.style.display = 'none';
    if (quizBody) quizBody.innerHTML = reviewHTML;
    
    console.log('Review modal displayed');
    
    // Scroll to top
    window.scrollTo(0, 0);
}

function closePastReview() {
    // Hide quiz, restore header/footer
    document.getElementById('assessmentQuiz').classList.add('hidden');
    const quizHeader = document.querySelector('.quiz-header');
    const quizFooter = document.querySelector('.quiz-footer');
    if (quizHeader) quizHeader.style.display = '';
    if (quizFooter) quizFooter.style.display = '';
    
    // Show assessment selector
    document.querySelector('.assessment-selector').style.display = 'block';
    
    // Navigate back to progress
    document.getElementById('assessment').classList.remove('active');
    document.getElementById('progress').classList.add('active');
    
    // Update nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        const onclick = link.getAttribute('onclick');
        if (onclick && onclick.includes('progress')) {
            link.classList.add('active');
        }
    });
    
    currentAssessment = null;
    
    // Scroll to top
    window.scrollTo(0, 0);
}
