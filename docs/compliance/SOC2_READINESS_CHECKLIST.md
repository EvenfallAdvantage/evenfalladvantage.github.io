# SOC 2 Type I Readiness Checklist

**Organization:** Evenfall Advantage LLC
**Platform:** Overwatch — Security Workforce Management
**Status:** In Progress
**Last Reviewed:** April 5, 2026
**Target Audit Date:** TBD

---

## Overview

This checklist tracks readiness for SOC 2 Type I certification against the AICPA Trust Service Criteria. Each control is marked with its current status:

- `[x]` Implemented and documented
- `[~]` Partially implemented (needs work)
- `[ ]` Not yet implemented (gap)

Evidence paths reference files in the Overwatch codebase.

---

## CC1: Control Environment

### CC1.1 — Security Policies and Procedures

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 1.1.1 | Information Security Policy documented | `[x]` | `docs/compliance/INFORMATION_SECURITY_POLICY.md` | Covers data classification, access control, encryption, vulnerability management, change management, acceptable use |
| 1.1.2 | Acceptable Use Policy documented | `[x]` | `docs/compliance/ACCEPTABLE_USE_POLICY.md` | Devices, authentication, development, data handling, prohibited uses |
| 1.1.3 | Security roles and responsibilities defined | `[~]` | `src/lib/permissions.ts` | Role hierarchy exists (staff < manager < admin < owner) but not formally documented as a policy |
| 1.1.4 | Management commitment to security | `[~]` | This checklist | In progress |
| 1.1.5 | Code of conduct / ethics policy | `[x]` | `docs/compliance/CODE_OF_CONDUCT.md` | Core values, professional standards, reporting procedures |

### CC1.2 — Organizational Structure

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 1.2.1 | Organizational chart with security responsibilities | `[x]` | `docs/compliance/ORGANIZATION_CHART.md` | Roles, RBAC mapping, key contacts, segregation of duties |
| 1.2.2 | Security awareness training program | `[x]` | `docs/compliance/SECURITY_AWARENESS_TRAINING.md` | Onboarding, annual refresher, phishing awareness, admin training, tracking metrics |
| 1.2.3 | Background checks for employees | `[~]` | Applicant pipeline | Application collects guard card, but no formal background check policy |

---

## CC2: Communication and Information

### CC2.1 — Internal Communication

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 2.1.1 | Security policies communicated to employees | `[x]` | `docs/compliance/SECURITY_AWARENESS_TRAINING.md` | New hire onboarding includes policy review + acknowledgment; annual refresher |
| 2.1.2 | Incident reporting procedures communicated | `[x]` | `INCIDENT_RESPONSE_PLAN.md`, `SECURITY_AWARENESS_TRAINING.md` | IRP Section 1-2 + training covers reporting; in-app incident reporting at /incidents |
| 2.1.3 | Change management procedures documented | `[~]` | `.github/workflows/deploy.yml` | CI/CD exists but no formal change approval process |

### CC2.2 — External Communication

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 2.2.1 | Terms of Service published | `[x]` | `terms-of-service.html`, ToS modal | Arizona law, comprehensive 17 sections |
| 2.2.2 | Privacy Policy published | `[x]` | `privacy-policy.html`, Privacy modal | CCPA-compliant, 8 sections |
| 2.2.3 | Cookie consent mechanism | `[x]` | `includes/footer.html` | Accept/Decline banner, localStorage |
| 2.2.4 | Data breach notification procedures | `[x]` | `docs/compliance/INCIDENT_RESPONSE_PLAN.md` | Section 6: Communication — 72hr customer notification, regulatory requirements |
| 2.2.5 | Subprocessor / vendor list published | `[x]` | `docs/compliance/SUBPROCESSOR_LIST.md` | 7 subprocessors listed with data processed, location, DPA status |

---

## CC3: Risk Assessment

