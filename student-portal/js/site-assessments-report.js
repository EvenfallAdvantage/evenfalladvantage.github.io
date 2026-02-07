/**
 * Site Assessments Tool - Part 3: Report Generation
 */

SiteAssessments.generateReport = function() {
    const data = this.collectFormData();
    
    // Validate required fields
    const requiredFields = [];
    this.formSections.forEach(section => {
        section.fields.forEach(field => {
            if (field.required && !data[field.name]) {
                requiredFields.push(field.label);
            }
        });
    });

    if (requiredFields.length > 0) {
        alert(`Please complete the following required fields:\n\n${requiredFields.join('\n')}`);
        return;
    }

    const riskScore = this.calculateRiskScore(data);
    const recommendations = this.generateRecommendations(data);
    
    const reportHtml = this.buildReportHTML(data, riskScore, recommendations);
    
    document.getElementById('reportContent').innerHTML = reportHtml;
    document.getElementById('reportContainer').style.display = 'block';
    document.getElementById('assessmentForm').style.display = 'none';
    document.querySelector('.assessment-actions').style.display = 'none';
    document.querySelector('.assessment-header').style.display = 'none';
    
    document.getElementById('reportContainer').scrollIntoView({ behavior: 'smooth' });
};

SiteAssessments.buildReportHTML = function(data, riskScore, recommendations) {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Get facility-specific terminology
    const facilityType = data.facilityType || 'Other';
    const config = FacilityTypeConfig.getConfig(facilityType);
    const terms = config.terminology;
    
    return `
        <div class="report-document" style="max-width: 850px; margin: 0 auto; padding: 20px; background: white;">
            <!-- Cover Section -->
            <div class="cover-section" style="margin-bottom: 40px;">
                <div class="cover-logo">
                    <img src="../images/logo-print.png" alt="Evenfall Advantage">
                </div>
                <h1 class="cover-title">Final Security Assessment<br>& Recommendations Report</h1>
                <div class="cover-info">
                    <p><strong>Facility:</strong> ${data.clientName || 'N/A'}</p>
                    <p><strong>Facility Type:</strong> ${facilityType}</p>
                    <p><strong>Location:</strong> ${data.city || ''}, ${data.state || ''}</p>
                    <p><strong>Date of Report:</strong> ${today}</p>
                    <p><strong>Prepared By:</strong> ${data.assessorName || 'N/A'}</p>
                    <p><strong>Title:</strong> ${data.assessorTitle || 'Security Consultant'}</p>
                </div>
                <div class="confidentiality-notice">
                    <h3><i class="fas fa-lock"></i> Confidentiality Notice</h3>
                    <p>This document contains sensitive security information and is intended solely for the leadership of ${data.clientName || 'the client'}. Unauthorized distribution, duplication, or disclosure is strictly prohibited.</p>
                </div>
            </div>
            
            <!-- Executive Summary -->
            <div class="section" style="margin-bottom: 30px;">
                <h2 class="report-section-title"><i class="fas fa-file-alt"></i> Executive Summary</h2>
                
                <h3>Assessment Overview</h3>
                <p>This Final Security Assessment was conducted to evaluate ${data.clientName || 'the facility'}'s current security posture, emergency response preparedness, and physical protection measures. The assessment included an on-site evaluation of ${terms.spaces}, ${terms.commonAreas}, and ${terms.entryArea}, along with administrative review and comprehensive risk analysis specific to ${facilityType.toLowerCase()} security considerations.</p>
                
                <h3>Overall Risk Assessment</h3>
                <div class="risk-score-display">
                    <div class="risk-score-circle" style="border-color: ${riskScore.color};">
                        <div class="risk-score-value" style="color: ${riskScore.color};">${riskScore.score}</div>
                        <div class="risk-score-label">Risk Score</div>
                    </div>
                    <div class="risk-score-details">
                        <h4 style="color: ${riskScore.color};">Risk Level: ${riskScore.level}</h4>
                        <div class="risk-factors">
                            <div class="risk-factor-item">
                                <span class="factor-label">Threat Likelihood:</span>
                                <span class="factor-value">${data.threatLikelihood || 'Not assessed'}</span>
                            </div>
                            <div class="risk-factor-item">
                                <span class="factor-label">Potential Impact:</span>
                                <span class="factor-value">${data.potentialImpact || 'Not assessed'}</span>
                            </div>
                            <div class="risk-factor-item">
                                <span class="factor-label">Vulnerability Level:</span>
                                <span class="factor-value">${data.overallVulnerability || 'Not assessed'}</span>
                            </div>
                            <div class="risk-factor-item">
                                <span class="factor-label">Resilience:</span>
                                <span class="factor-value">${data.resilienceLevel || 'Not assessed'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                ${this.generateLocationRiskSection(data)}

                <h3>Key Findings</h3>
                <ul class="findings-list">
                    ${this.generateKeyFindings(data)}
                </ul>

                <h3>Critical Recommendations</h3>
                <p>Based on this assessment, the following priority actions are recommended:</p>
                <ol class="priority-list">
                    ${recommendations.priority1.slice(0, 3).map(r => `<li>${r.recommendation}</li>`).join('')}
                </ol>
            </div>
            
            <!-- Detailed Findings -->
            <div class="section" style="margin-bottom: 30px;">
                <h2 class="report-section-title"><i class="fas fa-search"></i> Detailed Security Survey & Analysis</h2>
                
                <h3><i class="fas fa-shield-alt"></i> Physical Security</h3>
                <div class="findings-section">
                    <p><strong>Door Construction:</strong> ${data.doorType || 'Not assessed'}</p>
                    <p><strong>Door Visibility:</strong> ${data.doorVisibility || 'Not assessed'}</p>
                    <p><strong>Interior Locking:</strong> ${data.interiorLocks || 'Not assessed'}</p>
                    <p><strong>Perimeter Barriers:</strong> ${data.perimeterBarriers || 'Not assessed'}</p>
                    ${data.physicalNotes ? `<p><strong>Notes:</strong> ${data.physicalNotes}</p>` : ''}
                </div>

                <h3><i class="fas fa-door-open"></i> Access Control</h3>
                <div class="findings-section">
                    <p><strong>Total Entry Points:</strong> ${data.entryPoints || 'Not specified'}</p>
                    <p><strong>Controlled Entries:</strong> ${data.controlledEntries || 'Not specified'}</p>
                    <p><strong>Visitor Management:</strong> ${data.visitorManagement || 'Not assessed'}</p>
                    <p><strong>Access Technology:</strong> ${data.accessControlTech || 'Not assessed'}</p>
                    <p><strong>After-Hours Control:</strong> ${data.afterHoursAccess || 'Not assessed'}</p>
                    ${data.accessNotes ? `<p><strong>Notes:</strong> ${data.accessNotes}</p>` : ''}
                </div>

                <h3><i class="fas fa-video"></i> Surveillance</h3>
                <div class="findings-section">
                    <p><strong>Camera Count:</strong> ${data.cameraCount || 'Not specified'}</p>
                    <p><strong>Coverage Assessment:</strong> ${data.cameraCoverage || 'Not assessed'}</p>
                    <p><strong>Camera Quality:</strong> ${data.cameraQuality || 'Not assessed'}</p>
                    <p><strong>Recording Retention:</strong> ${data.recordingRetention || 'Not assessed'}</p>
                    <p><strong>Live Monitoring:</strong> ${data.liveMonitoring || 'Not assessed'}</p>
                    ${data.surveillanceNotes ? `<p><strong>Notes:</strong> ${data.surveillanceNotes}</p>` : ''}
                </div>

                <h3><i class="fas fa-exclamation-triangle"></i> Emergency Management</h3>
                <div class="findings-section">
                    <p><strong>Alarm System:</strong> ${data.alarmSystem || 'Not assessed'}</p>
                    <p><strong>Alarm Coverage:</strong> ${data.alarmAudibility || 'Not assessed'}</p>
                    <p><strong>Communication Systems:</strong> ${Array.isArray(data.communicationSystems) ? data.communicationSystems.join(', ') : 'Not assessed'}</p>
                    <p><strong>Emergency Plans:</strong> ${data.emergencyPlans || 'Not assessed'}</p>
                    <p><strong>Drill Frequency:</strong> ${data.drillFrequency || 'Not assessed'}</p>
                    ${data.emergencyNotes ? `<p><strong>Notes:</strong> ${data.emergencyNotes}</p>` : ''}
                </div>

                <h3><i class="fas fa-users"></i> Training & Culture</h3>
                <div class="findings-section">
                    <p><strong>Crisis Team:</strong> ${data.crisisTeam || 'Not assessed'}</p>
                    <p><strong>Staff Training:</strong> ${data.staffTraining || 'Not assessed'}</p>
                    <p><strong>New Staff Orientation:</strong> ${data.newStaffOrientation || 'Not assessed'}</p>
                    <p><strong>Security Culture:</strong> ${data.securityCulture || 'Not assessed'}</p>
                    ${data.trainingNotes ? `<p><strong>Notes:</strong> ${data.trainingNotes}</p>` : ''}
                </div>
            </div>
            
            <!-- Recommendations -->
            <div class="section" style="margin-bottom: 30px;">
                <h2 class="report-section-title"><i class="fas fa-tasks"></i> Recommendations & Action Plan</h2>
                
                ${this.buildRecommendationsTable('Priority 1 – Immediate (0–3 Months)', recommendations.priority1)}
                ${this.buildRecommendationsTable('Priority 2 – Short-Term (3–6 Months)', recommendations.priority2)}
                ${this.buildRecommendationsTable('Priority 3 – Long-Term (6–12 Months)', recommendations.priority3)}

                <h3><i class="fas fa-road"></i> Proposed Implementation Roadmap</h3>
                <ul>
                    <li><strong>Phase 1:</strong> Immediate life-safety improvements</li>
                    <li><strong>Phase 2:</strong> Infrastructure hardening and training</li>
                    <li><strong>Phase 3:</strong> Continuous improvement and reassessment</li>
                </ul>

                <h3><i class="fas fa-graduation-cap"></i> Training & Exercise Plan</h3>
                <ul>
                    <li>Annual active threat drills</li>
                    <li>New staff orientation security brief</li>
                    <li>Crisis team quarterly reviews</li>
                    <li>Alarm and communication system testing</li>
                </ul>
            </div>
            
            <!-- Conclusion -->
            <div class="section" style="margin-bottom: 30px;">
                <h2 class="report-section-title"><i class="fas fa-check-circle"></i> Conclusion & Next Steps</h2>
                
                <p>${data.clientName || 'The facility'} has ${data.securityCulture === 'Strong - security is priority' ? 'a strong foundation and committed leadership' : 'opportunities to enhance its security posture'}. With targeted investments in physical security, communication systems, and training, the facility can significantly enhance its safety posture while preserving its mission.</p>
                
                <p>Follow-up assessments and ongoing support are strongly recommended.</p>

                <div class="signature-section">
                    <h3><i class="fas fa-pen"></i> Signature & Acknowledgment</h3>
                    <div class="signature-block">
                        <p><strong>Consultant:</strong></p>
                        <p>${data.assessorName || 'N/A'}</p>
                        <p>${data.assessorTitle || 'Security Consultant'}</p>
                        <p>Evenfall Advantage LLC</p>
                        <p>Signature: ____________________</p>
                        <p>Date: ${today}</p>
                    </div>
                    <div class="signature-block">
                        <p><strong>Client Representative:</strong></p>
                        <p>Name: ____________________</p>
                        <p>Title: ____________________</p>
                        <p>Signature: ____________________</p>
                        <p>Date: ____________________</p>
                    </div>
                </div>
            </div>
        </div>
    `;
};

