# Data Retention Policy

**Evenfall Advantage LLC — Overwatch Platform**
**Effective Date:** April 5, 2026
**Last Reviewed:** April 5, 2026
**Owner:** James Ferguson, CTO

---

## 1. Purpose

This policy defines how long different categories of data are retained on the Overwatch platform and when they are deleted or archived.

## 2. Retention Schedule

| Data Category | Retention Period | Justification | Deletion Method |
|--------------|-----------------|---------------|-----------------|
| **User accounts** | Active until deletion requested or account deactivated | Required for platform access | Soft-delete (status = inactive); hard-delete on request after 30-day grace period |
| **Company data** | Active until company owner deletes | Required for operations | Soft-delete; data export available before deletion |
| **Timesheets** | 7 years | IRS record-keeping requirements; labor law compliance | Archived after 2 years; deleted after 7 years |
| **Payroll records** | 7 years | IRS and state tax requirements | Archived after 2 years; deleted after 7 years |
| **Incident reports** | 7 years | Liability and insurance requirements | Archived after 2 years; deleted after 7 years |
| **Field reports** | 3 years | Operational reference | Archived after 1 year; deleted after 3 years |
| **Audit logs** | 90 days | Security monitoring; SOC 2 compliance | Auto-deleted via database trigger (`security-audit.ts`) |
| **Chat messages** | 2 years | Business communications | Archived after 1 year; deleted after 2 years |
| **Briefing posts** | 2 years | Operational communications | Archived after 1 year; deleted after 2 years |
| **Training progress** | Duration of employment + 1 year | Certification compliance | Deleted 1 year after membership deactivation |
| **Certifications** | Duration of validity + 3 years | Compliance verification | Retained for audit trail |
| **Applicant data** | 2 years after final status | EEOC compliance (1 year minimum) | Auto-archive after hiring decision; delete after 2 years |
| **Uploaded documents** | Same as parent record | Tied to parent entity lifecycle | Deleted when parent record is deleted |
| **Storyboard data** | Same as linked operation | Operational reference | Deleted when operation is deleted |
| **Payment records** | 7 years | Tax and financial compliance | Retained in Stripe; platform reference deleted after 7 years |
| **Session / auth tokens** | 7 days (inactive) | Security best practice | Auto-expired by Supabase Auth |
| **Cookies (consent)** | 1 year | Cookie consent regulations | localStorage; user can clear manually |

## 3. Data Subject Requests

### Right to Deletion (CCPA / GDPR)

When a user requests deletion of their data:

1. Verify the requestor's identity
2. Export their data (if requested) within 30 days
3. Soft-delete the user account (30-day grace period for recovery)
4. After 30 days: hard-delete all personal data
5. Retain anonymized/aggregated data that cannot identify the individual
6. Notify the user upon completion

**Exceptions:** Data required for legal compliance (tax records, audit logs) may be retained in anonymized form.

### Right to Export

Users can request a copy of their personal data. The export includes:
- Profile information (name, email, phone, address)
- Timesheets and hours worked
- Certifications and training records
- Incident reports they filed
- Messages they sent

Export format: JSON or CSV, delivered within 30 days.

## 4. Data Disposal

| Storage Type | Disposal Method |
|-------------|----------------|
| Database records | SQL DELETE with cascade; Supabase handles physical deletion |
| File storage (documents, images) | Supabase Storage deletion; CDN cache expires within 24 hours |
| Backups | Supabase PITR automatically ages out per retention window |
| Local development data | Developers must securely delete test data after use |

## 5. Implementation

- Automated retention enforcement: scheduled database jobs (future implementation)
- Manual retention review: quarterly audit of data older than retention periods
- Deletion logging: all deletions recorded in audit logs before the 90-day log retention window

## 6. Review

This policy is reviewed annually or when regulatory changes require updates.

---

**Approved by:** James Ferguson, CTO
**Date:** April 5, 2026
