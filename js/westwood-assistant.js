/**
 * Agent Westwood — Self-Contained Security, Training & Estimate Assistant
 *
 * Zero external CDN or paid API dependencies:
 *  - Local avatar (/images/agent-westwood-avatar.jpg) with inline SVG fallback
 *  - Built-in FAQ & intent engine covering Evenfall Advantage's 4 pillars,
 *    training modules (STOP THE BLEED®, ICS/NIMS, Use of Force, De-escalation,
 *    Active Threat, Legal/Licensing), and instant estimate routing
 *  - Direct lead capture connected to Overwatch `intake-ingest` via
 *    `window.EVENFALL_LEAD_INTAKE` (js/lead-config.js)
 *  - Optional, 100% free browser-native voice readout (Web Speech API
 *    `window.speechSynthesis`), muted by default
 */
(function () {
    'use strict';

    const AVATAR_SRC = 'images/agent-westwood-avatar.jpg';
    const AVATAR_FALLBACK_SVG =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">' +
            '<rect width="80" height="80" rx="40" fill="#1d3451"/>' +
            '<circle cx="40" cy="30" r="14" fill="#dd8c33"/>' +
            '<path d="M16 68c4-14 15-21 24-21s20 7 24 21" fill="#dd8c33"/>' +
            '</svg>'
        );

    const ESTIMATE_LINKS = [
        {
            title: 'Security Consulting & Risk Assessment',
            desc: 'Threat assessments, CPTED analysis, SOP development',
            href: 'forms/security-consulting.html',
            icon: 'fa-shield-halved'
        },
        {
            title: 'Training & Certification (Overwatch LMS)',
            desc: 'Guard licensing, ICS/NIMS, STOP THE BLEED®, de-escalation',
            href: 'forms/training-certification.html',
            icon: 'fa-graduation-cap'
        },
        {
            title: 'Festival, Event & Venue Safety',
            desc: 'Crowd management, Sanctuary Ops, harm reduction protocols',
            href: 'forms/festival-venue-safety.html',
            icon: 'fa-users'
        },
        {
            title: 'Emergency Response Planning',
            desc: 'Workplace violence mitigation, school safety, EAP drills',
            href: 'forms/emergency-response-planning.html',
            icon: 'fa-clipboard-check'
        }
    ];

    const QUICK_TOPICS = [
        { id: 'pillars', label: 'Our 4 Pillars' },
        { id: 'estimates', label: 'Instant Estimates' },
        { id: 'training', label: 'Training & Overwatch LMS' },
        { id: 'stop-the-bleed', label: 'STOP THE BLEED®' },
        { id: 'ics', label: 'ICS / NIMS' },
        { id: 'use-of-force', label: 'Use of Force & De-escalation' },
        { id: 'active-threat', label: 'Active Threat Protocol' },
        { id: 'contact', label: 'Talk to Our Team' }
    ];

    const KNOWLEDGE_BASE = {
        pillars: {
            speech: "Evenfall Advantage operates across four core pillars: Security Consulting and Risk Assessments, Training and Certification powered by Overwatch LMS, Festival and Venue Safety, and Emergency Response Planning.",
            html: `
                <p><strong>Evenfall Advantage LLC</strong> is a veteran-led firm built on 30+ years of military, wildland firefighting, and high-density event security experience. Our work centers on <strong>4 Pillars</strong>:</p>
                <ul class="westwood-list">
                    <li><strong>1. Security Consulting &amp; Risk Assessments:</strong> Full-site threat &amp; vulnerability assessments, CPTED evaluations, and custom SOP development.</li>
                    <li><strong>2. Training &amp; LMS (Overwatch / Instructor HQ):</strong> State-compliant guard licensing, ICS/NIMS, STOP THE BLEED®, and interactive de-escalation training.</li>
                    <li><strong>3. Festival, Event &amp; Venue Safety:</strong> High-density crowd management, perimeter security, Sanctuary Ops, and harm reduction coordination.</li>
                    <li><strong>4. Emergency Response Planning &amp; Ops:</strong> Actionable contingency plans, workplace violence mitigation, school safety, and live drills.</li>
                </ul>
                <div class="westwood-inline-actions">
                    <a href="#estimate" class="westwood-action-link" data-westwood-scroll="#estimate"><i class="fas fa-compass"></i> View Services on Page</a>
                    <button type="button" class="westwood-action-btn" data-westwood-topic="estimates"><i class="fas fa-calculator"></i> Open Estimate Calculators</button>
                </div>
            `
        },
        estimates: {
            speech: "You can request a tailored estimate using any of our four interactive service calculators below, or leave your contact details for a direct callback.",
            html: `
                <p>Select a service area below to launch our <strong>Instant Estimate &amp; Intake Calculator</strong>, or switch to <em>Talk to Our Team</em> to request a callback right here:</p>
                <div class="westwood-estimate-cards">
                    ${ESTIMATE_LINKS.map(item => `
                        <a href="${item.href}" class="westwood-estimate-card">
                            <span class="westwood-estimate-icon"><i class="fas ${item.icon}"></i></span>
                            <span class="westwood-estimate-body">
                                <strong>${item.title}</strong>
                                <small>${item.desc}</small>
                            </span>
                            <i class="fas fa-arrow-right westwood-estimate-arrow"></i>
                        </a>
                    `).join('')}
                </div>
                <div class="westwood-inline-actions">
                    <button type="button" class="westwood-action-btn" data-westwood-view="contact"><i class="fas fa-paper-plane"></i> Request a Direct Callback</button>
                </div>
            `
        },
        consulting: {
            speech: "Our Security Consulting practice delivers full-site threat and vulnerability assessments, CPTED evaluations, and custom Standard Operating Procedures for high-risk environments.",
            html: `
                <p><strong>Security Consulting &amp; Vulnerability Assessments:</strong></p>
                <p>We deliver field-proven security consulting rooted in tactical experience and compliance-driven planning:</p>
                <ul class="westwood-list">
                    <li><strong>Threat &amp; Vulnerability Assessments:</strong> End-to-end physical and operational site reviews.</li>
                    <li><strong>CPTED Analysis:</strong> Crime Prevention Through Environmental Design for facilities, campuses, and venues.</li>
                    <li><strong>SOP &amp; Post Order Development:</strong> Clear, enforceable procedures tailored to your team.</li>
                </ul>
                <div class="westwood-inline-actions">
                    <a href="forms/security-consulting.html" class="westwood-action-link"><i class="fas fa-file-signature"></i> Security Consulting Estimate</a>
                    <button type="button" class="westwood-action-btn" data-westwood-view="contact" data-westwood-service="Security Consulting"><i class="fas fa-headset"></i> Discuss Your Facility</button>
                </div>
            `
        },
        events: {
            speech: "Our Festival and Venue Safety team specializes in high-density crowd environments, perimeter planning, Sanctuary Ops, and harm reduction protocols.",
            html: `
                <p><strong>Festival, Event &amp; Venue Safety:</strong></p>
                <p>We specialize in high-density crowd environments and live venue operations:</p>
                <ul class="westwood-list">
                    <li><strong>Crowd Management &amp; Perimeter Planning:</strong> Access control, ingress/egress flow, and staging safety.</li>
                    <li><strong>Sanctuary Ops &amp; Harm Reduction:</strong> Dedicated guest support and medical/safety coordination.</li>
                    <li><strong>Command Integration:</strong> Seamless coordination with local law enforcement, fire, and EMS under ICS.</li>
                </ul>
                <div class="westwood-inline-actions">
                    <a href="forms/festival-venue-safety.html" class="westwood-action-link"><i class="fas fa-users"></i> Festival &amp; Venue Estimate</a>
                    <button type="button" class="westwood-action-btn" data-westwood-view="contact" data-westwood-service="Festival & Venue Safety"><i class="fas fa-headset"></i> Ask About Event Coverage</button>
                </div>
            `
        },
        training: {
            speech: "Evenfall Advantage offers certified instructor-led and hybrid training through Overwatch and Instructor HQ, including state guard licensing, ICS and NIMS, STOP THE BLEED, and interactive de-escalation scenarios.",
            html: `
                <p><strong>Training, Certifications &amp; Overwatch LMS:</strong></p>
                <ul class="westwood-list">
                    <li><strong>State-Compliant Guard Licensing:</strong> Modified State Courses, legal authority, duty of care, and patrol readiness.</li>
                    <li><strong>Emergency &amp; Trauma Certifications:</strong> Official <strong>STOP THE BLEED®</strong> and <strong>ICS / NIMS</strong> instruction.</li>
                    <li><strong>Overwatch &amp; Instructor HQ:</strong> Our integrated operations and training portal featuring interactive de-escalation scenarios, slide modules, and credential tracking.</li>
                </ul>
                <div class="westwood-inline-actions">
                    <a href="forms/training-certification.html" class="westwood-action-link"><i class="fas fa-graduation-cap"></i> Training Estimate</a>
                    <a href="/overwatch/" class="westwood-action-link westwood-action-secondary"><i class="fas fa-shield-alt"></i> Open Overwatch Portal</a>
                </div>
            `
        },
        'stop-the-bleed': {
            speech: "STOP THE BLEED is a national trauma training program that teaches how to control life-threatening bleeding. The three core actions are: apply direct pressure, pack the wound with gauze if needed, and apply a tourniquet if bleeding does not stop. Always ensure scene safety first.",
            html: `
                <p><strong>STOP THE BLEED® — Hemorrhage Control Protocol:</strong></p>
                <p>STOP THE BLEED® trains personnel and bystanders to control life-threatening bleeding before EMS arrival. Ensure <strong>scene safety first</strong>, then follow the 3 core steps:</p>
                <ol class="westwood-list">
                    <li><strong>Apply Direct Pressure:</strong> Use both hands with gauze or a clean cloth directly over the bleeding source.</li>
                    <li><strong>Pack the Wound:</strong> For deep wounds on junctions (neck, shoulder, groin), pack tightly with hemostatic or plain gauze and maintain pressure.</li>
                    <li><strong>Apply a Tourniquet:</strong> For severe limb bleeding, place a CoTCCC-recommended tourniquet 2–3 inches above the wound (never over a joint), tighten until bleeding stops, and note the time.</li>
                </ol>
                <div class="westwood-inline-actions">
                    <a href="forms/training-certification.html" class="westwood-action-link"><i class="fas fa-kit-medical"></i> Book STOP THE BLEED® Training</a>
                </div>
            `
        },
        ics: {
            speech: "The Incident Command System, or ICS, is a standardized approach to emergency management built around five functional areas: Command, Operations, Planning, Logistics, and Finance and Administration. Key principles include unity of command, manageable span of control, and common terminology.",
            html: `
                <p><strong>Incident Command System (ICS / NIMS):</strong></p>
                <p>ICS is the standardized, scalable framework used across emergency management, wildland fire, and major venue operations. Its <strong>5 Major Functional Areas</strong> are:</p>
                <ul class="westwood-list">
                    <li><strong>Command:</strong> Sets incident objectives, strategies, and overall safety responsibility (Incident Commander &amp; Command Staff).</li>
                    <li><strong>Operations:</strong> Directs tactical field actions to achieve incident objectives.</li>
                    <li><strong>Planning:</strong> Collects intelligence, tracks resources, and prepares the Incident Action Plan (IAP).</li>
                    <li><strong>Logistics:</strong> Provides communications, medical support, supplies, and facilities.</li>
                    <li><strong>Finance / Administration:</strong> Monitors costs, contracts, and time tracking.</li>
                </ul>
                <p class="westwood-note">Core principles: <em>Unity of Command</em>, <em>Manageable Span of Control (3–7)</em>, and <em>Common Terminology</em>.</p>
                <div class="westwood-inline-actions">
                    <a href="forms/training-certification.html" class="westwood-action-link"><i class="fas fa-sitemap"></i> Request ICS/NIMS Instruction</a>
                </div>
            `
        },
        'use-of-force': {
            speech: "Use of force must always be objectively reasonable based on the totality of circumstances. Prioritize verbal de-escalation, use the minimum force required, and clearly articulate and document every action.",
            html: `
                <p><strong>Use of Force &amp; Verbal De-escalation:</strong></p>
                <p>Use of force must be <strong>objectively reasonable</strong> based on the totality of circumstances:</p>
                <ul class="westwood-list">
                    <li><strong>De-escalation First:</strong> Use calm posture, active listening, time, and distance to resolve conflict voluntarily whenever safe.</li>
                    <li><strong>Force Continuum:</strong> Professional presence &rarr; Verbal direction &rarr; Empty-hand control &rarr; Less-lethal options &rarr; Lethal force (only for imminent threat of death or great bodily harm).</li>
                    <li><strong>Articulation &amp; Documentation:</strong> Personnel must clearly articulate and document why each action was necessary in their Daily Activity or Incident Report.</li>
                </ul>
                <div class="westwood-inline-actions">
                    <a href="forms/training-certification.html" class="westwood-action-link"><i class="fas fa-comments"></i> Schedule De-escalation Training</a>
                </div>
            `
        },
        'active-threat': {
            speech: "In an active threat situation, follow RUN, HIDE, FIGHT. Evacuate immediately if safe, hide and barricade if evacuation is blocked, and fight only as an absolute last resort. Call 9 1 1 when safe.",
            html: `
                <p><strong>Active Threat / Emergency Response Protocol:</strong></p>
                <ul class="westwood-list">
                    <li><strong>1. RUN (Evacuate):</strong> If a safe path exists, evacuate immediately. Leave belongings behind and help others escape.</li>
                    <li><strong>2. HIDE (Deny Access):</strong> If evacuation isn't possible, lock and barricade doors, turn off lights, silence phones, and stay out of sight behind solid cover.</li>
                    <li><strong>3. FIGHT (Last Resort):</strong> Only if your life is in imminent danger, act with commitment, improvise weapons, and work together to incapacitate the threat.</li>
                </ul>
                <p class="westwood-note"><strong>Emergency Priorities:</strong> 1) Life Safety &bull; 2) Incident Stabilization &bull; 3) Property Conservation.</p>
                <div class="westwood-inline-actions">
                    <a href="forms/emergency-response-planning.html" class="westwood-action-link"><i class="fas fa-clipboard-check"></i> Emergency Planning &amp; Drills Estimate</a>
                </div>
            `
        },
        legal: {
            speech: "Security personnel must understand duty of care, negligence, and legal authority, and maintain thorough incident documentation. Evenfall Advantage offers state-compliant guard licensing and legal liability training.",
            html: `
                <p><strong>Legal Standards, Guard Licensing &amp; Patrol Procedures:</strong></p>
                <ul class="westwood-list">
                    <li><strong>Duty of Care &amp; Liability:</strong> Acting reasonably within post orders and state law to prevent foreseeable harm while avoiding negligence.</li>
                    <li><strong>Core Patrol Procedures:</strong> Credential verification (access control), visible roving patrols, radio discipline, and prompt, factual incident reporting.</li>
                    <li><strong>State Licensing:</strong> Evenfall Advantage provides Modified State Courses and continuing education for security professionals.</li>
                </ul>
                <div class="westwood-inline-actions">
                    <a href="forms/training-certification.html" class="westwood-action-link"><i class="fas fa-id-badge"></i> Inquire About Licensing Courses</a>
                </div>
            `
        }
    };

    function matchTopic(rawText) {
        const q = String(rawText || '').toLowerCase().trim();
        if (!q) return null;

        if (q.includes('bleed') || q.includes('tourniquet') || q.includes('hemorrhage') || q.includes('trauma') || q.includes('first aid')) {
            return 'stop-the-bleed';
        }
        if (q.includes('ics') || q.includes('nims') || q.includes('incident command') || q.includes('span of control')) {
            return 'ics';
        }
        if (q.includes('use of force') || q.includes('force continuum') || q.includes('de-escalat') || q.includes('deescalat') || q.includes('verbal')) {
            return 'use-of-force';
        }
        if (q.includes('active shooter') || q.includes('active threat') || q.includes('run hide fight') || q.includes('workplace violence') || q.includes('evacuat') || q.includes('drill')) {
            return 'active-threat';
        }
        if (q.includes('legal') || q.includes('liability') || q.includes('negligence') || q.includes('duty of care') || q.includes('licens') || q.includes('patrol') || q.includes('post order')) {
            return 'legal';
        }
        if (q.includes('festival') || q.includes('venue') || q.includes('crowd') || q.includes('event') || q.includes('sanctuary') || q.includes('harm reduction')) {
            return 'events';
        }
        if (q.includes('consult') || q.includes('cpted') || q.includes('vulnerability') || q.includes('threat assessment') || q.includes('risk assessment') || q.includes('sop')) {
            return 'consulting';
        }
        if (q.includes('train') || q.includes('overwatch') || q.includes('instructor') || q.includes('course') || q.includes('certif') || q.includes('lms')) {
            return 'training';
        }
        if (q.includes('estimate') || q.includes('price') || q.includes('pricing') || q.includes('cost') || q.includes('quote') || q.includes('calculator') || q.includes('how much')) {
            return 'estimates';
        }
        if (q.includes('contact') || q.includes('human') || q.includes('call') || q.includes('email') || q.includes('talk') || q.includes('reach') || q.includes('team')) {
            return 'contact';
        }
        if (q.includes('pillar') || q.includes('service') || q.includes('what do you do') || q.includes('about') || q.includes('evenfall') || q.includes('who are you') || q.includes('westwood') || q.includes('hello') || q.includes('hi')) {
            return 'pillars';
        }
        return 'fallback';
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function initWestwoodAssistant() {
        if (document.getElementById('westwood-widget')) return;

        let isOpen = false;
        let activeView = 'chat'; // 'chat' | 'estimates' | 'contact'
        let voiceEnabled = false; // Muted by default (100% free Web Speech API)

        const root = document.createElement('aside');
        root.id = 'westwood-widget';
        root.className = 'westwood-widget';
        root.setAttribute('aria-label', 'Agent Westwood Assistant');

        root.innerHTML = `
            <!-- Floating Launcher Button -->
            <button type="button" id="westwood-launcher" class="westwood-launcher" aria-expanded="false" aria-controls="westwood-drawer">
                <span class="westwood-launcher-avatar-wrap">
                    <img src="${AVATAR_SRC}" alt="Agent Westwood" class="westwood-launcher-avatar" width="38" height="38" decoding="async">
                    <span class="westwood-status-dot" aria-hidden="true"></span>
                </span>
                <span class="westwood-launcher-text">
                    <span class="westwood-launcher-title">Ask Agent Westwood</span>
                    <span class="westwood-launcher-sub">Services &bull; Training &bull; Estimates</span>
                </span>
                <span class="westwood-launcher-mobile-label">Ask Westwood</span>
            </button>

            <!-- Expandable Drawer -->
            <section id="westwood-drawer" class="westwood-drawer" role="dialog" aria-modal="false" aria-labelledby="westwood-drawer-title" hidden>
                <header class="westwood-header">
                    <div class="westwood-header-identity">
                        <div class="westwood-header-avatar-wrap">
                            <img src="${AVATAR_SRC}" alt="Agent Westwood" class="westwood-header-avatar" width="42" height="42" decoding="async">
                            <span class="westwood-status-dot" aria-hidden="true"></span>
                        </div>
                        <div class="westwood-header-meta">
                            <h3 id="westwood-drawer-title" class="westwood-header-name">Agent Westwood</h3>
                            <p class="westwood-header-role">Security &amp; Training Advisor</p>
                        </div>
                    </div>
                    <div class="westwood-header-controls">
                        <button type="button" id="westwood-voice-toggle" class="westwood-icon-btn" aria-pressed="false" aria-label="Voice readout muted. Click to enable browser voice." title="Voice readout (Muted)">
                            <i class="fas fa-volume-xmark" id="westwood-voice-icon" aria-hidden="true"></i>
                        </button>
                        <button type="button" id="westwood-close" class="westwood-icon-btn" aria-label="Close Agent Westwood assistant" title="Close">
                            <i class="fas fa-xmark" aria-hidden="true"></i>
                        </button>
                    </div>
                </header>

                <!-- Mode Switcher Tabs -->
                <nav class="westwood-tabs" aria-label="Assistant sections">
                    <button type="button" class="westwood-tab active" data-westwood-tab="chat">
                        <i class="fas fa-comments" aria-hidden="true"></i> Chat &amp; FAQ
                    </button>
                    <button type="button" class="westwood-tab" data-westwood-tab="estimates">
                        <i class="fas fa-calculator" aria-hidden="true"></i> Estimates
                    </button>
                    <button type="button" class="westwood-tab" data-westwood-tab="contact">
                        <i class="fas fa-envelope" aria-hidden="true"></i> Talk to Team
                    </button>
                </nav>

                <!-- VIEW 1: Interactive Chat & FAQ -->
                <div id="westwood-view-chat" class="westwood-view active">
                    <div id="westwood-messages" class="westwood-messages" aria-live="polite">
                        <div class="westwood-msg westwood-msg-agent">
                            <div class="westwood-msg-bubble">
                                <p>Hello, I'm <strong>Agent Westwood</strong>. How can I help you with Evenfall Advantage's services, training, or estimates today?</p>
                            </div>
                        </div>
                    </div>

                    <div class="westwood-chips-bar" aria-label="Quick topics">
                        <div class="westwood-chips-scroll">
                            ${QUICK_TOPICS.map(t => `
                                <button type="button" class="westwood-chip" data-westwood-topic="${t.id}">${t.label}</button>
                            `).join('')}
                        </div>
                    </div>

                    <form id="westwood-chat-form" class="westwood-input-bar" autocomplete="off">
                        <label for="westwood-chat-input" class="westwood-sr-only">Ask Agent Westwood a question</label>
                        <input
                            type="text"
                            id="westwood-chat-input"
                            class="westwood-chat-input"
                            placeholder="Ask about services, STOP THE BLEED, ICS, estimates..."
                            maxlength="300"
                        >
                        <button type="submit" class="westwood-send-btn" aria-label="Send question">
                            <i class="fas fa-paper-plane" aria-hidden="true"></i>
                        </button>
                    </form>
                </div>

                <!-- VIEW 2: Instant Estimate Calculators -->
                <div id="westwood-view-estimates" class="westwood-view" hidden>
                    <div class="westwood-panel-scroll">
                        <p class="westwood-panel-intro">Choose one of our 4 pillars to configure scope and request a tailored estimate:</p>
                        <div class="westwood-estimate-cards">
                            ${ESTIMATE_LINKS.map(item => `
                                <a href="${item.href}" class="westwood-estimate-card">
                                    <span class="westwood-estimate-icon"><i class="fas ${item.icon}"></i></span>
                                    <span class="westwood-estimate-body">
                                        <strong>${item.title}</strong>
                                        <small>${item.desc}</small>
                                    </span>
                                    <i class="fas fa-arrow-right westwood-estimate-arrow"></i>
                                </a>
                            `).join('')}
                        </div>
                        <div class="westwood-panel-footer">
                            <a href="#estimate" class="westwood-action-link" data-westwood-scroll="#estimate">
                                <i class="fas fa-layer-group"></i> Compare All 4 Pillars on This Page
                            </a>
                            <button type="button" class="westwood-action-btn" data-westwood-view="contact">
                                <i class="fas fa-headset"></i> Not sure? Request a Callback
                            </button>
                        </div>
                    </div>
                </div>

                <!-- VIEW 3: Direct Lead / Contact Capture (intake-ingest) -->
                <div id="westwood-view-contact" class="westwood-view" hidden>
                    <div class="westwood-panel-scroll">
                        <form id="westwood-lead-form" class="westwood-lead-form" novalidate>
                            <p class="westwood-panel-intro">Send your question or project details directly to the <strong>Evenfall Advantage</strong> team:</p>

                            <!-- Honeypot field for bot filtering (matches intake-ingest) -->
                            <div style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;" aria-hidden="true">
                                <label for="westwood-hp">Company Website</label>
                                <input type="text" id="westwood-hp" name="company_website" tabindex="-1" autocomplete="off">
                            </div>

                            <div class="westwood-field">
                                <label for="westwood-lead-name">Full Name <span aria-hidden="true">*</span></label>
                                <input type="text" id="westwood-lead-name" name="client_name" required maxlength="120" placeholder="Jane Doe">
                            </div>

                            <div class="westwood-field-row">
                                <div class="westwood-field">
                                    <label for="westwood-lead-email">Email <span aria-hidden="true">*</span></label>
                                    <input type="email" id="westwood-lead-email" name="client_email" required maxlength="254" placeholder="you@organization.com">
                                </div>
                                <div class="westwood-field">
                                    <label for="westwood-lead-phone">Phone <small>(optional)</small></label>
                                    <input type="tel" id="westwood-lead-phone" name="client_phone" maxlength="40" placeholder="(555) 123-4567">
                                </div>
                            </div>

                            <div class="westwood-field">
                                <label for="westwood-lead-service">Service / Topic</label>
                                <select id="westwood-lead-service" name="service">
                                    <option value="Security Consulting">Security Consulting &amp; Risk Assessment</option>
                                    <option value="Training & Certification">Training &amp; Certification / Overwatch LMS</option>
                                    <option value="Festival & Venue Safety">Festival, Event &amp; Venue Safety</option>
                                    <option value="Emergency Response Planning">Emergency Response Planning</option>
                                    <option value="General Inquiry">General Security / Partnership Inquiry</option>
                                </select>
                            </div>

                            <div class="westwood-field">
                                <label for="westwood-lead-message">How can we help? <span aria-hidden="true">*</span></label>
                                <textarea id="westwood-lead-message" name="message" rows="3" required maxlength="2000" placeholder="Tell us about your facility, upcoming event, or training goals..."></textarea>
                            </div>

                            <div id="westwood-lead-status" class="westwood-lead-status" role="status" aria-live="polite" hidden></div>

                            <button type="submit" id="westwood-lead-submit" class="westwood-submit-btn">
                                <i class="fas fa-paper-plane" aria-hidden="true"></i> Send to Evenfall Team
                            </button>
                        </form>
                    </div>
                </div>
            </section>
        `;

        document.body.appendChild(root);

        // Attach SVG fallback if local avatar image ever fails
        root.querySelectorAll('img.westwood-launcher-avatar, img.westwood-header-avatar').forEach((img) => {
            img.addEventListener('error', function () {
                if (this.src !== AVATAR_FALLBACK_SVG) {
                    this.src = AVATAR_FALLBACK_SVG;
                }
            });
        });

        const launcher = document.getElementById('westwood-launcher');
        const drawer = document.getElementById('westwood-drawer');
        const closeBtn = document.getElementById('westwood-close');
        const voiceBtn = document.getElementById('westwood-voice-toggle');
        const voiceIcon = document.getElementById('westwood-voice-icon');
        const messagesEl = document.getElementById('westwood-messages');
        const chatForm = document.getElementById('westwood-chat-form');
        const chatInput = document.getElementById('westwood-chat-input');
        const leadForm = document.getElementById('westwood-lead-form');
        const leadStatus = document.getElementById('westwood-lead-status');
        const leadSubmit = document.getElementById('westwood-lead-submit');
        const leadService = document.getElementById('westwood-lead-service');

        function stopSpeech() {
            if ('speechSynthesis' in window) {
                try {
                    window.speechSynthesis.cancel();
                } catch (_) {
                    // ignore
                }
            }
        }

        function speakText(text) {
            if (!voiceEnabled || !('speechSynthesis' in window) || !text) return;
            try {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.98;
                utterance.pitch = 0.92;
                window.speechSynthesis.speak(utterance);
            } catch (_) {
                // ignore browser speech errors
            }
        }

        function setVoiceEnabled(enabled) {
            voiceEnabled = Boolean(enabled);
            voiceBtn.setAttribute('aria-pressed', voiceEnabled ? 'true' : 'false');
            voiceBtn.setAttribute(
                'aria-label',
                voiceEnabled
                    ? 'Voice readout enabled. Click to mute.'
                    : 'Voice readout muted. Click to enable browser voice.'
            );
            voiceBtn.title = voiceEnabled ? 'Voice readout (On)' : 'Voice readout (Muted)';
            voiceIcon.className = voiceEnabled ? 'fas fa-volume-high' : 'fas fa-volume-xmark';
            if (!voiceEnabled) {
                stopSpeech();
            }
        }

        function switchView(viewName, prefillService) {
            activeView = viewName;
            root.querySelectorAll('[data-westwood-tab]').forEach((tab) => {
                const isMatch = tab.getAttribute('data-westwood-tab') === viewName;
                tab.classList.toggle('active', isMatch);
                tab.setAttribute('aria-selected', isMatch ? 'true' : 'false');
            });
            ['chat', 'estimates', 'contact'].forEach((v) => {
                const panel = document.getElementById(`westwood-view-${v}`);
                if (panel) {
                    const show = v === viewName;
                    panel.hidden = !show;
                    panel.classList.toggle('active', show);
                }
            });
            if (viewName === 'contact' && prefillService && leadService) {
                leadService.value = prefillService;
            }
        }

        function setOpen(open) {
            isOpen = Boolean(open);
            drawer.hidden = !isOpen;
            root.classList.toggle('westwood-open', isOpen);
            launcher.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (isOpen) {
                if (activeView === 'chat' && chatInput) {
                    setTimeout(() => chatInput.focus(), 50);
                }
            } else {
                stopSpeech();
            }
        }

        function appendUserMessage(text) {
            const msg = document.createElement('div');
            msg.className = 'westwood-msg westwood-msg-user';
            msg.innerHTML = `<div class="westwood-msg-bubble"><p>${escapeHtml(text)}</p></div>`;
            messagesEl.appendChild(msg);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function appendAgentMessage(html, speechText) {
            const msg = document.createElement('div');
            msg.className = 'westwood-msg westwood-msg-agent';
            msg.innerHTML = `<div class="westwood-msg-bubble">${html}</div>`;
            messagesEl.appendChild(msg);
            messagesEl.scrollTop = messagesEl.scrollHeight;
            speakText(speechText);
        }

        function handleTopicSelection(topicKey, userLabel) {
            if (topicKey === 'contact') {
                switchView('contact');
                return;
            }
            if (userLabel) {
                appendUserMessage(userLabel);
            }
            const entry = KNOWLEDGE_BASE[topicKey];
            if (entry) {
                appendAgentMessage(entry.html, entry.speech);
                return;
            }
            const fallbackSpeech =
                "I can help with our four core service pillars, STOP THE BLEED, ICS structure, use of force and de-escalation, active threat response, or connect you directly with our team for a custom estimate.";
            const fallbackHtml = `
                <p>I can help with Evenfall Advantage's <strong>4 Pillars</strong> (Security Consulting, Training &amp; Overwatch LMS, Festival &amp; Venue Safety, Emergency Response Planning), training topics (<strong>STOP THE BLEED®</strong>, <strong>ICS/NIMS</strong>, <strong>Use of Force &amp; De-escalation</strong>, <strong>Active Threat</strong>), or route you to an instant estimate:</p>
                <div class="westwood-inline-actions">
                    <button type="button" class="westwood-action-btn" data-westwood-topic="estimates"><i class="fas fa-calculator"></i> View Estimate Calculators</button>
                    <button type="button" class="westwood-action-btn" data-westwood-view="contact"><i class="fas fa-paper-plane"></i> Talk to Our Team</button>
                </div>
            `;
            appendAgentMessage(fallbackHtml, fallbackSpeech);
        }

        // Event bindings
        launcher.addEventListener('click', () => setOpen(!isOpen));
        closeBtn.addEventListener('click', () => setOpen(false));
        voiceBtn.addEventListener('click', () => setVoiceEnabled(!voiceEnabled));

        root.querySelectorAll('[data-westwood-tab]').forEach((tab) => {
            tab.addEventListener('click', () => {
                switchView(tab.getAttribute('data-westwood-tab'));
            });
        });

        // Delegate topic chips, view switches, and smooth scroll links inside drawer
        drawer.addEventListener('click', (e) => {
            const topicBtn = e.target.closest('[data-westwood-topic]');
            if (topicBtn) {
                const topicId = topicBtn.getAttribute('data-westwood-topic');
                const label = topicBtn.textContent.trim();
                switchView('chat');
                handleTopicSelection(topicId, label);
                return;
            }

            const viewBtn = e.target.closest('[data-westwood-view]');
            if (viewBtn) {
                const targetView = viewBtn.getAttribute('data-westwood-view');
                const servicePrefill = viewBtn.getAttribute('data-westwood-service');
                switchView(targetView, servicePrefill);
                return;
            }

            const scrollLink = e.target.closest('[data-westwood-scroll]');
            if (scrollLink) {
                const sel = scrollLink.getAttribute('data-westwood-scroll');
                const target = document.querySelector(sel) || document.querySelector('.services');
                if (target) {
                    e.preventDefault();
                    if (window.matchMedia('(max-width: 768px)').matches) {
                        setOpen(false);
                    }
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });

        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (!text) return;
            chatInput.value = '';
            const topic = matchTopic(text);
            if (topic === 'contact') {
                appendUserMessage(text);
                appendAgentMessage(
                    `<p>I've opened our direct inquiry form so our team can follow up with you promptly, or click below anytime:</p>
                     <div class="westwood-inline-actions">
                         <button type="button" class="westwood-action-btn" data-westwood-view="contact"><i class="fas fa-envelope"></i> Open Callback Form</button>
                     </div>`,
                    "I've opened our direct inquiry form so our team can follow up with you."
                );
                setTimeout(() => switchView('contact'), 250);
                return;
            }
            handleTopicSelection(topic, text);
        });

        // Direct lead form submission -> Overwatch intake-ingest
        leadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            leadStatus.hidden = true;
            leadStatus.className = 'westwood-lead-status';

            const hp = document.getElementById('westwood-hp');
            if (hp && hp.value) {
                leadStatus.textContent = 'Thank you! Your request has been received.';
                leadStatus.classList.add('success');
                leadStatus.hidden = false;
                leadForm.reset();
                return;
            }

            const clientName = document.getElementById('westwood-lead-name').value.trim();
            const clientEmail = document.getElementById('westwood-lead-email').value.trim();
            const clientPhone = document.getElementById('westwood-lead-phone').value.trim();
            const service = document.getElementById('westwood-lead-service').value;
            const message = document.getElementById('westwood-lead-message').value.trim();

            const emailRe = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[A-Za-z]{2,24}$/;
            if (!clientName || !emailRe.test(clientEmail) || !message) {
                leadStatus.textContent = 'Please provide your name, a valid email address, and a brief message.';
                leadStatus.classList.add('error');
                leadStatus.hidden = false;
                return;
            }

            const payload = {
                client_name: clientName,
                client_email: clientEmail,
                client_phone: clientPhone || undefined,
                service: service,
                message: message,
                subject: `${service} - Agent Westwood Inquiry`,
                source: 'evenfalladvantage.com Agent Westwood widget',
                page: window.location.pathname
            };

            const cfg = window.EVENFALL_LEAD_INTAKE || {};
            if (!cfg.endpoint || !cfg.apiKey) {
                showLeadFallback(payload);
                return;
            }

            leadSubmit.disabled = true;
            leadSubmit.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Sending...';

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            try {
                const res = await fetch(cfg.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${cfg.apiKey}`
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                if (!res.ok) throw new Error(`Status ${res.status}`);
                leadForm.reset();
                leadStatus.innerHTML = '<strong>Message sent!</strong> Our team has received your inquiry in Overwatch and will follow up shortly.';
                leadStatus.classList.add('success');
                leadStatus.hidden = false;
            } catch (_) {
                showLeadFallback(payload);
            } finally {
                clearTimeout(timer);
                leadSubmit.disabled = false;
                leadSubmit.innerHTML = '<i class="fas fa-paper-plane" aria-hidden="true"></i> Send to Evenfall Team';
            }
        });

        function showLeadFallback(payload) {
            const summary = [
                `Name: ${payload.client_name}`,
                `Email: ${payload.client_email}`,
                payload.client_phone ? `Phone: ${payload.client_phone}` : null,
                `Service: ${payload.service}`,
                `Message: ${payload.message}`
            ].filter(Boolean).join('\n');
            const mailto = `mailto:contact@evenfalladvantage.com?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(summary)}`;
            leadStatus.innerHTML = `
                Could not reach live intake from this browser origin. Your message is preserved —
                <a href="${mailto}">Email contact@evenfalladvantage.com directly</a>.
            `;
            leadStatus.classList.add('error');
            leadStatus.hidden = false;
        }

        // Escape key closes drawer
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                setOpen(false);
                launcher.focus();
            }
        });

        // Adjust bottom offset if #cookie-banner is visible so neither overlaps
        function syncCookieBannerOffset() {
            const banner = document.getElementById('cookie-banner');
            if (banner && banner.style.display !== 'none' && banner.offsetHeight > 0) {
                root.style.setProperty('--westwood-bottom-offset', `${banner.offsetHeight + 12}px`);
            } else {
                root.style.removeProperty('--westwood-bottom-offset');
            }
        }
        syncCookieBannerOffset();
        window.addEventListener('resize', syncCookieBannerOffset);
        const footerPlaceholder = document.getElementById('footer-placeholder');
        if (footerPlaceholder && 'MutationObserver' in window) {
            const obs = new MutationObserver(syncCookieBannerOffset);
            obs.observe(footerPlaceholder, { childList: true, subtree: true, attributes: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWestwoodAssistant);
    } else {
        initWestwoodAssistant();
    }
})();
