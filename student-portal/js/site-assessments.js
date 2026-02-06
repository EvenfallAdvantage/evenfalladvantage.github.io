/**
 * Site Assessments Tool - Part 1: Core Data & Configuration
 * Professional security site assessment and report generation
 */

const SiteAssessments = {
    tutorialMode: false,
    currentAssessment: {},
    templates: [],
    
    // Initialize the assessment tool
    init() {
        console.log('Site Assessments initialized');
        this.renderForm();
    },
    
    // Start a new assessment
    startNewAssessment() {
        // Clear any existing data
        localStorage.removeItem('siteAssessment_current');
        this.currentAssessment = {};
        
        // Show the form
        document.getElementById('assessmentForm').style.display = 'block';
        document.getElementById('reportContainer').style.display = 'none';
        
        // Render the form
        this.renderForm();
        
        // Scroll to form
        document.getElementById('assessmentForm').scrollIntoView({ behavior: 'smooth' });
    },
    
    // Load a saved assessment
    loadSavedAssessment() {
        const saved = localStorage.getItem('siteAssessment_current');
        if (saved) {
            this.currentAssessment = JSON.parse(saved);
            document.getElementById('assessmentForm').style.display = 'block';
            document.getElementById('reportContainer').style.display = 'none';
            this.renderForm();
            this.restoreFormData(this.currentAssessment);
            alert('Assessment loaded successfully!');
        } else {
            alert('No saved assessment found. Starting a new assessment.');
            this.startNewAssessment();
        }
    },
    
    // Advanced Risk Scoring Algorithm
    riskMatrix: {
        likelihood: {
            rare: { value: 1, weight: 0.15 },
            unlikely: { value: 2, weight: 0.30 },
            possible: { value: 3, weight: 0.50 },
            likely: { value: 4, weight: 0.70 },
            certain: { value: 5, weight: 0.90 }
        },
        impact: {
            negligible: { value: 1, weight: 0.10 },
            minor: { value: 2, weight: 0.25 },
            moderate: { value: 3, weight: 0.50 },
            major: { value: 4, weight: 0.75 },
            catastrophic: { value: 5, weight: 1.00 }
        },
        vulnerability: {
            minimal: { multiplier: 0.8 },
            low: { multiplier: 1.0 },
            moderate: { multiplier: 1.3 },
            high: { multiplier: 1.6 },
            critical: { multiplier: 2.0 }
        },
        resilience: {
            excellent: { factor: 0.7 },
            good: { factor: 0.85 },
            fair: { factor: 1.0 },
            poor: { factor: 1.2 },
            none: { factor: 1.5 }
        }
    },

    // Recommendations Library
    recommendationsLibrary: {
        hollowDoors: {
            issue: 'Hollow-core or glass classroom doors',
            recommendation: 'Replace with solid-core or metal doors',
            priority: 1,
            timeline: '1-3 months',
            responsibility: 'Facilities'
        },
        noSecondaryLocks: {
            issue: 'Classroom locking capability insufficient',
            recommendation: 'Add interior and secondary locks to all classrooms',
            priority: 1,
            timeline: '1-2 months',
            responsibility: 'Facilities'
        },
        noAlarmSystem: {
            issue: 'Emergency alert system inadequate',
            recommendation: 'Install intercom-based alarm system with classroom coverage',
            priority: 1,
            timeline: 'Immediate',
            responsibility: 'Admin / IT'
        },
        coverageGaps: {
            issue: 'Surveillance coverage gaps',
            recommendation: 'Expand camera coverage to all entry points and critical areas',
            priority: 2,
            timeline: '3-6 months',
            responsibility: 'Admin / IT'
        },
        noCrisisTeam: {
            issue: 'No formalized crisis response team',
            recommendation: 'Establish crisis response team with defined roles',
            priority: 2,
            timeline: '3 months',
            responsibility: 'Admin'
        },
        limitedDrills: {
            issue: 'Training and drills limited',
            recommendation: 'Implement annual drills and quarterly refreshers',
            priority: 3,
            timeline: 'Ongoing',
            responsibility: 'Crisis Team'
        },
        inadequateBarriers: {
            issue: 'Insufficient physical barriers',
            recommendation: 'Install layered deterrent barriers at entry points',
            priority: 1,
            timeline: '1-2 months',
            responsibility: 'Facilities'
        },
        uncontrolledEntry: {
            issue: 'Multiple uncontrolled entry points',
            recommendation: 'Implement controlled access system with visitor management',
            priority: 1,
            timeline: '2-4 months',
            responsibility: 'Admin / Security'
        }
    },

    init() {
        this.loadTemplatesFromStorage();
        this.renderForm();
    },

    loadTemplatesFromStorage() {
        const saved = localStorage.getItem('siteAssessment_templates');
        if (saved) {
            this.templates = JSON.parse(saved);
        }
    },

    toggleTutorialMode() {
        this.tutorialMode = !this.tutorialMode;
        document.getElementById('tutorialToggleText').textContent = 
            `Tutorial Mode: ${this.tutorialMode ? 'ON' : 'OFF'}`;
        this.renderForm();
    },

    saveTemplate() {
        const data = this.collectFormData();
        const name = prompt('Enter a name for this template:');
        if (!name) return;
        
        this.templates.push({
            name: name,
            data: data,
            date: new Date().toISOString()
        });
        
        localStorage.setItem('siteAssessment_templates', JSON.stringify(this.templates));
        alert('Template saved successfully!');
    },

    loadTemplate() {
        if (this.templates.length === 0) {
            alert('No saved templates found.');
            return;
        }
        
        let options = this.templates.map((t, i) => `${i + 1}. ${t.name} (${new Date(t.date).toLocaleDateString()})`).join('\n');
        const choice = prompt(`Select a template:\n\n${options}\n\nEnter number:`);
        
        if (!choice) return;
        const index = parseInt(choice) - 1;
        
        if (index >= 0 && index < this.templates.length) {
            this.populateForm(this.templates[index].data);
            alert('Template loaded!');
        }
    },

    populateForm(data) {
        Object.keys(data).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = data[key];
                } else {
                    element.value = data[key];
                }
            }
        });
    },

    resetForm() {
        if (confirm('Are you sure you want to reset the form? All data will be lost.')) {
            document.getElementById('assessmentForm').reset();
            localStorage.removeItem('siteAssessment_current');
        }
    },

    collectFormData() {
        const data = {};
        const inputs = document.querySelectorAll('#assessmentForm input, #assessmentForm select, #assessmentForm textarea');
        
        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                if (!data[input.name]) data[input.name] = [];
                if (input.checked) data[input.name].push(input.value);
            } else {
                data[input.name] = input.value;
            }
        });
        
        return data;
    },
    
    restoreFormData(data) {
        if (!data) return;
        
        Object.keys(data).forEach(key => {
            const input = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    const values = Array.isArray(data[key]) ? data[key] : [data[key]];
                    input.checked = values.includes(input.value);
                } else {
                    input.value = data[key];
                }
            }
        });
    },

    calculateRiskScore(data) {
        const likelihood = this.riskMatrix.likelihood[data.threatLikelihood?.toLowerCase()] || this.riskMatrix.likelihood.possible;
        const impact = this.riskMatrix.impact[data.potentialImpact?.toLowerCase()] || this.riskMatrix.impact.moderate;
        const vulnerability = this.riskMatrix.vulnerability[data.overallVulnerability?.toLowerCase()] || this.riskMatrix.vulnerability.moderate;
        const resilience = this.riskMatrix.resilience[data.resilienceLevel?.toLowerCase()] || this.riskMatrix.resilience.fair;

        const baseScore = (likelihood.weight * 100) * (impact.weight * 100) * vulnerability.multiplier;
        const adjustedScore = (baseScore / 10000) * resilience.factor;
        const normalizedScore = Math.min(100, adjustedScore * 20);

        let riskLevel = 'Low', riskColor = '#28a745';
        if (normalizedScore >= 75) { riskLevel = 'Critical'; riskColor = '#dc3545'; }
        else if (normalizedScore >= 50) { riskLevel = 'High'; riskColor = '#fd7e14'; }
        else if (normalizedScore >= 25) { riskLevel = 'Moderate'; riskColor = '#ffc107'; }

        return { score: normalizedScore.toFixed(1), level: riskLevel, color: riskColor };
    },

    generateRecommendations(data) {
        const recs = { priority1: [], priority2: [], priority3: [] };
        
        // Get facility-specific recommendations based on risk level
        const facilityType = data.facilityType || 'Other';
        const riskLevel = data.overallVulnerability || 'Moderate';
        const facilityRecs = FacilityTypeConfig.getRecommendations(facilityType, riskLevel);
        
        // Add facility-specific recommendations to priority1
        facilityRecs.forEach(rec => {
            recs.priority1.push({
                issue: `${facilityType}-specific security concern`,
                recommendation: rec,
                timeline: 'Within 90 days',
                responsibility: 'Facility Management'
            });
        });

        // Add generic recommendations based on assessment findings
        if (data.doorType === 'Hollow-core' || data.doorType === 'Glass') {
            recs.priority1.push(this.recommendationsLibrary.hollowDoors);
        }
        if (data.interiorLocks === 'No interior locks' || data.interiorLocks === 'Partial coverage') {
            recs.priority1.push(this.recommendationsLibrary.noSecondaryLocks);
        }
        if (data.alarmSystem === 'None' || data.alarmSystem === 'Fire alarm only') {
            recs.priority1.push(this.recommendationsLibrary.noAlarmSystem);
        }
        if (data.cameraCoverage === 'Partial - significant gaps' || data.cameraCoverage === 'Minimal - limited coverage') {
            recs.priority2.push(this.recommendationsLibrary.coverageGaps);
        }
        if (data.crisisTeam === 'None' || data.crisisTeam === 'Ad-hoc response only') {
            recs.priority2.push(this.recommendationsLibrary.noCrisisTeam);
        }
        if (data.staffTraining === 'Minimal training' || data.staffTraining === 'None') {
            recs.priority3.push(this.recommendationsLibrary.limitedDrills);
        }

        return recs;
    },

    async performHolisticAnalysis() {
        // Validate required fields
        const city = document.getElementById('city')?.value || '';
        const state = document.getElementById('state')?.value || '';
        
        if (!city || !state) {
            alert('Please enter City and State in the Client Information section before analyzing.');
            return;
        }

        try {
            // Step 1: Perform location risk analysis
            const addressData = {
                address: document.getElementById('address')?.value || '',
                city: city,
                state: state,
                facilityType: document.getElementById('facilityType')?.value || ''
            };

            if (!window.GeoRiskService) {
                throw new Error('GeoRiskService not loaded');
            }

            const locationRiskData = await window.GeoRiskService.analyzeLocationRisk(addressData);
            
            // Step 2: Collect all form inputs for holistic analysis
            const formData = this.collectAllFormData();
            
            // Step 3: Perform comprehensive risk calculation
            const holisticRisk = this.calculateHolisticRisk(formData, locationRiskData);
            
            // Step 4: Populate risk assessment fields with calculated values
            this.populateRiskAssessment(holisticRisk);
            
            // Step 5: Show analysis results
            this.showRiskAnalysisResults(locationRiskData, holisticRisk);
            
            // Store metadata for report
            this.currentAssessment.riskMetadata = locationRiskData.metadata;
            this.currentAssessment.crimeData = locationRiskData.crimeData;
            this.currentAssessment.holisticAnalysis = holisticRisk.analysis;

        } catch (error) {
            console.error('Holistic analysis error:', error);
            window.GeoRiskService?.showError('Unable to complete analysis. Please check your inputs and try again.');
        }
    },

    collectAllFormData() {
        const data = {};
        const inputs = document.querySelectorAll('#assessmentForm input, #assessmentForm select, #assessmentForm textarea');
        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                if (!data[input.name]) data[input.name] = [];
                if (input.checked) data[input.name].push(input.value);
            } else {
                data[input.name] = input.value;
            }
        });
        return data;
    },

    calculateHolisticRisk(formData, locationRiskData) {
        // Initialize scores
        let vulnerabilityScore = 0;
        let resilienceScore = 0;
        let threatScore = 0;
        let impactScore = 0;
        
        const analysis = {
            factors: [],
            locationInfluence: 0,
            physicalSecurityInfluence: 0,
            accessControlInfluence: 0,
            surveillanceInfluence: 0,
            personnelInfluence: 0
        };

        // 1. Location-based threat likelihood (30% weight)
        const crimeRating = locationRiskData.crimeData?.overallRating || 'Moderate';
        const crimeToThreat = {
            'Negligible': 1,
            'Low': 2,
            'Moderate': 3,
            'High': 4,
            'Critical': 5
        };
        threatScore = (crimeToThreat[crimeRating] || 3) * 0.3;
        analysis.locationInfluence = crimeToThreat[crimeRating] || 3;
        analysis.factors.push(`Location crime rating: ${crimeRating} (Threat +${(crimeToThreat[crimeRating] || 3) * 0.3})`);

        // 2. Physical Security Assessment (25% weight on vulnerability)
        const physicalFactors = {
            doorType: { 'Solid-core/Metal': -1, 'Hollow-core': 2, 'Glass': 2, 'Mixed': 1, 'Unknown': 1 },
            doorVisibility: { 'No windows': -1, 'High windows only': 0, 'Windows at handle height': 2, 'Full glass': 2 },
            lockQuality: { 'Deadbolt + reinforced': -2, 'Deadbolt': -1, 'Standard keyed': 1, 'Push-button': 2, 'None/Unknown': 3 },
            perimeterSecurity: { 'Fencing + lighting + cameras': -2, 'Fencing + lighting': -1, 'Fencing only': 0, 'Minimal': 2, 'None': 3 },
            windowSecurity: { 'Security film + locks': -2, 'Security film or locks': -1, 'Standard': 1, 'No security': 2 }
        };
        
        let physicalScore = 0;
        let physicalCount = 0;
        Object.keys(physicalFactors).forEach(key => {
            if (formData[key] && physicalFactors[key][formData[key]] !== undefined) {
                physicalScore += physicalFactors[key][formData[key]];
                physicalCount++;
            }
        });
        if (physicalCount > 0) {
            const avgPhysical = physicalScore / physicalCount;
            vulnerabilityScore += avgPhysical * 0.25;
            analysis.physicalSecurityInfluence = avgPhysical;
            analysis.factors.push(`Physical security: ${avgPhysical > 0 ? 'Weak' : 'Strong'} (Vulnerability ${avgPhysical > 0 ? '+' : ''}${(avgPhysical * 0.25).toFixed(2)})`);
        }

        // 3. Access Control (20% weight on vulnerability)
        const accessFactors = {
            visitorManagement: { 'Strict - ID + escort': -2, 'Moderate - sign-in': 0, 'Minimal - informal': 1, 'None': 3 },
            accessPoints: { 'Single controlled': -1, 'Multiple controlled': 0, 'Multiple uncontrolled': 2, 'Unrestricted': 3 }
        };
        
        let accessScore = 0;
        let accessCount = 0;
        Object.keys(accessFactors).forEach(key => {
            if (formData[key] && accessFactors[key][formData[key]] !== undefined) {
                accessScore += accessFactors[key][formData[key]];
                accessCount++;
            }
        });
        if (accessCount > 0) {
            const avgAccess = accessScore / accessCount;
            vulnerabilityScore += avgAccess * 0.2;
            analysis.accessControlInfluence = avgAccess;
            analysis.factors.push(`Access control: ${avgAccess > 0 ? 'Weak' : 'Strong'} (Vulnerability ${avgAccess > 0 ? '+' : ''}${(avgAccess * 0.2).toFixed(2)})`);
        }

        // 4. Surveillance (15% weight on vulnerability)
        const surveillanceFactors = {
            cameraSystem: { 'Comprehensive + monitored': -2, 'Comprehensive': -1, 'Partial': 1, 'Minimal': 2, 'None': 3 },
            lighting: { 'Excellent - all areas': -1, 'Good - most areas': 0, 'Fair - some areas': 1, 'Poor': 2 }
        };
        
        let surveillanceScore = 0;
        let surveillanceCount = 0;
        Object.keys(surveillanceFactors).forEach(key => {
            if (formData[key] && surveillanceFactors[key][formData[key]] !== undefined) {
                surveillanceScore += surveillanceFactors[key][formData[key]];
                surveillanceCount++;
            }
        });
        if (surveillanceCount > 0) {
            const avgSurveillance = surveillanceScore / surveillanceCount;
            vulnerabilityScore += avgSurveillance * 0.15;
            analysis.surveillanceInfluence = avgSurveillance;
            analysis.factors.push(`Surveillance: ${avgSurveillance > 0 ? 'Weak' : 'Strong'} (Vulnerability ${avgSurveillance > 0 ? '+' : ''}${(avgSurveillance * 0.15).toFixed(2)})`);
        }

        // 5. Personnel & Training (20% weight on resilience)
        const personnelFactors = {
            securityPersonnel: { 'Full-time professional': 2, 'Part-time': 1, 'Volunteer': 0, 'None': -2 },
            securityCulture: { 'Strong - security is priority': 2, 'Good - security is valued': 1, 'Fair - security is acknowledged': 0, 'Weak - security is afterthought': -2 }
        };
        
        let personnelScore = 0;
        let personnelCount = 0;
        Object.keys(personnelFactors).forEach(key => {
            if (formData[key] && personnelFactors[key][formData[key]] !== undefined) {
                personnelScore += personnelFactors[key][formData[key]];
                personnelCount++;
            }
        });
        if (personnelCount > 0) {
            const avgPersonnel = personnelScore / personnelCount;
            resilienceScore += avgPersonnel * 0.2;
            analysis.personnelInfluence = avgPersonnel;
            analysis.factors.push(`Personnel & culture: ${avgPersonnel > 0 ? 'Strong' : 'Weak'} (Resilience ${avgPersonnel > 0 ? '+' : ''}${(avgPersonnel * 0.2).toFixed(2)})`);
        }

        // 6. Facility type impact modifier
        const facilityImpact = {
            'School': 5,
            'Religious Facility': 4,
            'Healthcare': 5,
            'Office Building': 3,
            'Retail': 3,
            'Venue/Event Space': 4,
            'Single-family Home': 2,
            'Multi-family Complex': 3,
            'Other': 3
        };
        impactScore = facilityImpact[formData.facilityType] || 3;
        analysis.factors.push(`Facility type (${formData.facilityType}): Impact level ${impactScore}`);

        // Convert scores to risk levels
        const threatLevels = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Certain'];
        const impactLevels = ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'];
        const vulnerabilityLevels = ['Minimal', 'Low', 'Moderate', 'High', 'Critical'];
        const resilienceLevels = ['Excellent', 'Good', 'Fair', 'Poor', 'None'];

        const threatIndex = Math.min(Math.max(Math.round(threatScore), 0), 4);
        const impactIndex = Math.min(Math.max(impactScore - 1, 0), 4);
        const vulnerabilityIndex = Math.min(Math.max(Math.round(vulnerabilityScore + 2), 0), 4);
        const resilienceIndex = Math.min(Math.max(4 - Math.round(resilienceScore + 2), 0), 4);

        return {
            threatLikelihood: threatLevels[threatIndex],
            potentialImpact: impactLevels[impactIndex],
            overallVulnerability: vulnerabilityLevels[vulnerabilityIndex],
            resilienceLevel: resilienceLevels[resilienceIndex],
            analysis: analysis,
            scores: {
                threat: threatScore,
                impact: impactScore,
                vulnerability: vulnerabilityScore,
                resilience: resilienceScore
            }
        };
    },

    async analyzeLocationRisk() {
        // Legacy function - redirect to holistic analysis
        await this.performHolisticAnalysis();
    },

    populateRiskAssessment(riskData) {
        // Populate threat likelihood
        const threatField = document.getElementById('threatLikelihood');
        if (threatField && riskData.threatLikelihood) {
            threatField.value = riskData.threatLikelihood;
            threatField.classList.add('auto-populated');
        }

        // Populate potential impact
        const impactField = document.getElementById('potentialImpact');
        if (impactField && riskData.potentialImpact) {
            impactField.value = riskData.potentialImpact;
            impactField.classList.add('auto-populated');
        }

        // Populate vulnerability (with default that can be edited)
        const vulnField = document.getElementById('overallVulnerability');
        if (vulnField && riskData.overallVulnerability) {
            vulnField.value = riskData.overallVulnerability;
            vulnField.classList.add('auto-populated');
        }

        // Populate resilience (with default that can be edited)
        const resField = document.getElementById('resilienceLevel');
        if (resField && riskData.resilienceLevel) {
            resField.value = riskData.resilienceLevel;
            resField.classList.add('auto-populated');
        }

        // Store metadata for report
        this.currentAssessment.riskMetadata = riskData.metadata;
        this.currentAssessment.crimeData = riskData.crimeData;
    },

    showRiskAnalysisResults(locationRiskData, holisticRisk) {
        // Create info panel showing what was analyzed
        const infoPanel = document.createElement('div');
        infoPanel.className = 'risk-analysis-info';
        
        const granularity = locationRiskData.metadata?.granularity || 'state';
        const isFallback = locationRiskData.metadata?.location?.fallback;
        const crimeRating = locationRiskData.crimeData?.overallRating || 'Moderate';
        const violentRate = locationRiskData.crimeData?.violentCrimeRate || 'N/A';
        const propertyRate = locationRiskData.crimeData?.propertyCrimeRate || 'N/A';
        const source = locationRiskData.crimeData?.source || 'Unknown';
        
        // Get color schemes from GeoRiskService
        const riskColors = window.GeoRiskService.getRiskColors(crimeRating);
        const granularityColors = window.GeoRiskService.getGranularityColors(granularity);
        
        // Apply risk-based colors to card
        infoPanel.style.cssText = `
            background: ${riskColors.bg};
            border-left: 4px solid ${riskColors.border};
            padding: 1.5rem;
            border-radius: 0.5rem;
            margin: 1rem 0;
            color: ${riskColors.text};
            width: 100%;
            grid-column: 1 / -1;
        `;
        
        // Granularity badge with accuracy-based colors
        const granularityBadge = `<span style="background: ${granularityColors.bg}; color: ${granularityColors.text}; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.85rem; font-weight: 600;">${granularityColors.label}</span>`;
        
        const locationNote = isFallback && granularity === 'state'
            ? `<div style="background: rgba(255, 193, 7, 0.2); padding: 0.75rem; border-radius: 0.25rem; margin-bottom: 1rem;">
                <i class="fas fa-info-circle" style="color: #f57c00;"></i> 
                <strong>Note:</strong> Specific address not found in geocoding database. Using state-level crime statistics for 
                <strong>${locationRiskData.metadata.location.city}, ${locationRiskData.metadata.location.state}</strong>. 
                This is normal and provides accurate risk assessment data.
            </div>`
            : '';
        
        // Recent incidents section
        const incidentsSection = locationRiskData.recentIncidents && locationRiskData.recentIncidents.total > 0
            ? `<div style="background: rgba(231, 76, 60, 0.1); padding: 0.75rem; border-radius: 0.25rem; margin-top: 1rem;">
                <strong><i class="fas fa-exclamation-triangle"></i> Recent Incidents:</strong>
                ${locationRiskData.recentIncidents.total} crimes in ${locationRiskData.recentIncidents.radius} mile radius 
                (${locationRiskData.recentIncidents.violent} violent, ${locationRiskData.recentIncidents.property} property)
            </div>`
            : '';
        
        // Risk level emoji
        const riskEmoji = {
            'Negligible': '✅',
            'Low': '🟢',
            'Moderate': '🟡',
            'High': '🟠',
            'Critical': '🔴'
        }[crimeRating] || '⚠️';

        infoPanel.innerHTML = `
            <h4 style="margin: 0 0 1rem 0; color: inherit; display: flex; align-items: center; gap: 0.5rem; justify-content: space-between;">
                <span><i class="fas fa-chart-line"></i> Location Risk Analysis Complete</span>
                ${granularityBadge}
            </h4>
            ${locationNote}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <strong>Data Source:</strong> ${source}
                </div>
                <div>
                    <strong>Crime Rating:</strong> ${riskEmoji} ${crimeRating}
                </div>
                <div>
                    <strong>Violent Crime Rate:</strong> ${violentRate} per 100k
                </div>
                <div>
                    <strong>Property Crime Rate:</strong> ${propertyRate} per 100k
                </div>
            </div>
            ${incidentsSection}
            ${holisticRisk ? `
                <div style="background: rgba(52, 152, 219, 0.1); padding: 1rem; border-radius: 0.25rem; margin-top: 1rem;">
                    <strong><i class="fas fa-calculator"></i> Holistic Risk Analysis:</strong>
                    <ul style="margin: 0.5rem 0; padding-left: 1.5rem; font-size: 0.9rem;">
                        ${holisticRisk.analysis.factors.map(factor => `<li>${factor}</li>`).join('')}
                    </ul>
                    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(0,0,0,0.1);">
                        <strong>Calculated Risk Levels:</strong><br>
                        <span style="display: inline-block; margin: 0.25rem 0.5rem 0.25rem 0;">Threat: <strong>${holisticRisk.threatLikelihood}</strong></span> |
                        <span style="display: inline-block; margin: 0.25rem 0.5rem;">Impact: <strong>${holisticRisk.potentialImpact}</strong></span> |
                        <span style="display: inline-block; margin: 0.25rem 0.5rem;">Vulnerability: <strong>${holisticRisk.overallVulnerability}</strong></span> |
                        <span style="display: inline-block; margin: 0.25rem 0.5rem;">Resilience: <strong>${holisticRisk.resilienceLevel}</strong></span>
                    </div>
                </div>
            ` : ''}
            <p style="margin: 0.5rem 0; font-size: 0.9rem; color: inherit;">
                <i class="fas fa-info-circle"></i> Risk assessment fields have been auto-populated based on ${holisticRisk ? 'location data and comprehensive form analysis' : 'location data'}. 
                <strong>You can edit any field</strong> to refine the assessment based on your on-site observations.
            </p>
            <details style="margin-top: 1rem;">
                <summary style="cursor: pointer; font-weight: 600; color: inherit;">
                    <i class="fas fa-database"></i> Data Sources & Methodology
                </summary>
                <ul style="margin: 0.5rem 0; padding-left: 2rem; font-size: 0.9rem; color: inherit;">
                    ${locationRiskData.metadata.dataSources.map(source => 
                        `<li><strong>${source.name}</strong>${source.year ? ` (${source.year})` : ''} - ${source.description}</li>`
                    ).join('')}
                </ul>
                <p style="margin: 0.5rem 0; font-size: 0.85rem; opacity: 0.8;">
                    Analysis Date: ${new Date(locationRiskData.metadata.analysisDate).toLocaleDateString()} | 
                    Confidence Level: ${locationRiskData.metadata.confidence}
                </p>
                ${isFallback ? `<p style="margin: 0.5rem 0; font-size: 0.85rem; opacity: 0.8;">
                    <i class="fas fa-lightbulb"></i> <strong>Tip:</strong> State-level statistics are appropriate for most security assessments. 
                    Local variations should be noted in your on-site observations.
                </p>` : ''}
            </details>
        `;

        // Insert right after the analyze button in Risk Assessment section
        const riskSection = document.getElementById('section-riskAssessment');
        if (riskSection) {
            const existingInfo = riskSection.querySelector('.risk-analysis-info');
            if (existingInfo) {
                existingInfo.replaceWith(infoPanel);
            } else {
                // Find the analyze button and insert after it
                const analyzeButton = riskSection.querySelector('.btn-analyze-risk');
                if (analyzeButton) {
                    const buttonField = analyzeButton.closest('.form-field');
                    if (buttonField) {
                        buttonField.insertAdjacentElement('afterend', infoPanel);
                    }
                } else {
                    // Fallback: insert at end of section fields
                    const sectionFields = riskSection.querySelector('.section-fields');
                    if (sectionFields) {
                        sectionFields.appendChild(infoPanel);
                    }
                }
            }
        }

        window.GeoRiskService.showSuccess('Location risk analysis complete! Review and adjust as needed.');
    },

    closeReport() {
        document.getElementById('reportContainer').style.display = 'none';
        document.getElementById('assessmentForm').style.display = 'block';
        document.querySelector('.assessment-actions').style.display = 'flex';
        document.querySelector('.assessment-header').style.display = 'flex';
    },

    printReport() {
        window.print();
    },

    async downloadPDF() {
        const reportContent = document.getElementById('reportContent');
        const data = this.collectFormData();
        const clientName = data.clientName || 'Security_Assessment';
        
        try {
            // Use PDFGenerator utility if available
            if (window.PDFGenerator) {
                await window.PDFGenerator.generateAssessmentReport(clientName, reportContent);
            } else {
                // Fallback to direct implementation
                await this.generatePDFDirect(reportContent, clientName);
            }
        } catch (error) {
            console.error('PDF generation error:', error);
            alert('Error generating PDF. Please try using Print > Save as PDF instead.');
        }
    },

    async generatePDFDirect(reportContent, clientName) {
        const fileName = `${clientName.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
        
        const loadingDiv = document.createElement('div');
        loadingDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(29, 52, 81, 0.95); color: white; padding: 2rem 3rem; border-radius: 1rem; z-index: 10000; text-align: center;';
        loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i><br><strong>Generating PDF...</strong><br><small>This may take a moment</small>';
        document.body.appendChild(loadingDiv);
        
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'letter',
                compress: true
            });
            
            const pages = reportContent.querySelectorAll('.report-page');
            
            for (let i = 0; i < pages.length; i++) {
                if (i > 0) pdf.addPage();
                
                const canvas = await html2canvas(pages[i], {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    windowWidth: 900,
                    onclone: (clonedDoc) => {
                        const imgs = clonedDoc.querySelectorAll('img');
                        imgs.forEach(img => img.style.maxWidth = '100%');
                    }
                });
                
                const imgWidth = 210;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
            }
            
            pdf.save(fileName);
            document.body.removeChild(loadingDiv);
            
            const successDiv = document.createElement('div');
            successDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #28a745; color: white; padding: 1rem 1.5rem; border-radius: 0.5rem; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.2);';
            successDiv.innerHTML = '<i class="fas fa-check-circle"></i> PDF downloaded successfully!';
            document.body.appendChild(successDiv);
            setTimeout(() => document.body.removeChild(successDiv), 3000);
        } catch (error) {
            document.body.removeChild(loadingDiv);
            throw error;
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('assessmentForm')) {
        SiteAssessments.init();
    }
});
