"use client";

import { X, Shield } from "lucide-react";

interface TOSModalProps {
  open: boolean;
  onClose: () => void;
}

export function TOSModal({ open, onClose }: TOSModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl mx-4 max-h-[90vh] rounded-2xl border border-white/10 bg-[#0f1a2e] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-[#dd8c33]" />
            <h2 className="text-lg font-bold font-mono text-white">TERMS OF SERVICE</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 text-sm text-white/70 leading-relaxed space-y-6">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Last Updated: March 16, 2026</p>

          <section>
            <h3 className="text-white font-semibold mb-2">1. Acceptance of Terms</h3>
            <p>By accessing or using the Overwatch platform (&ldquo;Service&rdquo;), operated by Evenfall Advantage LLC (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), you (&ldquo;User,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;) agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you are accepting these Terms on behalf of an organization, you represent and warrant that you have authority to bind that organization. If you do not agree to these Terms, you must immediately discontinue use of the Service.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">2. Description of Service</h3>
            <p>Overwatch is a software-as-a-service (SaaS) workforce management platform designed for the private security industry. The Service provides tools including, but not limited to: employee onboarding and intake management, time and attendance tracking, scheduling, training and learning management (LMS), incident reporting, real-time communications, site security assessments, geospatial risk analysis, invoice generation, certification management, and integration with third-party tools. The Service is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo;</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">3. Account Registration and Security</h3>
            <p>You must provide accurate, current, and complete information during registration. You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to immediately notify us of any unauthorized use of your account. We reserve the right to suspend or terminate accounts that contain false information or violate these Terms. Multi-factor authentication is available and strongly recommended. We are not liable for any loss or damage arising from your failure to comply with this section.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">4. Acceptable Use Policy</h3>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Use the Service for any unlawful purpose or in violation of any applicable law, regulation, or ordinance</li>
              <li>Upload, transmit, or distribute any content that is defamatory, obscene, harassing, threatening, or that infringes on any intellectual property or privacy rights</li>
              <li>Attempt to gain unauthorized access to any portion of the Service, other accounts, computer systems, or networks connected to the Service</li>
              <li>Use automated means (bots, scrapers, crawlers) to access, collect data from, or interact with the Service without prior written consent</li>
              <li>Interfere with or disrupt the integrity or performance of the Service or the data contained therein</li>
              <li>Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Service</li>
              <li>Resell, sublicense, lease, or otherwise commercially exploit the Service without written authorization</li>
              <li>Impersonate any person or entity, or falsely state or misrepresent your affiliation with any person or entity</li>
              <li>Use the Service to store, process, or transmit any material that contains viruses, trojan horses, worms, or other malicious code</li>
              <li>Circumvent or manipulate any security features, access controls, or usage limits of the Service</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">5. Data Ownership and Privacy</h3>
            <p><strong className="text-white">Your Data:</strong> You retain all ownership rights to data you upload, create, or transmit through the Service (&ldquo;User Data&rdquo;). By using the Service, you grant us a limited, non-exclusive license to process, store, and transmit User Data solely as necessary to provide and improve the Service.</p>
            <p className="mt-2"><strong className="text-white">Our Data Practices:</strong> We process personal data in accordance with our Privacy Policy. We implement industry-standard security measures including AES-256 encryption at rest, TLS 1.3 in transit, and role-based access controls. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>
            <p className="mt-2"><strong className="text-white">Data Retention:</strong> Upon account termination, we will retain User Data for a period of thirty (30) days, after which it may be permanently deleted. You are responsible for exporting your data prior to termination.</p>
            <p className="mt-2"><strong className="text-white">Law Enforcement:</strong> We may disclose User Data if required by law, subpoena, court order, or governmental regulation. We will attempt to notify you of such requests unless prohibited by law.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">6. Third-Party Integrations</h3>
            <p>The Service may integrate with or provide connections to third-party services including, but not limited to, Fillout, Airtable, WhatsApp Business API, Signal, Stripe, Postmark, Resend, and Daily.co (&ldquo;Third-Party Services&rdquo;). Your use of Third-Party Services is subject to their respective terms and conditions. We are not responsible for the availability, accuracy, security, or privacy practices of any Third-Party Service. API keys, tokens, and credentials for Third-Party Services are stored encrypted and are your responsibility to manage. We disclaim all liability for any loss, damage, or data breach arising from your use of Third-Party Services or from the transmission of data between the Service and Third-Party Services.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">7. Intellectual Property</h3>
            <p>The Service, including all software, design, text, graphics, logos, trademarks, and other content (&ldquo;Company IP&rdquo;), is the exclusive property of Evenfall Advantage LLC and is protected by U.S. and international intellectual property laws. Nothing in these Terms grants you any right, title, or interest in Company IP except the limited right to use the Service in accordance with these Terms. You may not copy, modify, distribute, sell, or lease any part of the Service or Company IP.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">8. Security Industry Disclaimer</h3>
            <p className="text-amber-400/80"><strong>IMPORTANT:</strong> The Service is a management and organizational tool. It does NOT provide legal advice, security consulting, tactical guidance, use-of-force recommendations, or any form of professional licensed counsel. The state laws database, site assessment tools, de-escalation simulations, and training content are provided for informational and educational purposes only and should not be relied upon as substitutes for consultation with qualified legal or security professionals.</p>
            <p className="mt-2">Users are solely responsible for ensuring compliance with all applicable federal, state, and local laws, including but not limited to: guard licensing requirements, firearms regulations, use-of-force policies, OSHA workplace safety standards, labor laws, and private security regulatory requirements. The Company makes no representation that the Service will ensure compliance with any particular law or regulation.</p>
            <p className="mt-2">The inclusion of guard card tracking, certification management, or training modules does not constitute an endorsement or certification by any regulatory body. Users must verify all credential requirements with the appropriate licensing authority in their jurisdiction.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">9. Payment Terms</h3>
            <p>Certain features of the Service may require payment. All fees are stated in U.S. dollars and are non-refundable except as expressly stated herein or required by applicable law. Payment processing is handled by Stripe, Inc. and is subject to Stripe&apos;s terms of service. We reserve the right to change pricing with thirty (30) days&apos; written notice. Failure to pay may result in suspension or termination of your account.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">10. Limitation of Liability</h3>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL EVENFALL ADVANTAGE LLC, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AFFILIATES, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, DATA, USE, OR OTHER INTANGIBLE LOSSES, REGARDLESS OF WHETHER SUCH DAMAGES WERE FORESEEABLE AND WHETHER OR NOT THE COMPANY WAS ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
            <p className="mt-2">OUR TOTAL AGGREGATE LIABILITY ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF: (A) THE AMOUNTS YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO LIABILITY, OR (B) ONE HUNDRED U.S. DOLLARS ($100.00).</p>
            <p className="mt-2">THE SERVICE IS NOT DESIGNED FOR OR INTENDED TO BE USED IN LIFE-THREATENING OR SAFETY-CRITICAL SITUATIONS. WE EXPRESSLY DISCLAIM ANY LIABILITY FOR PERSONAL INJURY, PROPERTY DAMAGE, OR DEATH ARISING FROM RELIANCE ON THE SERVICE, ITS TOOLS, OR ITS CONTENT.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">11. Indemnification</h3>
            <p>You agree to indemnify, defend, and hold harmless Evenfall Advantage LLC and its officers, directors, employees, agents, affiliates, and licensors from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys&apos; fees and court costs) arising out of or related to: (a) your use or misuse of the Service; (b) your violation of these Terms; (c) your violation of any law, regulation, or third-party right; (d) any User Data you submit, post, or transmit through the Service; (e) any employment, contracting, or operational decisions made using information obtained through the Service; or (f) any security incident, injury, property damage, or death arising from your operations, regardless of whether the Service was used in connection therewith.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">12. Warranty Disclaimer</h3>
            <p>THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. WE MAKE NO WARRANTIES REGARDING THE ACCURACY, COMPLETENESS, OR RELIABILITY OF ANY CONTENT, DATA, OR INFORMATION OBTAINED THROUGH THE SERVICE, INCLUDING STATE LAWS DATA, RISK SCORES, SITE ASSESSMENTS, AND TRAINING MATERIALS.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">13. Termination</h3>
            <p>We may suspend or terminate your access to the Service at any time, with or without cause, and with or without notice. You may terminate your account at any time by contacting us. Upon termination: (a) your right to use the Service will immediately cease; (b) you remain liable for all obligations accrued prior to termination; (c) Sections 5, 7, 8, 10, 11, 12, 14, 15, and 16 shall survive termination.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">14. Dispute Resolution and Arbitration</h3>
            <p><strong className="text-white">Binding Arbitration:</strong> Any dispute, controversy, or claim arising out of or relating to these Terms or the Service shall be resolved through binding arbitration administered by the American Arbitration Association (&ldquo;AAA&rdquo;) in accordance with its Commercial Arbitration Rules. The arbitration shall be conducted by a single arbitrator and shall take place in the State of Georgia, United States.</p>
            <p className="mt-2"><strong className="text-white">Class Action Waiver:</strong> YOU AGREE THAT ANY DISPUTE RESOLUTION PROCEEDINGS WILL BE CONDUCTED ONLY ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION. YOU WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION.</p>
            <p className="mt-2"><strong className="text-white">Small Claims Exception:</strong> Notwithstanding the foregoing, either party may bring an individual action in small claims court for disputes within the court&apos;s jurisdictional limits.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">15. Governing Law</h3>
            <p>These Terms shall be governed by and construed in accordance with the laws of the State of Georgia, United States, without regard to its conflict of law principles. Any legal action or proceeding not subject to arbitration shall be brought exclusively in the state or federal courts located in Georgia.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">16. General Provisions</h3>
            <p><strong className="text-white">Entire Agreement:</strong> These Terms, together with the Privacy Policy, constitute the entire agreement between you and the Company regarding the Service and supersede all prior agreements and understandings.</p>
            <p className="mt-2"><strong className="text-white">Severability:</strong> If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.</p>
            <p className="mt-2"><strong className="text-white">Waiver:</strong> The failure of the Company to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.</p>
            <p className="mt-2"><strong className="text-white">Assignment:</strong> You may not assign or transfer these Terms or your rights hereunder without the Company&apos;s prior written consent. The Company may assign these Terms without restriction.</p>
            <p className="mt-2"><strong className="text-white">Force Majeure:</strong> The Company shall not be liable for any failure or delay in performance resulting from causes beyond its reasonable control, including but not limited to acts of God, war, terrorism, pandemics, government actions, natural disasters, power failures, internet or telecommunications failures, or cyberattacks.</p>
            <p className="mt-2"><strong className="text-white">Modifications:</strong> We reserve the right to modify these Terms at any time. Material changes will be communicated via the Service or email at least thirty (30) days prior to taking effect. Continued use of the Service after such changes constitutes acceptance of the modified Terms.</p>
            <p className="mt-2"><strong className="text-white">Notices:</strong> All notices under these Terms shall be in writing and shall be deemed given when delivered by email to the address associated with your account or, for notices to the Company, to legal@evenfalladvantage.com.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">17. Contact Information</h3>
            <p>For questions about these Terms of Service, please contact:</p>
            <div className="mt-2 rounded-lg bg-white/5 p-4 text-xs space-y-1">
              <p className="text-white font-semibold">Evenfall Advantage LLC</p>
              <p>Email: legal@evenfalladvantage.com</p>
              <p>Website: evenfalladvantage.com</p>
            </div>
          </section>

          <div className="pt-4 border-t border-white/10">
            <p className="text-[10px] text-white/30 text-center">
              By using Overwatch, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-6 py-4 shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-white/30">&copy; {new Date().getFullYear()} Evenfall Advantage LLC. All rights reserved.</p>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-[#dd8c33] text-white text-sm font-semibold hover:bg-[#c47a2a] transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
