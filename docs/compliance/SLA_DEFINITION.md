# Service Level Agreement (SLA)

**Evenfall Advantage LLC — Overwatch Platform**
**Effective Date:** April 6, 2026

---

## 1. Platform Availability

| Metric | Target |
|--------|--------|
| Monthly uptime | 99.5% |
| Maximum planned downtime per month | 4 hours (maintenance windows) |
| Maximum unplanned downtime per incident | 4 hours (P1 RTO) |

### Uptime Calculation
Uptime % = (Total minutes in month - Downtime minutes) / Total minutes in month x 100

### Exclusions
- Scheduled maintenance (announced 24 hours in advance)
- Third-party service outages (Supabase, Stripe, GitHub) beyond our control
- Force majeure events
- Client-side issues (browser, network, device)

## 2. Support Response Times

| Priority | Description | Acknowledgment | Resolution Target |
|----------|------------|----------------|-------------------|
| P1 — Critical | Platform completely unavailable; data breach | 15 minutes | 4 hours |
| P2 — High | Major feature unavailable; security vulnerability | 1 hour | 24 hours |
| P3 — Medium | Feature degraded; non-critical bug | 4 hours | 7 days |
| P4 — Low | Minor issue; enhancement request | 24 hours | 30 days |

## 3. Data Durability

| Metric | Target | Method |
|--------|--------|--------|
| Recovery Point Objective (RPO) | < 5 minutes | Supabase Point-in-Time Recovery |
| Recovery Time Objective (RTO) | < 1 hour | Automated redeployment from GitHub |
| Data retention | Per Data Retention Policy | Category-specific (90 days to 7 years) |
| Backup frequency | Continuous (WAL streaming) | Supabase managed |

## 4. Monitoring

- **Uptime monitoring:** UptimeRobot (5-minute intervals)
- **Health check:** https://www.evenfalladvantage.com/overwatch/health/
- **Error tracking:** Built-in error_logs table (30-day retention)
- **Security scanning:** Dependabot (weekly), CodeQL (weekly)

## 5. Maintenance Windows

- **Preferred:** Sundays 2:00 AM — 6:00 AM MST
- **Notification:** 24 hours advance notice via Briefing
- **Emergency maintenance:** May occur without advance notice for P1 security issues

## 6. Review

This SLA is reviewed annually and updated based on platform performance data.

---

**Approved by:** James Ferguson, CTO
**Date:** April 6, 2026
