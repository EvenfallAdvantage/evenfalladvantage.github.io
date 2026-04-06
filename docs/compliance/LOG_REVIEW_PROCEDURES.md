# Log Review Procedures

**Evenfall Advantage LLC — Overwatch Platform**
**Effective Date:** April 6, 2026
**Owner:** James Ferguson, CTO

---

## 1. Purpose

This document defines procedures for regular review of security and application logs to detect anomalies, unauthorized access, and operational issues.

## 2. Log Sources

| Source | Type | Location | Retention |
|--------|------|----------|-----------|
| **Application error logs** | JS errors, React crashes, API failures | `error_logs` table (Supabase) | 30 days |
| **Security audit logs** | Auth events, access changes, admin actions | `audit_log` table (Supabase) | 90 days |
| **Supabase Auth logs** | Login attempts, password resets, MFA events | Supabase Dashboard > Auth > Logs | 7 days |
| **Supabase API logs** | All PostgREST queries, Edge Function invocations | Supabase Dashboard > Logs | 7 days |
| **GitHub Actions logs** | CI/CD build and deployment logs | GitHub > Actions | 90 days |
| **UptimeRobot logs** | Uptime checks, downtime incidents | UptimeRobot Dashboard | 365 days |
| **Dependabot alerts** | Dependency vulnerabilities | GitHub > Security > Dependabot | Ongoing |
| **CodeQL alerts** | Static analysis findings | GitHub > Security > Code scanning | Ongoing |

## 3. Review Schedule

| Review | Frequency | Reviewer | Duration |
|--------|-----------|----------|----------|
| Error log triage | Daily (business days) | CTO / Dev lead | 5-10 min |
| Security audit log review | Weekly (Monday) | CTO | 15-30 min |
| Dependabot / CodeQL alerts | Weekly (Monday) | CTO / Dev lead | 10-15 min |
| UptimeRobot report review | Weekly | CTO | 5 min |
| Supabase Auth log review | Monthly | CTO | 15 min |
| Full security log audit | Quarterly | CTO | 1-2 hours |

## 4. Daily Error Log Triage

### Procedure
1. Open Overwatch > HQ Config > System Logs
2. Review new errors since last triage
3. For each error:
   - **Known/Expected**: Dismiss (e.g., network timeouts, browser extensions)
   - **New/Unexpected**: Investigate root cause
   - **Security-related**: Escalate per Incident Response Plan
4. Document any patterns or recurring errors

### Red Flags
- Repeated authentication failures from same IP
- Errors accessing resources outside user's company
- Edge Function errors with 403/401 status codes
- Database query errors suggesting injection attempts
- Sudden spike in error volume

## 5. Weekly Security Audit Review

### Procedure
1. Query audit_log table for the past 7 days:
   ```sql
   SELECT * FROM audit_log
   WHERE created_at > now() - interval '7 days'
   ORDER BY created_at DESC;
   ```
2. Review for:
   - New admin/owner role assignments (were they authorized?)
   - Unusual login patterns (new devices, odd hours, new locations)
   - Failed authentication attempts (brute force indicators)
   - Data export or bulk operations
   - Edge Function invocations with errors
3. Document findings in the weekly security notes

### Red Flags
- Admin role granted without documented approval
- Login from unexpected geographic location
- Multiple failed logins followed by a successful one
- Bulk data access patterns unusual for the user's role

## 6. Monthly Auth Review

### Procedure
1. Open Supabase Dashboard > Authentication > Users
2. Review:
   - New user registrations (expected vs unexpected)
   - Users with failed login streaks
   - Inactive users (no login in 30+ days)
   - Users with multiple active sessions
3. Cross-reference with the Access Review Checklist quarterly

## 7. Quarterly Full Audit

### Procedure
1. Export all audit logs for the quarter
2. Analyze trends:
   - Error rate trending up or down?
   - New categories of errors appearing?
   - Security events increasing or decreasing?
3. Review Dependabot/CodeQL alert resolution rate
4. Review UptimeRobot uptime percentage vs SLA target
5. Document findings and action items
6. Present summary to management

## 8. Escalation

| Finding | Action |
|---------|--------|
| Suspected data breach | Immediately invoke Incident Response Plan (P1) |
| Active brute force attack | Block IP if possible; invoke IRP (P2) |
| Unpatched critical vulnerability | Remediate within 24 hours per vuln management SLAs |
| Unauthorized access pattern | Investigate and suspend access if confirmed; invoke IRP |
| Uptime below SLA | Root cause analysis; update BCP if needed |

## 9. Review

These procedures are reviewed annually and updated based on operational experience.

---

**Approved by:** James Ferguson, CTO
**Date:** April 6, 2026
