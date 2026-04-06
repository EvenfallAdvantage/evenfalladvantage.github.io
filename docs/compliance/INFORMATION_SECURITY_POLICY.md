# Information Security Policy

**Evenfall Advantage LLC — Overwatch Platform**
**Effective Date:** April 5, 2026
**Last Reviewed:** April 5, 2026
**Owner:** James Ferguson, CTO
**Classification:** Internal

---

## 1. Purpose

This policy establishes the information security requirements for the Overwatch platform and all personnel who access, manage, or support the platform. It defines the minimum controls required to protect the confidentiality, integrity, and availability of customer data and company information.

## 2. Scope

This policy applies to:
- All Evenfall Advantage LLC employees, contractors, and authorized third parties
- All systems, networks, and data associated with the Overwatch platform
- All environments: production, staging, development, and local

## 3. Data Classification

| Level | Definition | Examples | Handling |
|-------|-----------|----------|----------|
| **Restricted** | Highly sensitive; unauthorized disclosure causes severe harm | Encryption keys, service role keys, database passwords, Stripe secret keys | Encrypted at rest and in transit; access limited to system administrators; never in source code |
| **Confidential** | Sensitive business or personal data | Customer PII (SSN, guard card numbers, addresses), financial data, audit logs | Encrypted in transit; access limited by RBAC; stored in Supabase with RLS |
| **Internal** | Business information not for public release | Source code, architecture docs, internal communications, SOC 2 checklist | Access limited to authorized personnel; stored in private GitHub repo |
| **Public** | Information intended for public consumption | Marketing website, privacy policy, terms of service, job application form | No restrictions on distribution |

## 4. Access Control

### 4.1 Authentication
- All platform access requires authentication via Supabase Auth
- Password minimum: 12 characters with strength validation
- Leaked password protection enabled (HaveIBeenPwned integration)
- Phone-based OTP available as alternative authentication
- Session timeout enforced after configurable inactivity period

### 4.2 Authorization
- Role-based access control: Staff < Manager < Admin < Owner
- Row-Level Security (RLS) enforced on all database tables
- Cross-company data isolation on all queries
- Edge Functions verify admin role for privileged operations
- Feature visibility configurable per company

### 4.3 Access Reviews
- Quarterly review of all admin and owner accounts
- Removal of access within 24 hours of role change or termination
- Shared accounts are prohibited

## 5. Data Protection

### 5.1 Encryption
- **At rest:** Supabase (PostgreSQL) encrypts all data at rest
- **In transit:** TLS 1.2+ required for all connections (HTTPS enforced)
- **Application-level:** AES-256-GCM for sensitive fields (guard cards, addresses)

### 5.2 Key Management
- API keys stored in environment variables or Supabase secrets
- No secrets committed to source code (enforced via .gitignore)
- GitHub Secrets used for CI/CD pipeline variables
- Keys rotated when compromise is suspected

### 5.3 Client-Side Security
- Content Security Policy (CSP) headers on all pages
- XSS prevention via escapeHTML/escapeAttr on all dynamic content
- CORS restricted to specific allowed origins
- Webhook signature verification on all payment endpoints

## 6. Vulnerability Management

### 6.1 Automated Scanning
- GitHub Dependabot: weekly dependency vulnerability scans
- GitHub CodeQL: weekly static analysis for security vulnerabilities
- npm audit: run during CI/CD build process

### 6.2 Remediation
- Critical vulnerabilities: remediate within 24 hours
- High vulnerabilities: remediate within 7 days
- Medium vulnerabilities: remediate within 30 days
- Low vulnerabilities: remediate within 90 days

### 6.3 Penetration Testing
- Annual third-party penetration test
- Findings remediated per severity timelines above
- Retest after remediation of critical/high findings

## 7. Change Management

### 7.1 Development Practices
- All code changes via pull requests on GitHub
- CI/CD pipeline (GitHub Actions) builds and deploys automatically
- Database migrations versioned and tracked in `prisma/` directory
- Edge Functions deployed separately via Supabase CLI

### 7.2 Emergency Changes
- Emergency fixes may bypass PR review with post-hoc review within 24 hours
- All emergency changes documented in commit messages
- Rollback via git revert if fix introduces new issues

## 8. Incident Response

See `INCIDENT_RESPONSE_PLAN.md` for detailed procedures.

### 8.1 Classification
- **P1 (Critical):** Data breach, complete service outage, active exploit
- **P2 (High):** Partial outage, security vulnerability discovered, data integrity issue
- **P3 (Medium):** Performance degradation, non-critical bug affecting operations
- **P4 (Low):** Minor issue, cosmetic defect, feature request

### 8.2 Response Times
- P1: Acknowledge within 15 minutes, resolve or mitigate within 4 hours
- P2: Acknowledge within 1 hour, resolve within 24 hours
- P3: Acknowledge within 4 hours, resolve within 7 days
- P4: Acknowledge within 24 hours, resolve within 30 days

## 9. Business Continuity

### 9.1 Backup
- Database: Supabase Point-in-Time Recovery (PITR) enabled
- Source code: GitHub with full git history
- File storage: Supabase Storage with CDN

### 9.2 Recovery Objectives
- Recovery Point Objective (RPO): < 5 minutes (Supabase PITR)
- Recovery Time Objective (RTO): < 1 hour (redeploy from GitHub)

## 10. Acceptable Use

- Company devices must have disk encryption enabled
- Screen lock required after 5 minutes of inactivity
- Multi-factor authentication required on GitHub, Supabase Dashboard, and Stripe Dashboard
- Personal devices used for work must meet the same security requirements
- Sharing of credentials is prohibited

## 11. Policy Review

This policy is reviewed and updated at minimum annually, or when significant changes occur to the platform, threat landscape, or regulatory environment.

---

**Approved by:** James Ferguson, CTO
**Date:** April 5, 2026
