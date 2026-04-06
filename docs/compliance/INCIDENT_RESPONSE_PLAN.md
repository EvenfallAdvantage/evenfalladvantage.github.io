# Incident Response Plan

**Evenfall Advantage LLC — Overwatch Platform**
**Effective Date:** April 5, 2026
**Last Reviewed:** April 5, 2026
**Owner:** James Ferguson, CTO
**Classification:** Internal

---

## 1. Purpose

This plan establishes procedures for identifying, responding to, and recovering from security incidents affecting the Overwatch platform and its users' data.

## 2. Scope

This plan covers all security incidents including but not limited to:
- Unauthorized access to systems or data
- Data breaches (confirmed or suspected)
- Denial-of-service attacks
- Malware or ransomware
- Insider threats
- Vulnerability exploitation
- Service outages affecting customer operations

## 3. Incident Response Team

| Role | Responsibility | Primary Contact |
|------|---------------|----------------|
| **Incident Commander** | Overall coordination, communication, decisions | CTO (James Ferguson) |
| **Technical Lead** | Investigation, containment, remediation | Lead Developer |
| **Communications Lead** | Customer notification, status updates | CEO / Operations |

## 4. Incident Classification

| Priority | Severity | Examples | Response Time |
|----------|----------|----------|--------------|
| **P1 — Critical** | Active data breach, complete platform outage, active exploitation | Customer PII exposed, database compromised, all users unable to access | Acknowledge: 15 min, Mitigate: 4 hrs |
| **P2 — High** | Partial outage, vulnerability discovered, data integrity issue | Single feature down, XSS/SQLi discovered, timesheet data corruption | Acknowledge: 1 hr, Resolve: 24 hrs |
| **P3 — Medium** | Performance degradation, non-critical security finding | Slow page loads, minor CORS misconfiguration, stale cache serving old data | Acknowledge: 4 hrs, Resolve: 7 days |
| **P4 — Low** | Minor issue, informational security finding | UI bug, non-exploitable finding, best-practice recommendation | Acknowledge: 24 hrs, Resolve: 30 days |

## 5. Incident Response Phases

### Phase 1: Detection and Reporting

**Detection Sources:**
- Supabase audit logs (`security-audit.ts`)
- GitHub Dependabot alerts
- CodeQL security scan results
- Customer reports (via contact@evenfalladvantage.com)
- Uptime monitoring alerts (when configured)
- Error tracking alerts (when configured)
- Manual discovery during development/testing

**Reporting:**
- All suspected incidents reported immediately to the Incident Commander
- Use internal communication channel (Overwatch Briefing or direct message)
- Document: what was observed, when, by whom, initial assessment of severity

### Phase 2: Assessment and Classification

1. Confirm whether the event is a true security incident
2. Classify severity using the priority matrix above
3. Determine scope: which systems, data, and users are affected
4. Assess whether data was accessed, exfiltrated, or modified
5. Document initial findings

### Phase 3: Containment

**Immediate actions (within response time):**

| Scenario | Containment Action |
|----------|-------------------|
| Compromised API key | Rotate the key immediately in Supabase/Stripe/GitHub |
| Unauthorized database access | Revoke the compromised session; rotate service role key |
| XSS/injection vulnerability | Deploy fix or disable affected feature |
| Compromised user account | Force password reset; revoke all sessions |
| DDoS / abuse | Enable rate limiting; block offending IPs via Cloudflare |
| Malicious Edge Function invocation | Disable the function in Supabase config |
| Data breach (confirmed) | Isolate affected data; preserve evidence; begin notification process |

### Phase 4: Eradication

1. Identify root cause of the incident
2. Remove the threat (patch vulnerability, remove malware, fix misconfiguration)
3. Verify the fix addresses the root cause, not just symptoms
4. Review related systems for similar vulnerabilities
5. Deploy fix through standard CI/CD pipeline (or emergency change process)

### Phase 5: Recovery

1. Restore affected systems to normal operation
2. Verify data integrity (compare against backups if needed)
3. Monitor for recurrence (24-72 hours of heightened monitoring)
4. Confirm all users can access the platform normally
5. Re-enable any features that were disabled during containment

### Phase 6: Post-Incident Review

**Within 72 hours of resolution:**

1. Conduct blameless post-mortem meeting
2. Document the incident timeline:
   - When detected, by whom
   - When classified and escalated
   - What containment actions were taken
   - When resolved
   - Total duration of impact
3. Identify lessons learned and preventive measures
4. Create action items with owners and deadlines
5. Update this plan if process improvements are identified
6. File the post-mortem report in `docs/compliance/incidents/`

## 6. Communication

### Internal Communication
- P1/P2: Immediate notification via Briefing post (marked Alert + Pinned)
- P3/P4: Notification within 24 hours via standard channels

### Customer Communication

| Scenario | Timeline | Method |
|----------|----------|--------|
| Data breach (confirmed PII exposure) | Within 72 hours of confirmation | Email to all affected users + Briefing post |
| Service outage (> 1 hour) | Within 30 minutes of detection | Status update via Briefing |
| Vulnerability patched (no data exposure) | After fix deployed | Optional advisory via Briefing |

### Regulatory Notification
- California (CCPA): Notify affected California residents within 72 hours of confirmed breach
- Arizona: Follow state breach notification requirements
- If > 500 records affected: Notify state Attorney General

## 7. Evidence Preservation

During any P1 or P2 incident:
- Do NOT delete or modify logs
- Export relevant Supabase audit logs to a secure location
- Screenshot any relevant Supabase Dashboard information
- Preserve git history (do not force-push or rebase)
- Document all actions taken with timestamps

## 8. Annual Testing

- Conduct tabletop exercise annually (simulate a P1 incident)
- Review and update this plan based on exercise findings
- Verify all contact information is current
- Test backup restoration procedure

## 9. Related Documents

- `INFORMATION_SECURITY_POLICY.md` — Security controls and standards
- `SOC2_READINESS_CHECKLIST.md` — Compliance tracking
- `INTEGRATION_PLAN.md` — System architecture reference

---

**Approved by:** James Ferguson, CTO
**Date:** April 5, 2026
