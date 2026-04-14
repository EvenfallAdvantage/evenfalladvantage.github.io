"use client";

import { X, Shield } from "lucide-react";

interface PrivacyPolicyModalProps {
  open: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ open, onClose }: PrivacyPolicyModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl border border-white/10 bg-[#0f1a2e] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-[#dd8c33]" />
            <h2 className="text-lg font-bold font-mono text-white">PRIVACY POLICY</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 text-sm text-white/70 leading-relaxed space-y-6">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Last Updated: October 26, 2025</p>

          <section>
            <h3 className="text-white font-semibold mb-2">1. Introduction</h3>
            <p>Welcome to Evenfall Advantage LLC (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Overwatch platform (&ldquo;Service&rdquo;). By accessing or using the Service, you consent to the data practices described in this policy.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">2. Information We Collect</h3>
            <p><strong className="text-white">Personal Information You Provide:</strong></p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Name, email address, phone number, and mailing address</li>
              <li>Government-issued identification (for certification and licensing purposes)</li>
              <li>Educational background and work experience</li>
              <li>Payment and billing information</li>
              <li>Emergency contact details</li>
            </ul>
            <p className="mt-3"><strong className="text-white">Information Collected Automatically:</strong></p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Device information (browser type, operating system, device identifiers)</li>
              <li>Usage data (pages visited, features accessed, interaction patterns)</li>
              <li>Cookies and similar tracking technologies</li>
              <li>IP address and approximate geolocation</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">3. How We Use Your Information</h3>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Provide, operate, and maintain our services</li>
              <li>Process training enrollments and manage certifications</li>
              <li>Manage workforce scheduling and operational logistics</li>
              <li>Generate security assessments and risk analysis reports</li>
              <li>Process payments and invoicing</li>
              <li>Communicate service updates, security alerts, and notifications</li>
              <li>Improve and personalize your experience with the Service</li>
              <li>Comply with legal obligations and enforce our Terms of Service</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">4. Data Security</h3>
            <p>We implement industry-standard security measures to protect your personal information, including:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>AES-256 encryption for data at rest</li>
              <li>TLS 1.3 encryption for data in transit</li>
              <li>Secure authentication with multi-factor authentication support</li>
              <li>Role-based access controls (RBAC) to limit data exposure</li>
              <li>Comprehensive audit logging of all data access events</li>
            </ul>
            <p className="mt-2">While we strive to protect your data, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security of your information.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">5. Data Sharing</h3>
            <p>We do not sell your personal information. We may share your data with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white">Service Providers:</strong> Third-party vendors (including Supabase, Stripe, and Resend) that assist in platform operations, payment processing, and communications</li>
              <li><strong className="text-white">Law Enforcement:</strong> When required by law, subpoena, court order, or governmental regulation</li>
              <li><strong className="text-white">Employer/Company Administrators:</strong> Your employer or company administrators for workforce management purposes, as applicable to your account type</li>
            </ul>
            <p className="mt-2">All third-party service providers are contractually obligated to protect your data and use it only for the purposes for which it was disclosed.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">6. Your Rights</h3>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-white">Access</strong> the personal data we hold about you</li>
              <li><strong className="text-white">Correct</strong> any inaccuracies in your personal information</li>
              <li><strong className="text-white">Request deletion</strong> of your personal data, subject to legal retention requirements</li>
              <li><strong className="text-white">Opt out</strong> of non-essential communications and marketing emails</li>
              <li><strong className="text-white">Export</strong> your data in a portable, machine-readable format</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, please contact us at the email address provided below.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">7. CCPA Compliance</h3>
            <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>The right to know what personal information is collected, used, shared, or sold</li>
              <li>The right to delete personal information held by businesses</li>
              <li>The right to opt-out of the sale of personal information</li>
              <li>The right to non-discrimination for exercising your CCPA rights</li>
            </ul>
            <p className="mt-2">We do not sell personal information as defined under the CCPA. To submit a CCPA request, please contact us using the information below.</p>
          </section>

          <section>
            <h3 className="text-white font-semibold mb-2">8. Contact</h3>
            <p>For privacy inquiries, data requests, or questions about this Privacy Policy, please contact:</p>
            <div className="mt-2 rounded-lg bg-white/5 p-4 text-xs space-y-1">
              <p className="text-white font-semibold">Evenfall Advantage LLC</p>
              <p>Email: contact@evenfalladvantage.com</p>
              <p>Website: evenfalladvantage.com</p>
            </div>
          </section>

          <div className="pt-4 border-t border-white/10">
            <p className="text-[10px] text-white/60 text-center">
              By using Overwatch, you acknowledge that you have read and understood this Privacy Policy.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-4 sm:px-6 py-3 shrink-0 flex items-center justify-between gap-3">
          <p className="text-[10px] text-white/60 hidden sm:block">&copy; {new Date().getFullYear()} Evenfall Advantage LLC.</p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#dd8c33] text-white text-xs font-semibold hover:bg-[#c47a2a] transition-colors ml-auto"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