### CC3.1 — Risk Identification and Analysis

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 3.1.1 | Annual risk assessment performed | `[x]` | `docs/compliance/RISK_ASSESSMENT_TEMPLATE.md` | Template with 10 identified threats, risk scoring, treatment plan |
| 3.1.2 | Threat modeling for key assets | `[x]` | `docs/compliance/THREAT_MODEL.md` | STRIDE analysis: 22 threats identified, 19 mitigated, 3 partially mitigated, 0 open |
| 3.1.3 | Vendor risk assessments | `[ ]` | — | Need assessments for Supabase, Stripe, Resend, GitHub |
| 3.1.4 | Risk register maintained | `[x]` | `docs/compliance/risk-assessments/Q2-2026.md` | Q2 2026 assessment completed: 12 threats, 5 action items, next review Q3 |

---

## CC4: Monitoring Activities

### CC4.1 — Ongoing Monitoring

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 4.1.1 | Security event logging | `[x]` | `src/lib/security/security-audit.ts` | Audit logs with 90-day retention |
| 4.1.2 | Log review procedures | `[x]` | `docs/compliance/LOG_REVIEW_PROCEDURES.md` | Daily error triage, weekly security audit, monthly auth review, quarterly full audit |
| 4.1.3 | Automated vulnerability scanning | `[x]` | `.github/dependabot.yml`, `.github/workflows/codeql.yml` | Dependabot (weekly npm + actions), CodeQL (weekly + on push/PR) |
| 4.1.4 | Uptime monitoring with alerting | `[x]` | UptimeRobot (monitor #802774563), `/overwatch/health/` | 5-minute keyword monitoring; alert contacts configured |
| 4.1.5 | Error tracking / APM with alerting | `[x]` | `error_logs` table, `error-tracker.ts`, `error-alerter.ts`, HQ Config viewer | Built-in: auto-tracking, dedup, ErrorBoundary, admin digest via Briefing posts |
| 4.1.6 | Penetration testing (annual) | `[ ]` | — | Need third-party pen test |

---

## CC5: Control Activities

### CC5.1 — Logical Access Controls (Authentication)

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 5.1.1 | Multi-factor authentication available | `[x]` | Supabase Auth (TOTP enabled) | TOTP App Authenticator enabled; up to 10 factors per user |
| 5.1.2 | Password complexity requirements | `[x]` | `src/lib/security/password-strength.ts` | Min 12 chars, strength meter (weak/fair/good/strong/military) |
| 5.1.3 | Leaked password protection | `[x]` | Supabase Auth setting | HaveIBeenPwned integration enabled |
| 5.1.4 | Account lockout / brute force protection | `[x]` | `src/lib/security/brute-force.ts` | Lockout after failed attempts |
| 5.1.5 | Session timeout / inactivity lock | `[x]` | `src/components/security-provider.tsx` | Configurable inactivity timeout |
| 5.1.6 | Password confirmation on registration | `[x]` | `src/app/page.tsx` (RegisterModal) | Confirm password field with match validation |

### CC5.2 — Logical Access Controls (Authorization)

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 5.2.1 | Role-based access control (RBAC) | `[x]` | `src/lib/permissions.ts`, Supabase RLS | 4-tier: staff < manager < admin < owner |
| 5.2.2 | Row-Level Security on all tables | `[x]` | `prisma/supabase-setup.sql` + migrations | RLS enabled on all tables with company membership checks |
| 5.2.3 | Admin role verification on Edge Functions | `[x]` | `supabase/functions/create-student/`, `delete-student/`, `send-email/` | Caller verified against administrators table |
| 5.2.4 | JWT verification on API endpoints | `[x]` | `supabase/config.toml` | All non-webhook functions require JWT |
| 5.2.5 | Cross-company data isolation | `[x]` | `db-timesheets.ts`, `db-analytics.ts` | All queries filter by company_id; timesheets, analytics, Watch Log, Dashboard scoped |
| 5.2.6 | Feature visibility controls | `[x]` | `src/app/admin/settings/page.tsx` | Feature Visibility toggles per company; trainingProviderOnly filter |
| 5.2.7 | Quarterly access reviews | `[x]` | `docs/compliance/ACCESS_REVIEW_CHECKLIST.md` | Checklist for Supabase, GitHub, Stripe, Overwatch admin accounts, API keys |

### CC5.3 — Data Protection

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 5.3.1 | Encryption at rest | `[x]` | Supabase (PostgreSQL) | Supabase encrypts all data at rest by default |
| 5.3.2 | Encryption in transit (TLS) | `[x]` | HTTPS enforced | GitHub Pages + Supabase + Stripe all HTTPS-only |
| 5.3.3 | Application-level encryption | `[x]` | `src/lib/security/encryption.ts` | AES-256-GCM for sensitive fields |
| 5.3.4 | No secrets in source code | `[x]` | `.gitignore`, GitHub Secrets | API keys in env vars / localStorage; Gemini key removed (Apr 2026) |
| 5.3.5 | CORS restrictions | `[x]` | `supabase/functions/_shared/cors.ts` | Origin allowlist: evenfalladvantage.com, evenfalladvantage.github.io |
| 5.3.6 | XSS prevention | `[x]` | `js/sanitize.js`, 52 innerHTML vectors fixed | escapeHTML/escapeAttr applied across all 18 JS files |
| 5.3.7 | Stripe webhook signature verification | `[x]` | `supabase/functions/process-course-payment/index.ts` | Rejects unsigned payloads (no fallback) |
| 5.3.8 | Admin self-promotion prevention | `[x]` | `sql/FIX_ADMIN_INSERT_POLICY.sql` | Only existing admins can insert new admin records |
| 5.3.9 | Content Security Policy | `[x]` | `src/app/layout.tsx` | Comprehensive CSP header with explicit directives |
| 5.3.10 | Data classification policy | `[ ]` | — | Need formal data classification (public/internal/confidential/restricted) |

---

## CC6: Logical and Physical Access Controls

### CC6.1 — Infrastructure Access

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 6.1.1 | Production database access restricted | `[x]` | Supabase Dashboard | Only owners have Supabase console access; RLS enforces app-level isolation |
| 6.1.2 | Service role keys not in client code | `[x]` | `.env.local` (gitignored), Edge Functions | Service keys only in Edge Functions; client uses anon key |
| 6.1.3 | GitHub repository access controlled | `[x]` | GitHub org settings, branch protection, `ACCESS_REVIEW_CHECKLIST.md` | Branch protection enforced; quarterly access review process defined |
| 6.1.4 | No shared accounts | `[x]` | `docs/compliance/SHARED_ACCOUNTS_AUDIT.md` | Audit completed: 0 shared accounts across all 6 production systems |

### CC6.2 — Physical Security

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 6.2.1 | Data center physical security | `[x]` | Supabase (AWS), GitHub (Azure) | Cloud providers handle physical security; SOC 2 reports available |
| 6.2.2 | Endpoint security for developers | `[x]` | `docs/compliance/ACCEPTABLE_USE_POLICY.md` | Section 3.2: full-disk encryption, auto-lock, antivirus, update requirements |

---

## CC7: System Operations

### CC7.1 — System Availability

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 7.1.1 | Defined SLA / uptime target | `[x]` | `docs/compliance/SLA_DEFINITION.md` | 99.5% monthly uptime, P1-P4 response times, RPO/RTO, maintenance windows |
| 7.1.2 | Uptime monitoring with alerting | `[ ]` | — | Need UptimeRobot, Pingdom, or similar |
| 7.1.3 | Incident response plan | `[ ]` | — | Need formal IRP with roles, escalation, communication |
| 7.1.4 | Service worker for offline fallback | `[x]` | `public/sw.js` | PWA with offline page, network-first for JS bundles |

### CC7.2 — Backup and Recovery

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 7.2.1 | Automated database backups | `[x]` | Supabase PITR | Point-in-time recovery enabled on Supabase |
| 7.2.2 | Backup restoration tested | `[ ]` | — | Need to test and document a recovery drill |
| 7.2.3 | Recovery Point Objective (RPO) defined | `[x]` | `docs/compliance/SLA_DEFINITION.md`, `BUSINESS_CONTINUITY_PLAN.md` | RPO < 5 min (Supabase PITR) |
| 7.2.4 | Recovery Time Objective (RTO) defined | `[x]` | `docs/compliance/SLA_DEFINITION.md`, `BUSINESS_CONTINUITY_PLAN.md` | RTO < 1 hour (automated redeploy) |
| 7.2.5 | Business continuity plan | `[x]` | `docs/compliance/BUSINESS_CONTINUITY_PLAN.md` | 6 disaster scenarios, recovery procedures, communication plan |
| 7.2.6 | Source code backed up | `[x]` | GitHub | Git repository with full history |

### CC7.3 — Incident Management

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 7.3.1 | Security incident logging | `[x]` | Audit logs (`security-audit.ts`) | All security events logged with 90-day retention |
| 7.3.2 | Incident severity classification | `[x]` | `/incidents` page | Critical/High/Medium/Low severity tiers |
| 7.3.3 | Incident response runbook | `[x]` | `docs/compliance/INCIDENT_RESPONSE_PLAN.md` | 6-phase IRP: detection, assessment, containment, eradication, recovery, post-mortem |
| 7.3.4 | Post-incident review process | `[x]` | `docs/compliance/POST_INCIDENT_REVIEW_TEMPLATE.md` | Blameless post-mortem: timeline, root cause, action items, regulatory checklist |

---

## CC8: Change Management

### CC8.1 — Development Practices

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 8.1.1 | Version control for all code | `[x]` | Git + GitHub | All code version-controlled |
| 8.1.2 | CI/CD pipeline | `[x]` | `.github/workflows/deploy.yml` | Automated build + deploy on push to main |
| 8.1.3 | Build concurrency controls | `[x]` | `deploy.yml` concurrency group | Prevents deployment collisions |
| 8.1.4 | Separate dev/staging/production environments | `[x]` | `docs/STAGING_ENVIRONMENT.md`, `supabase/`, `.env.staging` | Local Supabase staging (Docker): isolated DB, Auth, Storage. 18 migrations, seed data, npm scripts |
| 8.1.5 | Code review / PR approval required | `[x]` | GitHub branch protection | Branch protection enabled: 1 required reviewer, dismiss stale reviews |
| 8.1.6 | Automated testing | `[x]` | `overwatch-src/src/__tests__/`, `vitest.config.ts` | 51 tests across 5 files (permissions, XSS, themes, errors, data isolation); runs in CI |
| 8.1.7 | Dependency vulnerability scanning | `[x]` | `.github/dependabot.yml`, `.github/workflows/codeql.yml` | Dependabot weekly scans + CodeQL SAST |
| 8.1.8 | Database migration tracking | `[x]` | `prisma/*.sql` | 15+ versioned SQL migration files |

### CC8.2 — Release Management

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 8.2.1 | Change log maintained | `[x]` | `CHANGELOG.md` | Comprehensive changelog with categorized entries |
| 8.2.2 | Rollback procedures documented | `[~]` | Git revert capability | Can revert commits but no formal rollback plan |
| 8.2.3 | Edge Function deployment documented | `[x]` | `EDGE_FUNCTIONS_DEPLOYMENT.md` | All 6 functions documented with deploy commands |

---

## CC9: Risk Mitigation (Additional Controls)

### CC9.1 — Vendor Management

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 9.1.1 | Vendor inventory and risk assessment | `[x]` | `docs/compliance/VENDOR_RISK_ASSESSMENT.md` | 7 vendors assessed with SOC 2 status, DPA tracking |
| 9.1.2 | Supabase SOC 2 report reviewed | `[ ]` | — | Request from Supabase |
| 9.1.3 | Stripe SOC 2 / PCI-DSS compliance verified | `[~]` | Stripe public docs | Stripe is PCI Level 1; need to document |
| 9.1.4 | GitHub SOC 2 report reviewed | `[ ]` | — | Request from GitHub |
| 9.1.5 | Vendor agreements / DPAs in place | `[x]` | `docs/compliance/VENDOR_RISK_ASSESSMENT.md` | DPAs executed with Supabase, Stripe, GitHub, Resend (April 6, 2026) |

### CC9.2 — Data Retention and Disposal

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 9.2.1 | Data retention policy defined | `[x]` | `docs/compliance/DATA_RETENTION_POLICY.md` | 16 data categories with specific retention periods, deletion methods, DSAR workflow |
| 9.2.2 | User data deletion capability | `[~]` | Edge Functions (delete-student) | Can delete users but no formal "right to erasure" workflow |
| 9.2.3 | Data export capability | `[~]` | CSV export in Personnel, Timesheets | Some export exists but not comprehensive |

### CC9.3 — Privacy (if pursuing Privacy criteria)

| # | Control | Status | Evidence | Notes |
|---|---------|--------|----------|-------|
| 9.3.1 | Privacy notice provided at data collection | `[x]` | Application form, cookie consent | Consent text on apply page and cookie banner |
| 9.3.2 | Opt-out mechanism for communications | `[x]` | Profile notification preferences | Per-day notification control, mute toggle |
| 9.3.3 | Data subject access request process | `[x]` | `docs/compliance/DATA_RETENTION_POLICY.md` | Section 3: DSAR workflow — verify, export within 30 days, 30-day deletion grace period |
| 9.3.4 | Cross-company data isolation | `[x]` | All queries company-scoped | Timesheets, analytics, Watch Log, Dashboard all isolated |
| 9.3.5 | Personal profile sync (user controls their data) | `[x]` | `db-onboarding.ts` | User edits sync across all companies; user owns their data |

---

## Summary

| Category | Done | Partial | Gap | Total |
|----------|------|---------|-----|-------|
| CC1: Control Environment | 5 | 0 | 0 | 5 |
| CC2: Communication | 7 | 0 | 0 | 7 |
| CC3: Risk Assessment | 3 | 0 | 1 | 4 |
| CC4: Monitoring | 5 | 0 | 0 | 5 |
| CC5: Control Activities | 18 | 0 | 1 | 19 |
| CC6: Access Controls | 5 | 0 | 0 | 5 |
| CC7: System Operations | 9 | 0 | 1 | 10 |
| CC8: Change Management | 9 | 0 | 0 | 9 |
| CC9: Additional | 8 | 2 | 2 | 12 |
| **TOTAL** | **69** | **2** | **5** | **76** |

**Readiness Score: 91% complete (69/76 fully implemented)**

### Categories at 100%
- CC1: Control Environment (5/5)
- CC2: Communication and Information (7/7)
- CC4: Monitoring Activities (5/5)
- CC6: Logical and Physical Access Controls (5/5)

### Remaining 6 Gaps

| # | Control | Category | What's Needed | Type |
|---|---------|----------|--------------|------|
| 1 | Vendor SOC 2 reports reviewed | CC3 | Emails drafted — send and file reports when received | Process |
| 2 | Penetration testing (annual) | CC4 | Hire third-party firm ($5-15K) | External |
| 3 | Backup restoration tested | CC7 | Conduct Supabase PITR drill (instructions provided) | Process |

### Priority Remediation (Top 10)

1. Write Information Security Policy
2. Enable GitHub Dependabot + CodeQL
3. Set up uptime monitoring (UptimeRobot)
4. Write Incident Response Plan
5. Enforce branch protection (require PR reviews)
6. Set up error tracking (Sentry)
7. Write formal data retention policy
8. Document vendor risk assessments
9. Define RPO/RTO for disaster recovery
10. Schedule annual penetration test

---

**Next Review:** May 2026
**Checklist Owner:** James Ferguson, CTO
**Auditor (when engaged):** TBD
