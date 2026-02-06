/**
 * Site Assessments Tool - Part 1: Core Data & Configuration
 * Professional security site assessment and report generation
 */

const SiteAssessments = {
    tutorialMode: false,
    currentAssessment: {},
    templates: [],
    
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

    async analyzeLocationRisk() {
        // Get address data from form
        const addressData = {
            address: document.getElementById('address')?.value || '',
            city: document.getElementById('city')?.value || '',
            state: document.getElementById('state')?.value || '',
            facilityType: document.getElementById('facilityType')?.value || ''
        };

        // Validate required fields
        if (!addressData.city || !addressData.state) {
            alert('Please enter City and State before analyzing location risk.');
            return;
        }

        try {
            // Use GeoRiskService to analyze location
            if (!window.GeoRiskService) {
                throw new Error('GeoRiskService not loaded');
            }

            const riskData = await window.GeoRiskService.analyzeLocationRisk(addressData);
            
            // Populate risk assessment fields
            this.populateRiskAssessment(riskData);
            
            // Show success with data sources
            this.showRiskAnalysisResults(riskData);
            
            // Scroll to risk assessment section
            document.getElementById('section-riskAssessment')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (error) {
            console.error('Location risk analysis error:', error);
            window.GeoRiskService?.showError('Unable to analyze location risk. Please enter values manually.');
        }
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

    showRiskAnalysisResults(riskData) {
        // Create info panel showing what was analyzed
        const infoPanel = document.createElement('div');
        infoPanel.className = 'risk-analysis-info';
        
        const isFallback = riskData.metadata?.location?.fallback;
        const borderColor = isFallback ? '#ffc107' : '#3498db';
        const bgGradient = isFallback 
            ? 'linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%)'
            : 'linear-gradient(135deg, #e7f3ff 0%, #d4edff 100%)';
        
        infoPanel.style.cssText = `
            background: ${bgGradient};
            border-left: 4px solid ${borderColor};
            padding: 1.5rem;
            border-radius: 0.5rem;
            margin: 1rem 0;
        `;
        
        const crimeRating = riskData.crimeData?.overallRating || 'Unknown';
        const violentRate = riskData.crimeData?.violentCrimeRate || 'N/A';
        const propertyRate = riskData.crimeData?.propertyCrimeRate || 'N/A';
        
        const locationNote = isFallback 
            ? `<div style="background: rgba(255, 193, 7, 0.2); padding: 0.75rem; border-radius: 0.25rem; margin-bottom: 1rem;">
                <i class="fas fa-info-circle" style="color: #f57c00;"></i> 
                <strong>Note:</strong> Specific address not found in geocoding database. Using state-level crime statistics for 
                <strong>${riskData.metadata.location.city}, ${riskData.metadata.location.state}</strong>. 
                This is normal and provides accurate risk assessment data.
            </div>`
            : '';
        
        infoPanel.innerHTML = `
            <h4 style="margin: 0 0 1rem 0; color: #1d3451; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-chart-line"></i> Location Risk Analysis Complete
            </h4>
            ${locationNote}
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <strong>Crime Rating:</strong> ${crimeRating}
                </div>
                <div>
                    <strong>Violent Crime Rate:</strong> ${violentRate} per 100k
                </div>
                <div>
                    <strong>Property Crime Rate:</strong> ${propertyRate} per 100k
                </div>
            </div>
            <p style="margin: 0.5rem 0; font-size: 0.9rem;">
                <i class="fas fa-info-circle"></i> Risk assessment fields have been auto-populated based on location data. 
                <strong>You can edit any field</strong> to refine the assessment based on your on-site observations.
            </p>
            <details style="margin-top: 1rem;">
                <summary style="cursor: pointer; font-weight: 600; color: #1d3451;">
                    <i class="fas fa-database"></i> Data Sources & Methodology
                </summary>
                <ul style="margin: 0.5rem 0; padding-left: 2rem; font-size: 0.9rem;">
                    ${riskData.metadata.dataSources.map(source => 
                        `<li><strong>${source.name}</strong>${source.year ? ` (${source.year})` : ''} - ${source.description}</li>`
                    ).join('')}
                </ul>
                <p style="margin: 0.5rem 0; font-size: 0.85rem; color: #6c757d;">
                    Analysis Date: ${new Date(riskData.metadata.analysisDate).toLocaleDateString()} | 
                    Confidence Level: ${riskData.metadata.confidence}
                </p>
                ${isFallback ? `<p style="margin: 0.5rem 0; font-size: 0.85rem; color: #6c757d;">
                    <i class="fas fa-lightbulb"></i> <strong>Tip:</strong> State-level statistics are appropriate for most security assessments. 
                    Local variations should be noted in your on-site observations.
                </p>` : ''}
            </details>
        `;

        // Insert after risk assessment section header
        const riskSection = document.getElementById('section-riskAssessment');
        if (riskSection) {
            const existingInfo = riskSection.querySelector('.risk-analysis-info');
            if (existingInfo) {
                existingInfo.replaceWith(infoPanel);
            } else {
                const sectionFields = riskSection.querySelector('.section-fields');
                if (sectionFields) {
                    sectionFields.insertAdjacentElement('beforebegin', infoPanel);
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
