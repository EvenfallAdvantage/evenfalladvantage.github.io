# Overwatch — Compliance & Regulatory Posture

Last reviewed: 2026-06-08
Owner: Evenfall Advantage Engineering

This document maps Overwatch's product features to specific regulatory and
industry frameworks. It is the source of truth for sales and security
questionnaire responses. **External audits (SOC 2 Type II, ISO 27001, Cyber
Essentials, pen-testing) are organizational tasks owned by leadership, not
features in the codebase.** This document distinguishes between the two.

## Frameworks covered

| Framework | Status | Notes |
|-----------|--------|-------|
| GDPR (EU 2016/679) | Product features implemented | Data export + delete edge functions; consent at signup. |
| UK GDPR / Data Protection Act 2018 | Product features implemented | Same as GDPR; UK ICO registration is a corporate task. |
| Martyn's Law (UK Terrorism Protection of Premises Bill) | Product features implemented | Incident reporting, public report intake, training records, role-based access. |
| Hillsborough Law (UK Public Authority Accountability Bill) | Product features implemented | Defensible record (full activity timeline, transfer audit, PDF export, chain-of-custody media). |
| NIST 800-171 / CMMC Level 2 | Product features implemented | Audit logging, access control, session timeouts, encryption. See Security Center. |
| NIST 800-63B (Digital identity) | Product features implemented | Password policy, MFA support, brute-force protection. |
| SOC 2 (Trust Services Criteria) | **External audit required** | Supabase platform is SOC 2 (Team plan or above). App-side controls map to criteria below. |
| ISO 27001 | **External audit required** | Supabase platform is ISO 27001 (Team plan or above). |
| HIPAA | **Paid add-on required** | Available as Supabase add-on. Not enabled by default. |
| Cyber Essentials / Cyber Essentials Plus | **External assessment required** | Documented organizational task. |

---

## GDPR / UK GDPR

### Article 6 — Lawful basis
- Performance of contract (work product, timesheets).
- Legitimate interest (incident investigation, public report intake).
- Consent (marketing communications — opt-in only).

### Article 15 — Right of access
- **Feature:** Self-service "Export my data" button in Security Center → Privacy.
- **Edge function:** `data-export` (user JWT). Returns full JSON archive of all
  personal data, including timesheets, incidents, tasks, audit log entries,
  comments, badges. Owners may export on behalf of a member.

### Article 17 — Right to be forgotten
- **Feature:** "Erase my data" button in Security Center → Privacy. Requires
  the user to type their own email address as a confirmation token.
- **Edge function:** `data-delete` (user JWT). Anonymizes PII in `users` table
  (name → "Redacted [hash]", email → `deleted+[hash]@anonymized.invalid`,
  phone/avatar → NULL), sets `company_memberships.status = 'deleted'`, and
  redacts comment content authored by the subject. Badges are hard-deleted.
- **Retained:** Work-product rows (incidents, tasks, timesheets) are kept for
  legitimate business interest (audit trail) with `user_id` references
  retained. This is the standard GDPR-vs-business-records balance.

### Article 20 — Data portability
- Same export endpoint as Article 15. JSON is a machine-readable,
  structured format suitable for ingestion by another system.

### Article 25 — Data protection by design
- Multi-tenant Row-Level Security (RLS) enforced at the database layer.
- Service-role keys never reach the client.
- Vault encryption for third-party credentials (Twilio, SMTP).
- TLS 1.3 in transit; AES-256 at rest (managed by Supabase).

### Article 30 — Records of processing
- Audit log (`audit_logs` table) records every authentication event, every
  data export/delete, every role change, every config change. Retention is
  unbounded (no expiry).

### Article 32 — Security of processing
- See "NIST 800-171" mapping below.

### Article 33 / 34 — Breach notification
- **Process:** Documented in `RUNBOOK_INCIDENT_RESPONSE.md` (organizational
  task — not yet committed).

---

## Martyn's Law (UK Terrorism Protection of Premises Bill)

Designed for premises owners/operators to have proportionate counter-terrorism
preparedness. Overwatch helps customers comply by providing:

- **Public incident reporting:** Any member of the public can scan a QR code
  and submit a confidential report. Submissions land in a triage queue with
  promote-to-incident workflow. (Phase 4 / `/admin/staff` → Public Reports.)
- **Staff training records:** LMS module tracks completed training; badges
  reflect current credentials.
- **Reporting workflows:** Configurable incident types/statuses per company
  (Phase 1 / `/admin/settings` → Incident Config).
- **Role-based access control:** Only authorized staff can see/edit incidents
  for their company.
- **Auditable evidence:** Every status change, team transfer, and comment is
  logged with timestamp + user attribution.

---

