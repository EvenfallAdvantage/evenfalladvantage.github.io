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
    
    return `
        <div class="report-document">
            <!-- Cover Page -->
            <div class="report-page cover-page">
                <div class="cover-logo">
                    <img src="../images/logo.png" alt="Evenfall Advantage" style="max-width: 300px;">
                </div>
                <h1 class="cover-title">Final Security Assessment<br>& Recommendations Report</h1>
                <div class="cover-info">
                    <p><strong>Client:</strong> ${data.clientName || 'N/A'}</p>
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
            <div class="report-page">
                <h2 class="report-section-title"><i class="fas fa-file-alt"></i> Executive Summary</h2>
                
                <h3>Assessment Overview</h3>
                <p>This Final Security Assessment was conducted to evaluate ${data.clientName || 'the facility'}'s current security posture, emergency response preparedness, and physical protection measures. The assessment included an on-site evaluation, administrative review, and comprehensive risk analysis.</p>
                
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
            <div class="report-page">
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
            <div class="report-page">
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
            <div class="report-page">
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
    
    if (data.doorType === 'Hollow-core' || data.doorType === 'Glass') {
        findings.push('Classroom doors lack adequate physical protection');
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
        findings.push('Visitor management and access control need enhancement');
    }
    
    if (findings.length === 0) {
        findings.push('Security measures are generally adequate with minor improvement opportunities');
    }
    
    return findings.map(f => `<li>${f}</li>`).join('');
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
                        <td>${r.issue}</td>
                        <td>${r.recommendation}</td>
                        <td>${r.timeline}</td>
                        <td>${r.responsibility}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
};