SiteAssessments.generateKeyFindings = function(data) {
    const findings = [];
    
    // Get facility-specific terminology
    const facilityType = data.facilityType || 'Other';
    const terms = FacilityTypeConfig.getTerm(facilityType, 'spaces');
    const primarySpace = FacilityTypeConfig.getTerm(facilityType, 'primarySpace');
    const occupants = FacilityTypeConfig.getTerm(facilityType, 'occupants');
    
    if (data.doorType === 'Hollow-core' || data.doorType === 'Glass') {
        findings.push(`${primarySpace.charAt(0).toUpperCase() + primarySpace.slice(1)} doors lack adequate physical protection`);
    }
    if (data.interiorLocks === 'No interior locks' || data.interiorLocks === 'Partial coverage') {
        findings.push('Limited interior locking capability during emergencies');
    }
    if (data.alarmSystem === 'None' || data.alarmSystem === 'Fire alarm only') {
        findings.push('Emergency notification system requires immediate upgrade');
    }
    if (data.cameraCoverage === 'Partial - significant gaps' || data.cameraCoverage === 'Minimal - limited coverage') {
        findings.push('Surveillance coverage has significant gaps');
    }
    if (data.crisisTeam === 'None' || data.crisisTeam === 'Ad-hoc response only') {
        findings.push('No formalized crisis response team structure');
    }
    if (data.visitorManagement === 'None' || data.visitorManagement === 'Sign-in only') {
        findings.push(`${occupants.charAt(0).toUpperCase() + occupants.slice(1)} management and access control need enhancement`);
    }
    
    if (findings.length === 0) {
        findings.push('Security measures are generally adequate with minor improvement opportunities');
    }
    
    return findings.map(f => `<li>${f}</li>`).join('');
};