## Hillsborough Law (UK Public Authority Accountability Bill, pending)

Imposes a duty of candour on public authorities. The bill requires officials
to act in the public interest and tell the truth about disasters and serious
incidents. Overwatch supports compliance by providing **defensible records**:

- **Full activity timeline:** `incident_updates` + `task_comments` capture
  every change with user + timestamp. System-generated entries (status
  changes, team transfers, assignment changes) are visually distinguished
  from user notes.
- **Transfer audit:** Both `transferIncident` and `transferTask` write a
  `transfer`-typed audit row with from-team → to-team and optional note.
  Audit rows survive even if the source team is deleted.
- **Chain-of-custody media:** Incident media uploads carry a SHA-256 hash
  (already present in `incident_media` schema) so any later tampering is
  detectable.
- **PDF export:** Per-incident PDF (`generateIncidentPDF`) and analytics PDF
  (`generateAnalyticsPDF`) produce branded, white-labeled records suitable
  for handing to oversight bodies, with full timeline embedded.
- **Long retention:** Audit log has no automatic expiry.

---

## NIST 800-171 / CMMC Level 2 mapping

| Control family | Implementation |
|----------------|----------------|
| §3.1.1 — Limit access to authorized users | Supabase Auth + RLS; `company_memberships` enforces multi-tenancy. |
| §3.1.2 — Limit transactions and functions to authorized users | Role checks via `hasMinRole(role, 'manager')` etc. RLS policies use `is_company_admin` / `is_company_member` SECURITY DEFINER helpers. |
| §3.1.8 — Limit unsuccessful login attempts | Brute-force rate limit (5 attempts / 15 min) in `checkLoginAttempts`. |
| §3.1.10 — Lock session after inactivity | 15-min lock / 30-min logout enforced client-side. |
| §3.3 — Audit and accountability | `audit_logs` table populated by `logSecurityEvent` and every privileged edge function. |
| §3.13 — Protect confidentiality of CUI | TLS 1.3 in transit; AES-256 at rest (Supabase). Vault for third-party creds. |
| §3.13.11 — Cryptographic mechanisms | AES-256-GCM (FIPS 140-2). PBKDF2-SHA256 key derivation (NIST SP 800-132). |

The Security Center page (`/admin/security`) shows the active controls list
to platform admins. Per-company admins see their own audit log.

---

## SOC 2 / ISO 27001

### Supabase platform
- SOC 2 Type II and ISO 27001 are included on the Supabase Team plan and
  above. Reports available on request from Supabase.
- HIPAA available as a paid add-on.

### Overwatch app-side controls (criteria mapping)
| TSC | Criteria | App-side implementation |
|-----|----------|-------------------------|
| CC6.1 | Logical access controls | RLS + `company_memberships` + role checks. |
| CC6.6 | Restrict access to data outside system boundaries | Service-role key only in Edge Functions; never returned to client. |
| CC6.7 | Restrict transmission, movement, removal of data | Data export requires user JWT; data delete requires email confirmation token. |
| CC7.2 | System monitoring | Audit logs + Supabase platform logs. |
| CC7.3 | Evaluate security events | Security Center dashboard surfaces failed logins, lockouts, threat level. |

### External audit
- **Owner:** Evenfall Advantage leadership.
- **Cadence:** Annual SOC 2 Type II report (first audit pending business
  growth milestone).
- **Auditor:** TBD.

---

## Cyber Essentials / Cyber Essentials Plus (UK NCSC)

External assessment, not coded. Five technical control themes:

| Theme | Status |
|-------|--------|
| Firewalls | Supabase manages network firewalls; app-side CSP/CORS hardened. |
| Secure configuration | Documented in `docs/SECURITY_BASELINE.md` (org task). |
| User access control | RLS + roles. ✅ |
| Malware protection | Endpoint protection on dev/admin laptops (org task). |
| Patch management | Dependabot enabled (`renovate.json` task pending); manual dep upgrades tracked in `CHANGELOG.md`. |

---

## Pen testing

- **Status:** Not yet performed.
- **Plan:** Engage CREST-certified provider before first enterprise customer
  go-live. Quarterly internal vulnerability scans in the interim.

---

## Known gaps / roadmap

- SCIM (user provisioning) — not yet implemented; needed for some enterprise SSO customers.
- Automated retention policy (e.g. truncate audit logs >7 years) — not yet implemented.
- Data residency (EU-only Supabase project) — available as a sales option but not yet enabled.
- Hardware security key (WebAuthn) — Supabase Auth supports it; we have not surfaced enrollment in the UI.

---

## Contact

Compliance questions: `security@evenfalladvantage.com` (placeholder).
Subject access requests: file via the "Export my data" button or email the
above address.
