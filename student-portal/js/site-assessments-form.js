/**
 * Site Assessments Tool - Part 2: Form Structure & Rendering
 */

// Form sections configuration
SiteAssessments.formSections = [
    {
        id: 'clientInfo',
        title: 'Client Information',
        icon: 'fa-building',
        tutorial: 'Start by gathering basic information about the facility you\'re assessing.',
        fields: [
            { name: 'clientName', label: 'Client/Facility Name', type: 'text', required: true, placeholder: 'e.g., Antioch Christian Academy' },
            { name: 'facilityType', label: 'Facility Type', type: 'select', required: true, options: ['School', 'Office Building', 'Venue/Event Space', 'Religious Facility', 'Healthcare', 'Retail', 'Single-family Home', 'Multi-family Complex', 'Other'] },
            { name: 'address', label: 'Address', type: 'text', placeholder: 'Street Address' },
            { name: 'city', label: 'City', type: 'text', required: true },
            { name: 'state', label: 'State', type: 'text', required: true },
            { name: 'assessmentDate', label: 'Assessment Date', type: 'date', required: true },
            { name: 'assessorName', label: 'Assessor Name', type: 'text', required: true },
            { name: 'assessorTitle', label: 'Assessor Title', type: 'text', placeholder: 'e.g., Security Consultant' },
            { name: 'analyzeButton', label: '', type: 'button', buttonText: 'Analyze Location Risk', buttonIcon: 'fa-map-marked-alt', buttonClass: 'btn-analyze-risk', onClick: 'SiteAssessments.analyzeLocationRisk()' }
        ]
    },
    {
        id: 'physicalSecurity',
        title: 'Physical Security Assessment',
        icon: 'fa-shield-alt',
        tutorial: 'Evaluate physical barriers and hardening measures. Strong physical security creates layers of defense.',
        fields: [
            { name: 'doorType', label: 'Primary Door Construction', type: 'select', options: ['Solid-core/Metal', 'Hollow-core', 'Glass', 'Mixed', 'Unknown'], tutorial: 'Hollow-core and glass doors provide minimal protection.', riskFactor: true },
            { name: 'doorVisibility', label: 'Door Window Visibility', type: 'select', options: ['No windows', 'High windows only', 'Windows at handle height', 'Full glass'], tutorial: 'Windows at handle height allow intruders to see locking mechanisms.', riskFactor: true },
            { name: 'interiorLocks', label: 'Interior Locking Capability', type: 'select', options: ['Yes - all rooms', 'Partial coverage', 'No interior locks', 'Unknown'], tutorial: 'Interior locks allow occupants to secure themselves during emergencies.', riskFactor: true },
            { name: 'perimeterBarriers', label: 'Perimeter Barriers', type: 'select', options: ['Comprehensive fencing/barriers', 'Partial barriers', 'Minimal barriers', 'None'], tutorial: 'Perimeter barriers create the first layer of defense.', riskFactor: true },
            { name: 'physicalNotes', label: 'Additional Observations', type: 'textarea', placeholder: 'Document specific vulnerabilities, strengths, or unique conditions...' }
        ]
    },
    {
        id: 'accessControl',
        title: 'Access Control & Entry Management',
        icon: 'fa-door-open',
        tutorial: 'Access control determines who can enter and when. Effective control prevents unauthorized entry.',
        fields: [
            { name: 'entryPoints', label: 'Number of Entry Points', type: 'number', tutorial: 'More entry points increase resource requirements.', riskFactor: true },
            { name: 'controlledEntries', label: 'Controlled Entry Points', type: 'number', tutorial: 'Compare to total entries. Uncontrolled entries are vulnerabilities.', riskFactor: true },
            { name: 'visitorManagement', label: 'Visitor Management System', type: 'select', options: ['Digital system with ID verification', 'Manual sign-in with monitoring', 'Sign-in only', 'None'], tutorial: 'Visitor management creates accountability.', riskFactor: true },
            { name: 'accessControlTech', label: 'Access Control Technology', type: 'select', options: ['Electronic access control (cards/fobs)', 'Keypad/code entry', 'Traditional keys only', 'None'], tutorial: 'Electronic systems provide better control and audit trails.', riskFactor: true },
            { name: 'afterHoursAccess', label: 'After-Hours Access Control', type: 'select', options: ['Fully controlled and monitored', 'Partially controlled', 'Minimal control', 'Open access'], tutorial: 'After-hours is when facilities are most vulnerable.', riskFactor: true },
            { name: 'accessNotes', label: 'Additional Observations', type: 'textarea', placeholder: 'Document access control procedures, gaps, or concerns...' }
        ]
    },
    {
        id: 'surveillance',
        title: 'Surveillance & Monitoring',
        icon: 'fa-video',
        tutorial: 'Surveillance provides deterrence, detection, and evidence. Effective coverage requires strategic placement.',
        fields: [
            { name: 'cameraCount', label: 'Number of Cameras', type: 'number' },
            { name: 'cameraCoverage', label: 'Camera Coverage Assessment', type: 'select', options: ['Comprehensive - all critical areas', 'Good - most areas covered', 'Partial - significant gaps', 'Minimal - limited coverage', 'None'], tutorial: 'Critical areas include all entry points, parking, hallways.', riskFactor: true },
            { name: 'cameraQuality', label: 'Camera Quality/Resolution', type: 'select', options: ['High-definition (1080p+)', 'Standard definition', 'Low quality', 'Mixed quality', 'Unknown'] },
            { name: 'recordingRetention', label: 'Recording Retention Period', type: 'select', options: ['30+ days', '14-30 days', '7-14 days', 'Less than 7 days', 'No recording', 'Unknown'] },
            { name: 'liveMonitoring', label: 'Live Monitoring Capability', type: 'select', options: ['24/7 dedicated monitoring', 'Business hours monitoring', 'Occasional monitoring', 'Recording only - no monitoring'], tutorial: 'Live monitoring enables real-time response.', riskFactor: true },
            { name: 'surveillanceNotes', label: 'Additional Observations', type: 'textarea', placeholder: 'Note blind spots, camera placement issues...' }
        ]
    },
    {
        id: 'emergencyManagement',
        title: 'Emergency Management & Communication',
        icon: 'fa-exclamation-triangle',
        tutorial: 'Emergency management systems save lives. Effective communication is critical during crisis situations.',
        fields: [
            { name: 'alarmSystem', label: 'Emergency Alarm System', type: 'select', options: ['Intercom-based with full coverage', 'PA system with full coverage', 'Limited alarm system', 'Fire alarm only', 'None'], tutorial: 'Intercom/PA systems allow specific instructions during emergencies.', riskFactor: true },
            { name: 'alarmAudibility', label: 'Alarm Audibility Coverage', type: 'select', options: ['100% coverage verified', 'Most areas covered', 'Inconsistent coverage', 'Poor coverage', 'Unknown'], tutorial: 'Test alarms in all areas.', riskFactor: true },
            { name: 'communicationSystems', label: 'Communication Systems', type: 'multiselect', options: ['Intercom/PA', 'Two-way radios', 'Digital alert system', 'Phone system', 'Cell phones only'], tutorial: 'Redundant systems ensure communication if primary fails.', riskFactor: true },
            { name: 'emergencyPlans', label: 'Emergency Response Plans', type: 'select', options: ['Comprehensive written plans with regular updates', 'Written plans - not regularly updated', 'Informal plans only', 'No formal plans'], tutorial: 'Written plans provide consistency.', riskFactor: true },
            { name: 'drillFrequency', label: 'Emergency Drill Frequency', type: 'select', options: ['Monthly or more', 'Quarterly', 'Annually', 'Rarely', 'Never'], tutorial: 'Regular drills build muscle memory.', riskFactor: true },
            { name: 'emergencyNotes', label: 'Additional Observations', type: 'textarea', placeholder: 'Document emergency procedures, drill observations...' }
        ]
    },
    {
        id: 'training',
        title: 'Training & Organizational Culture',
        icon: 'fa-users',
        tutorial: 'Technology is only effective when people know how to use it. Training creates security-aware culture.',
        fields: [
            { name: 'crisisTeam', label: 'Crisis Response Team', type: 'select', options: ['Formalized team with defined roles', 'Informal team', 'Ad-hoc response only', 'None'], tutorial: 'Crisis teams coordinate response.', riskFactor: true },
            { name: 'staffTraining', label: 'Staff Security Training', type: 'select', options: ['Comprehensive annual training', 'Initial training only', 'Minimal training', 'None'], tutorial: 'Annual training ensures staff maintain awareness.', riskFactor: true },
            { name: 'newStaffOrientation', label: 'New Staff Security Orientation', type: 'select', options: ['Comprehensive security orientation', 'Basic orientation', 'Informal orientation', 'None'], tutorial: 'New staff are vulnerabilities until properly oriented.', riskFactor: true },
            { name: 'securityCulture', label: 'Overall Security Culture', type: 'select', options: ['Strong - security is priority', 'Good - security is valued', 'Fair - security is acknowledged', 'Weak - security is afterthought'], tutorial: 'Culture determines whether measures are followed.', riskFactor: true },
            { name: 'trainingNotes', label: 'Additional Observations', type: 'textarea', placeholder: 'Document training programs, staff awareness...' }
        ]
    },
    {
        id: 'riskAssessment',
        title: 'Risk Assessment & Scoring',
        icon: 'fa-chart-line',
        tutorial: 'Risk assessment combines likelihood, impact, vulnerability, and resilience to prioritize investments.',
        fields: [
            { name: 'threatLikelihood', label: 'Threat Likelihood', type: 'select', options: ['Rare', 'Unlikely', 'Possible', 'Likely', 'Certain'], tutorial: 'Consider historical incidents and local crime data.', riskFactor: true },
            { name: 'potentialImpact', label: 'Potential Impact', type: 'select', options: ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'], tutorial: 'Impact considers life safety, property, operations, reputation.', riskFactor: true },
            { name: 'overallVulnerability', label: 'Overall Vulnerability Level', type: 'select', options: ['Minimal', 'Low', 'Moderate', 'High', 'Critical'], tutorial: 'Vulnerability is determined by gaps in security.', riskFactor: true },
            { name: 'resilienceLevel', label: 'Organizational Resilience', type: 'select', options: ['Excellent', 'Good', 'Fair', 'Poor', 'None'], tutorial: 'Resilience is ability to respond and recover.', riskFactor: true }
        ]
    }
];

// Form rendering function
SiteAssessments.renderForm = function() {
    const formContainer = document.getElementById('assessmentForm');
    if (!formContainer) return;

    let html = '';
    
    this.formSections.forEach(section => {
        html += `
            <div class="assessment-section" id="section-${section.id}">
                <div class="section-header-assessment">
                    <h3><i class="fas ${section.icon}"></i> ${section.title}</h3>
                    ${this.tutorialMode ? `<div class="tutorial-tip"><i class="fas fa-lightbulb"></i> ${section.tutorial}</div>` : ''}
                </div>
                <div class="section-fields">
                    ${this.renderFields(section.fields)}
                </div>
            </div>
        `;
    });

    formContainer.innerHTML = html;
    this.attachEventListeners();
};

SiteAssessments.renderFields = function(fields) {
    return fields.map(field => {
        const tutorialHtml = this.tutorialMode && field.tutorial 
            ? `<div class="field-tutorial"><i class="fas fa-info-circle"></i> ${field.tutorial}</div>` 
            : '';

        let inputHtml = '';

        switch(field.type) {
            case 'text':
            case 'date':
            case 'number':
                inputHtml = `<input type="${field.type}" 
                    id="${field.name}" 
                    name="${field.name}" 
                    ${field.required ? 'required' : ''}
                    ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}
                    class="form-input">`;
                break;
            
            case 'select':
                inputHtml = `<select id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''} class="form-select">
                    <option value="">Select...</option>
                    ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>`;
                break;
            
            case 'multiselect':
                inputHtml = `<div class="multiselect-container" id="${field.name}">
                    ${field.options.map(opt => `
                        <label class="checkbox-label">
                            <input type="checkbox" name="${field.name}" value="${opt}">
                            <span>${opt}</span>
                        </label>
                    `).join('')}
                </div>`;
                break;
            
            case 'textarea':
                inputHtml = `<textarea id="${field.name}" 
                    name="${field.name}" 
                    rows="4" 
                    ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}
                    class="form-textarea"></textarea>`;
                break;
            
            case 'button':
                inputHtml = `<button type="button" 
                    class="btn btn-secondary ${field.buttonClass || ''}" 
                    onclick="${field.onClick}">
                    <i class="fas ${field.buttonIcon || 'fa-check'}"></i> ${field.buttonText || 'Click'}
                </button>`;
                break;
        }

        return `
            <div class="form-field ${field.riskFactor ? 'risk-factor' : ''} ${field.type === 'button' ? 'form-field-button' : ''}">
                ${field.label ? `<label for="${field.name}">
                    ${field.label}
                    ${field.required ? '<span class="required">*</span>' : ''}
                </label>` : ''}
                ${tutorialHtml}
                ${inputHtml}
            </div>
        `;
    }).join('');
};

SiteAssessments.attachEventListeners = function() {
    const inputs = document.querySelectorAll('#assessmentForm input, #assessmentForm select, #assessmentForm textarea');
    inputs.forEach(input => {
        input.addEventListener('change', () => this.saveProgress());
    });
};

SiteAssessments.saveProgress = function() {
    const formData = this.collectFormData();
    localStorage.setItem('siteAssessment_current', JSON.stringify(formData));
};