SiteAssessments.generateLocationRiskSection = function(data) {
    // Check if geo-risk analysis was performed
    if (!SiteAssessments.currentAssessment.crimeData) {
        return '';
    }

    const crimeData = SiteAssessments.currentAssessment.crimeData;
    const metadata = SiteAssessments.currentAssessment.riskMetadata;
    const holisticAnalysis = SiteAssessments.currentAssessment.holisticAnalysis;

    return `
        <h3><i class="fas fa-map-marked-alt"></i> Location-Based Risk Analysis</h3>
        <div class="findings-section">
            <p><strong>Location:</strong> ${data.city || 'N/A'}, ${data.state || 'N/A'}</p>
            <p><strong>Crime Rating:</strong> ${crimeData.overallRating || 'Not available'}</p>
            <p><strong>Violent Crime Rate:</strong> ${crimeData.violentCrimeRate || 'N/A'} per 100,000 population</p>
            <p><strong>Property Crime Rate:</strong> ${crimeData.propertyCrimeRate || 'N/A'} per 100,000 population</p>
            ${metadata ? `
                <p style="margin-top: 1rem;"><strong>Data Sources:</strong></p>
                <ul style="margin: 0.5rem 0; padding-left: 2rem; font-size: 0.9rem;">
                    ${metadata.dataSources.map(source => 
                        `<li>${source.name}${source.year ? ` (${source.year})` : ''} - ${source.description}</li>`
                    ).join('')}
                </ul>
                <p style="font-size: 0.85rem; color: #6c757d; margin-top: 0.5rem;">
                    Analysis Date: ${new Date(metadata.analysisDate).toLocaleDateString()} | 
                    Confidence: ${metadata.confidence}
                </p>
            ` : ''}
        </div>
        
        ${holisticAnalysis ? `
            <h3><i class="fas fa-calculator"></i> Comprehensive Risk Analysis</h3>
            <div class="findings-section">
                <p><strong>Analysis Methodology:</strong> This assessment combines location-based crime data with on-site security observations to provide a holistic risk evaluation.</p>
                <p style="margin-top: 1rem;"><strong>Risk Factors Analyzed:</strong></p>
                <ul style="margin: 0.5rem 0; padding-left: 2rem; font-size: 0.9rem;">
                    ${holisticAnalysis.factors.map(factor => `<li>${factor}</li>`).join('')}
                </ul>
                <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-left: 4px solid #3498db; border-radius: 4px;">
                    <p style="margin: 0;"><strong>Influence Summary:</strong></p>
                    <ul style="margin: 0.5rem 0; padding-left: 2rem; font-size: 0.9rem;">
                        <li><strong>Location Crime Data:</strong> ${holisticAnalysis.locationInfluence > 0 ? 'Increases' : 'Decreases'} threat likelihood (weight: 30%)</li>
                        <li><strong>Physical Security:</strong> ${Math.abs(holisticAnalysis.physicalSecurityInfluence).toFixed(2)} impact on vulnerability (weight: 25%)</li>
                        <li><strong>Access Control:</strong> ${Math.abs(holisticAnalysis.accessControlInfluence).toFixed(2)} impact on vulnerability (weight: 20%)</li>
                        <li><strong>Surveillance Systems:</strong> ${Math.abs(holisticAnalysis.surveillanceInfluence).toFixed(2)} impact on vulnerability (weight: 15%)</li>
                        <li><strong>Personnel & Culture:</strong> ${Math.abs(holisticAnalysis.personnelInfluence).toFixed(2)} impact on resilience (weight: 20%)</li>
                    </ul>
                </div>
                <p style="margin-top: 1rem; font-size: 0.9rem; color: #6c757d;">
                    <i class="fas fa-info-circle"></i> The final risk levels shown in the Risk Assessment section are calculated using this weighted analysis combined with facility-specific factors.
                </p>
            </div>
        ` : ''}
    `;
};

SiteAssessments.buildRecommendationsTable = function(title, recommendations) {
    if (recommendations.length === 0) return '';
    
    return `
        <h3>${title}</h3>
        <table class="recommendations-table">
            <thead>
                <tr>
                    <th>Issue</th>
                    <th>Recommendation</th>
                    <th>Timeline</th>
                    <th>Responsibility</th>
                </tr>
            </thead>
            <tbody>
                ${recommendations.map(r => `
                    <tr>
                        <td data-label="Issue">${r.issue}</td>
                        <td data-label="Recommendation">${r.recommendation}</td>
                        <td data-label="Timeline">${r.timeline}</td>
                        <td data-label="Responsibility">${r.responsibility}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
};
