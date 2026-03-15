// State Selection for Module 0 and Module 7
// These modules require state-specific content

// Store selected state and module
let selectedState = null;
let pendingModuleId = null;

// Show state selection modal before starting state-specific modules
async function showStateSelectionModal(moduleId = 'use-of-force') {
    pendingModuleId = moduleId;
    // Load state laws from database first
    await ensureStateLawsLoaded();
    
    const modal = document.createElement('div');
    modal.id = 'state-selection-modal';
    modal.className = 'modal';
    modal.style.display = 'block';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2><i class="fas fa-map-marked-alt"></i> Select Your State</h2>
                <p style="margin-top: 0.5rem; opacity: 0.9;">This module content is state-specific. Please select your state to continue.</p>
            </div>
            <div class="modal-body">
                <div class="state-selection-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem; max-height: 400px; overflow-y: auto; padding: 1rem;">
                    ${generateStateButtons()}
                </div>
                <div style="margin-top: 1.5rem; padding: 1rem; background: #f0f0f0; border-radius: 0.5rem;">
                    <p style="margin: 0; font-size: 0.9rem; color: #666;">
                        <i class="fas fa-info-circle"></i> <strong>Note:</strong> This module will cover use of force laws, licensing requirements, and legal responsibilities specific to your selected state.
                    </p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Load state laws from database if not already loaded
async function ensureStateLawsLoaded() {
    if (!window.stateLaws || Object.keys(window.stateLaws).length === 0) {
        if (window.loadStateLaws) {
            await window.loadStateLaws();
        }
    }
}

// Generate state selection buttons
function generateStateButtons() {
    // Ensure stateLaws is available (fallback to empty object if not)
    const laws = window.stateLaws || {};
    const states = Object.keys(laws).sort((a, b) => 
        laws[a].name.localeCompare(laws[b].name)
    );
    
    return states.map(stateCode => `
        <button class="state-button" onclick="selectState('${stateCode}')" style="
            padding: 1rem;
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: all 0.3s ease;
        " onmouseover="this.style.borderColor='var(--secondary-color)'; this.style.transform='translateY(-2px)'" 
           onmouseout="this.style.borderColor='#e0e0e0'; this.style.transform='translateY(0)'">
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${getStateFlag(stateCode)}</div>
            <div>${laws[stateCode].name}</div>
            <div style="font-size: 0.75rem; color: #666; margin-top: 0.25rem;">${stateCode}</div>
        </button>
    `).join('');
}

// Get state flag emoji (simplified)
function getStateFlag(stateCode) {
    return '🏛️'; // Generic icon for all states
}

// Handle state selection
async function selectState(stateCode) {
    try {
        console.log('State selected:', stateCode);
        selectedState = stateCode;
        
        // Store selection in localStorage
        localStorage.setItem('selectedState', stateCode);
        console.log('Stored state in localStorage');
        
        // Close modal
        const modal = document.getElementById('state-selection-modal');
        if (modal) {
            modal.remove();
            console.log('Modal closed');
        }
        
        // Start the module with state-specific content
        const moduleToStart = pendingModuleId || 'use-of-force';
        console.log('Starting module with state:', stateCode, 'Module:', moduleToStart);
        await startModuleWithState(moduleToStart, stateCode);
        console.log('Module started successfully');
    } catch (error) {
        console.error('Error in selectState:', error);
        alert('Error loading module. Please try again.');
    }
}

// Start module with state-specific content
async function startModuleWithState(moduleId, stateCode) {
    try {
        console.log('startModuleWithState called with:', moduleId, stateCode);
        
        // Ensure state laws are loaded from database
        console.log('Ensuring state laws loaded...');
        await ensureStateLawsLoaded();
        console.log('State laws loaded, count:', Object.keys(window.stateLaws || {}).length);
        
        const stateInfo = window.stateLaws[stateCode];
        
        if (!stateInfo) {
            console.error('State info not found for:', stateCode);
            console.log('Available states:', Object.keys(window.stateLaws || {}));
            alert('Error loading state information. Please try again.');
            return;
        }
        
        console.log('State info found:', stateInfo.name);
        
        // Generate state-specific slides based on module
        console.log('Generating state-specific slides...');
        let stateSlides;
        
        if (moduleId === 'welcome-materials') {
            // Generate welcome module content
            if (window.generateWelcomeModuleContent) {
                stateSlides = window.generateWelcomeModuleContent(stateCode);
            } else {
                console.error('generateWelcomeModuleContent not found');
                return;
            }
        } else if (moduleId === 'use-of-force') {
            // Generate use of force content
            stateSlides = generateStateSpecificSlides(stateInfo, stateCode);
        }
        
        console.log('Generated', stateSlides.length, 'slides');
        
        // Replace the module slides with state-specific ones
        if (window.moduleSlidesData) {
            window.moduleSlidesData[moduleId] = stateSlides;
            console.log('Updated moduleSlidesData with state-specific slides for', moduleId);
        } else {
            console.error('moduleSlidesData not found. Make sure slideshow.js is loaded.');
            return;
        }
        
        // Start the slideshow - directly access the saved original or call from slideshow.js
        console.log('Attempting to start slideshow...');
        if (originalStartModuleFromSlideshow) {
            console.log('Using originalStartModuleFromSlideshow');
            await originalStartModuleFromSlideshow(moduleId, true); // Pass true to skip state check
        } else if (window.startModule) {
            console.log('Using window.startModule');
            await window.startModule(moduleId, true); // Pass true to skip state check
        } else {
            console.error('startModule function not available. Trying direct initialization...');
            // Fallback: manually initialize slideshow
            if (window.moduleSlidesData) {
                window.currentModuleId = moduleId;
                window.currentModuleSlides = window.moduleSlidesData[moduleId];
                window.currentSlideIndex = 0;
                if (window.showSlide && typeof window.showSlide === 'function') {
                    window.showSlide(0);
                }
                // Show the modal
                const modal = document.getElementById('moduleModal');
                if (modal) {
                    modal.classList.add('active');
                }
            }
        }
        console.log('Slideshow started');
    } catch (error) {
        console.error('Error in startModuleWithState:', error);
        alert('Error starting module: ' + error.message);
    }
}

// Generate state-specific slides based on Maryland template
function generateStateSpecificSlides(stateInfo, stateCode) {
    return [
        // Slide 1: Introduction
        {
            title: 'Legal Aspects & Use of Force',
            content: `
                <h3>Legal Aspects & Use of Force</h3>
                <p class="hero-subtitle">${stateInfo.name} State Compliance</p>
                <div class="slide-callout">
                    <h4><i class="fas fa-balance-scale"></i> Module Overview</h4>
                    <p>Every action as a security guard must comply with ${stateInfo.name} state law. What you don't know CAN land you in court.</p>
                    <p><strong>Duration:</strong> 1.5 Hours | <strong>Slides:</strong> 15</p>
                </div>
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Critical Importance</h4>
                    <p>This is both a protection and accountability module. Know the rules, avoid the courtroom.</p>
                </div>
            `
        },
        // Slide 2: Objectives
        {
            title: 'Module Objectives',
            content: `
                <h3>What You'll Learn</h3>
                <ul>
                    <li><strong>Understand ${stateInfo.name} law governing security officers</strong></li>
                    <li><strong>Define use of force and legal limits</strong></li>
                    <li><strong>Recognize civil liability and legal responsibilities</strong></li>
                    <li><strong>Learn proper documentation and reporting practices</strong></li>
                </ul>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> Key Message</h4>
                    <p><strong>"Know the rules, avoid the courtroom."</strong> This module protects you legally and professionally.</p>
                </div>
            `
        },
        // Slide 3: State Law Overview
        {
            title: `${stateInfo.name} Security Guard Laws`,
            content: `
                <h3>${stateInfo.name} Law Governing Security Guards</h3>
                <h4>Licensing Requirements:</h4>
                <p><strong>${stateInfo.licensing}</strong></p>
                
                <h4>Training Requirements:</h4>
                <p><strong>${stateInfo.trainingHours}</strong></p>
                
                <h4>Minimum Age:</h4>
                <p><strong>${stateInfo.minAge}</strong></p>
                
                <div class="slide-callout">
                    <h4><i class="fas fa-building"></i> Regulatory Agency</h4>
                    <p><strong>${stateInfo.agency}</strong></p>
                </div>
                
                ${stateInfo.notes ? `
                <div class="slide-callout">
                    <h4><i class="fas fa-info-circle"></i> Important Notes</h4>
                    <p>${stateInfo.notes}</p>
                </div>
                ` : ''}
            `
        },
        // Slide 4: Use of Force Laws
        {
            title: 'Use of Force - State Law',
            content: `
                <h3>${stateInfo.name} Use of Force Laws</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-gavel"></i> State-Specific Rules</h4>
                    <p><strong>${stateInfo.useOfForce}</strong></p>
                </div>
                
                <h4>Key Principles:</h4>
                <ul>
                    <li><strong>Proportionate:</strong> Force must match the threat level</li>
                    <li><strong>Necessary:</strong> Only when required for safety</li>
                    <li><strong>Reasonable:</strong> What would a reasonable person do?</li>
                </ul>
                
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Critical Reminder</h4>
                    <p><strong>"You are NOT police."</strong> You have the same legal authority as any private citizen in ${stateInfo.name}.</p>
                </div>
            `
        },
        // Slide 5: Citizen's Arrest
        {
            title: "Citizen's Arrest Authority",
            content: `
                <h3>Citizen's Arrest in ${stateInfo.name}</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-handcuffs"></i> ${stateInfo.name} Law</h4>
                    <p><strong>${stateInfo.citizensArrest}</strong></p>
                </div>
                
                <h4>When You CAN Make a Citizen's Arrest:</h4>
                <ul>
                    <li>Felony committed in your presence</li>
                    <li>Breach of peace occurring in your presence</li>
                    <li>You have reasonable belief a felony was committed</li>
                </ul>
                
                <h4>What You MUST Do:</h4>
                <ul>
                    <li><strong>Immediately</strong> notify law enforcement</li>
                    <li><strong>Use minimum force</strong> necessary</li>
                    <li><strong>Document everything</strong> that occurred</li>
                </ul>
                
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-circle"></i> Warning</h4>
                    <p>Improper citizen's arrest can result in false imprisonment charges against YOU.</p>
                </div>
            `
        },
        // Slide 6: Weapons Laws
        {
            title: 'Weapons and Armed Security',
            content: `
                <h3>${stateInfo.name} Weapons Laws for Security</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-shield-alt"></i> ${stateInfo.name} Requirements</h4>
                    <p><strong>${stateInfo.weapons}</strong></p>
                </div>
                
                <h4>For Unarmed Security Guards:</h4>
                <ul>
                    <li><strong>NO firearms</strong> unless specially licensed</li>
                    <li><strong>NO batons or impact weapons</strong> without certification</li>
                    <li><strong>NO chemical sprays</strong> (varies by employer policy)</li>
                </ul>
                
                <div class="slide-callout">
                    <h4><i class="fas fa-exclamation-triangle"></i> Legal Liability</h4>
                    <p>Carrying unauthorized weapons can result in criminal charges and immediate license revocation.</p>
                </div>
            `
        },
        // Slide 7: Use of Force Continuum
        {
            title: 'Use of Force Continuum',
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
                    <li><strong>NO strikes or punches</strong></li>
                    <li><strong>NO chokeholds or restraints</strong></li>
                    <li><strong>NO pursuit beyond property</strong></li>
                </ul>
                
                <div class="slide-callout">
                    <h4><i class="fas fa-hands-helping"></i> De-Escalation First</h4>
                    <p>Your primary tool is communication. Force is always the last resort.</p>
                </div>
            `
        },
        // Slide 8: Self-Defense
        {
            title: 'Self-Defense and Defense of Others',
            content: `
                <h3>When Can You Use Force?</h3>
                <h4>Self-Defense (${stateInfo.name} Law):</h4>
                <ul>
                    <li><strong>Imminent threat</strong> to yourself or others</li>
                    <li><strong>Reasonable belief</strong> force is necessary</li>
                    <li><strong>Proportionate response</strong> to the threat</li>
                </ul>
                
                <h4>Defense of Property:</h4>
                <ul>
                    <li><strong>Limited authority</strong> - you're protecting the client's property</li>
                    <li><strong>Observe and report</strong> is usually the best approach</li>
                    <li><strong>Force only if</strong> there's immediate danger to people</li>
                </ul>
                
                <div class="slide-callout">
                    <h4><i class="fas fa-running"></i> Duty to Retreat</h4>
                    <p>${stateInfo.useOfForce.includes('retreat') ? 'In ' + stateInfo.name + ', you have a duty to retreat if you can safely do so.' : stateInfo.name + ' has stand your ground provisions, but retreat is still the safest option.'}</p>
                </div>
            `
        },
        // Slide 9: Civil Liability
        {
            title: 'Civil Liability and Lawsuits',
            content: `
                <h3>Understanding Civil Liability</h3>
                <h4>You Can Be Sued For:</h4>
                <ul>
                    <li><strong>Excessive force</strong> or assault</li>
                    <li><strong>False imprisonment</strong> (illegal detention)</li>
                    <li><strong>Negligence</strong> in performing duties</li>
                    <li><strong>Discrimination</strong> or civil rights violations</li>
                </ul>
                
                <h4>Protection Strategies:</h4>
                <ul>
                    <li><strong>Follow policy</strong> and training exactly</li>
                    <li><strong>Document everything</strong> in detail</li>
                    <li><strong>Get witness statements</strong> when possible</li>
                    <li><strong>Report immediately</strong> to supervisors</li>
                </ul>
                
                <div class="slide-callout">
                    <h4><i class="fas fa-file-contract"></i> Employer Liability</h4>
                    <p>Your employer can also be sued for your actions. Follow procedures to protect both of you.</p>
                </div>
            `
        },
        // Slide 10: Documentation
        {
            title: 'Documentation and Reporting',
            content: `
                <h3>Critical Importance of Documentation</h3>
                <h4>What to Document:</h4>
                <ul>
                    <li><strong>Date, time, location</strong> of incident</li>
                    <li><strong>All parties involved</strong> (names, descriptions)</li>
                    <li><strong>Witnesses</strong> and their contact information</li>
                    <li><strong>Exact sequence of events</strong></li>
                    <li><strong>Your actions and why</strong> you took them</li>
                    <li><strong>Injuries or property damage</strong></li>
                </ul>
                
                <div class="slide-callout">
                    <h4><i class="fas fa-pen"></i> Golden Rule</h4>
                    <p><strong>"If it's not documented, it didn't happen."</strong></p>
                </div>
                
                <h4>Reporting Timeline:</h4>
                <ul>
                    <li><strong>Immediate:</strong> Notify supervisor of any use of force</li>
                    <li><strong>Same shift:</strong> Complete incident report</li>
                    <li><strong>24 hours:</strong> Follow up with detailed statement</li>
                </ul>
            `
        },
        // Slide 11: Scenario 1
        {
            title: 'Scenario: Shoplifter',
            content: `
                <h3>Real-World Scenario</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-shopping-bag"></i> The Situation</h4>
                    <p>You observe someone concealing merchandise and heading for the exit. They see you and start running.</p>
                </div>
                
                <h4>What Should You Do?</h4>
                <ol>
                    <li><strong>Observe and report</strong> - Get description</li>
                    <li><strong>Do NOT chase</strong> off property</li>
                    <li><strong>Call police</strong> immediately</li>
                    <li><strong>Preserve evidence</strong> (video footage)</li>
                    <li><strong>Document everything</strong></li>
                </ol>
                
                <h4>What NOT to Do:</h4>
                <ul>
                    <li>❌ Chase into parking lot or street</li>
                    <li>❌ Physically tackle or restrain</li>
                    <li>❌ Assume you can make citizen's arrest</li>
                </ul>
                
                <div class="slide-callout">
                    <h4><i class="fas fa-lightbulb"></i> Remember</h4>
                    <p>Property can be replaced. Your safety and legal protection cannot.</p>
                </div>
            `
        },
        // Slide 12: Scenario 2
        {
            title: 'Scenario: Aggressive Individual',
            content: `
                <h3>Real-World Scenario</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-user-angry"></i> The Situation</h4>
                    <p>An intoxicated person becomes verbally aggressive and starts moving toward you with clenched fists.</p>
                </div>
                
                <h4>Proper Response:</h4>
                <ol>
                    <li><strong>Create distance</strong> - Step back</li>
                    <li><strong>Use verbal de-escalation</strong> - Calm voice</li>
                    <li><strong>Call for backup</strong> - Radio/phone</li>
                    <li><strong>Position yourself</strong> - Near exit, hands visible</li>
                    <li><strong>Retreat if possible</strong> - Safety first</li>
                </ol>
                
                <h4>If Physical Contact Occurs:</h4>
                <ul>
                    <li><strong>Defend yourself</strong> with minimum necessary force</li>
                    <li><strong>Disengage</strong> as soon as safe</li>
                    <li><strong>Call police</strong> immediately</li>
                    <li><strong>Document</strong> injuries and witnesses</li>
                </ul>
            `
        },
        // Slide 13: Professional Conduct
        {
            title: 'Professional Conduct Standards',
            content: `
                <h3>Maintaining Professional Standards</h3>
                <h4>Always:</h4>
                <ul>
                    <li><strong>Remain calm and professional</strong></li>
                    <li><strong>Treat everyone with respect</strong></li>
                    <li><strong>Follow company policies</strong></li>
                    <li><strong>Know your legal limits</strong></li>
                    <li><strong>Document thoroughly</strong></li>
                </ul>
                
                <h4>Never:</h4>
                <ul>
                    <li>❌ Use excessive force</li>
                    <li>❌ Act outside your authority</li>
                    <li>❌ Discriminate or profile</li>
                    <li>❌ Pursue beyond property</li>
                    <li>❌ Fail to report incidents</li>
                </ul>
                
                <div class="slide-callout">
                    <h4><i class="fas fa-star"></i> Your Reputation</h4>
                    <p>Every interaction reflects on you, your employer, and the entire security profession.</p>
                </div>
            `
        },
        // Slide 14: Legal Resources
        {
            title: `${stateInfo.name} Legal Resources`,
            content: `
                <h3>Know Where to Get Help</h3>
                <h4>Regulatory Agency:</h4>
                <p><strong>${stateInfo.agency}</strong></p>
                
                <h4>When to Consult:</h4>
                <ul>
                    <li><strong>Licensing questions</strong></li>
                    <li><strong>Scope of authority</strong> clarification</li>
                    <li><strong>Complaint procedures</strong></li>
                    <li><strong>Continuing education</strong> requirements</li>
                </ul>
                
                <h4>Additional Resources:</h4>
                <ul>
                    <li><strong>Your employer's legal team</strong></li>
                    <li><strong>Professional security associations</strong></li>
                    <li><strong>State law enforcement agencies</strong></li>
                </ul>
                
                <div class="slide-callout">
                    <h4><i class="fas fa-phone"></i> Emergency Contacts</h4>
                    <p>Keep emergency numbers readily available: Police, Supervisor, Company Legal</p>
                </div>
            `
        },
        // Slide 15: Module Summary
        {
            title: 'Module Summary',
            content: `
                <h3>Key Takeaways - ${stateInfo.name}</h3>
                <div class="slide-callout">
                    <h4><i class="fas fa-check-circle"></i> Remember These Critical Points:</h4>
                    <ul>
                        <li><strong>You are NOT police</strong> - Same authority as any citizen</li>
                        <li><strong>Force is last resort</strong> - De-escalation first</li>
                        <li><strong>Document everything</strong> - Protect yourself legally</li>
                        <li><strong>Know ${stateInfo.name} law</strong> - Ignorance is not a defense</li>
                        <li><strong>Professional conduct always</strong> - Your reputation matters</li>
                    </ul>
                </div>
                
                <div class="slide-callout">
                    <h4><i class="fas fa-graduation-cap"></i> Next Steps</h4>
                    <p>Complete the Module 7 assessment to test your knowledge of ${stateInfo.name} security guard laws and use of force principles.</p>
                </div>
                
                <p style="text-align: center; margin-top: 2rem; font-size: 1.2rem; font-weight: 600; color: var(--secondary-color);">
                    "Know the rules, avoid the courtroom."
                </p>
            `
        }
    ];
}

// Store reference to original startModule from slideshow.js
let originalStartModuleFromSlideshow = null;

// Override startModule - run immediately, not waiting for DOMContentLoaded
(function() {
    // Check repeatedly until startModule is available
    let attempts = 0;
    const maxAttempts = 20;
    
    const checkAndOverride = setInterval(() => {
        attempts++;
        
        if (window.startModule && typeof window.startModule === 'function') {
            // Save the original function
            originalStartModuleFromSlideshow = window.startModule;
            console.log('Original startModule saved:', typeof originalStartModuleFromSlideshow);
            
            // Override with our custom logic
            window.startModule = function(moduleId) {
                console.log('startModule called with:', moduleId);
                
                if (moduleId === 'use-of-force') {
                    console.log('Module 7 detected - checking for state selection');
                    // Always show state selection modal (user can change their state)
                    console.log('Showing state selection modal');
                    showStateSelectionModal();
                } else {
                    console.log('Other module - calling original function');
                    // Call original function for other modules
                    if (originalStartModuleFromSlideshow) {
                        originalStartModuleFromSlideshow(moduleId);
                    }
                }
            };
            
            console.log('✅ Module 7 state selection initialized successfully');
            clearInterval(checkAndOverride);
        } else if (attempts >= maxAttempts) {
            console.error('❌ Failed to find startModule function after', maxAttempts, 'attempts');
            clearInterval(checkAndOverride);
        }
    }, 100);
})();

// Generate state-specific assessment questions
function generateStateSpecificAssessment(stateInfo, stateCode) {
    return [
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
        },
        {
            question: 'What is the legal status of a security guard?',
            options: [
                'A law enforcement officer with arrest powers',
                'A private citizen with the same authority as any citizen',
                'A government official with special legal authority',
                'An agent of the police department'
            ],
            correct: 1
        },
        {
            question: 'The use of force continuum starts with which level?',
            options: [
                'Verbal commands',
                'Officer presence in uniform',
                'Physical control',
                'Defensive tactics'
            ],
            correct: 1
        },
        {
            question: 'When is a security guard legally allowed to use physical force?',
            options: [
                'To enforce company rules',
                'Only for self-defense or defense of others from imminent harm',
                'Whenever someone refuses commands',
                'To detain suspects'
            ],
            correct: 1
        },
        {
            question: 'What does "reasonable force" mean?',
            options: [
                'Any force necessary to gain compliance',
                'Force that is proportional to the threat',
                'Maximum force allowed by policy',
                'Force approved by supervisor'
            ],
            correct: 1
        },
        {
            question: 'What should you do if someone refuses to leave the property?',
            options: [
                'Physically escort them off immediately',
                'Call police and let them handle it',
                'Use force to drag them out',
                'Threaten them with arrest'
            ],
            correct: 1
        },
        {
            question: 'What is the main risk of attempting a citizen\'s arrest?',
            options: [
                'Complaint with management',
                'High liability for false arrest and assault lawsuits',
                'Temporary license suspension',
                'Extensive paperwork'
            ],
            correct: 1
        },
        {
            question: 'If you use excessive force, you could face:',
            options: [
                'A written warning',
                'Criminal charges, civil lawsuits, and license revocation',
                'Mandatory retraining',
                'Suspension without pay'
            ],
            correct: 1
        },
        {
            question: 'What is the most important thing to do after any use of force incident?',
            options: [
                'Leave the scene immediately',
                'Document everything and notify supervisor',
                'Discuss with coworkers first',
                'Wait 24 hours before reporting'
            ],
            correct: 1
        }
    ];
}

// Override assessment loading for use-of-force
const originalAssessmentQuestions = window.assessmentQuestions;

// Store state-specific questions
window.getStateSpecificQuestions = function(assessmentId) {
    if (assessmentId === 'use-of-force') {
        const selectedState = localStorage.getItem('selectedState');
        if (selectedState && stateLaws[selectedState]) {
            const stateInfo = stateLaws[selectedState];
            return generateStateSpecificAssessment(stateInfo, selectedState);
        }
    }
    return null; // Use default questions
};

// Export functions
window.showStateSelectionModal = showStateSelectionModal;
window.selectState = selectState;
window.startModuleWithState = startModuleWithState;
window.generateStateSpecificAssessment = generateStateSpecificAssessment;
