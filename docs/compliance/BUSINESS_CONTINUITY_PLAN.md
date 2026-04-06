# Business Continuity Plan

**Evenfall Advantage LLC — Overwatch Platform**
**Effective Date:** April 6, 2026
**Owner:** James Ferguson, CTO
**Classification:** Internal

---

## 1. Purpose

This plan ensures the Overwatch platform can maintain or rapidly restore critical operations following a disruptive event.

## 2. Critical Services

| Service | RPO | RTO | Priority |
|---------|-----|-----|----------|
| Overwatch web application | 0 (static site) | < 30 min | P1 |
| Supabase database (OverwatchDB) | < 24 hrs (daily export) | < 1 hour | P1 |
| User authentication (Supabase Auth) | 0 (managed) | < 15 min | P1 |
| File storage (Supabase Storage) | < 5 min | < 1 hour | P2 |
| Payment processing (Stripe) | 0 (managed) | N/A (external) | P2 |
| Email delivery (Resend) | 0 (managed) | N/A (external) | P3 |
| Legacy training DB (EADB) | < 24 hrs (daily export) | < 2 hours | P3 |

**RPO** = Recovery Point Objective (max data loss)
**RTO** = Recovery Time Objective (max downtime)

## 3. Disaster Scenarios and Response

### 3.1 GitHub Pages Outage
- **Detection:** UptimeRobot alert
- **Impact:** All users unable to access Overwatch
- **Response:** Monitor GitHub Status page; no action needed (GitHub resolves)
- **Fallback:** If prolonged (> 4 hours), deploy to alternative hosting (Vercel/Netlify)

### 3.2 Supabase Outage
- **Detection:** Health check page shows DEGRADED; UptimeRobot alert
- **Impact:** Users can't authenticate, load data, or perform operations
- **Response:** Monitor Supabase Status page; contact Supabase support
- **Fallback:** Service worker provides offline fallback UI; operations resume when Supabase recovers

### 3.3 Database Corruption / Data Loss
- **Detection:** Application errors; user reports; error_logs table
- **Impact:** Data integrity compromised
- **Response:**
  1. Assess scope of corruption
  2. Use Supabase PITR to restore to point before corruption
  3. Verify data integrity after restore
  4. Investigate root cause
- **RPO:** < 5 minutes (Supabase PITR)

### 3.4 Source Code Loss
- **Detection:** GitHub repo inaccessible or deleted
- **Impact:** Cannot deploy updates
- **Response:** Restore from local clone (all developers have full repo history)
- **RPO:** 0 (distributed git)

### 3.5 Domain / DNS Issues
- **Detection:** UptimeRobot alert; user reports
- **Response:** Check domain registrar; update DNS if needed
- **Fallback:** Users can access via evenfalladvantage.github.io directly

### 3.6 Key Personnel Unavailability
- **Impact:** CTO/lead developer unavailable
- **Response:** Documented procedures allow other team members to:
  - Deploy via GitHub Actions (automated)
  - Access Supabase Dashboard (with proper credentials)
  - Follow Incident Response Plan
- **Mitigation:** All procedures documented in compliance docs; no single point of failure for deployments

## 4. Communication Plan

| Audience | Method | Trigger | Owner |
|----------|--------|---------|-------|
| Internal team | Overwatch Briefing (pinned + alert) | Any P1/P2 event | CTO |
| Customers | Email + Briefing | Outage > 30 min | CTO/Operations |
| Regulatory | Email (if data breach) | Confirmed data breach | CTO/Legal |

## 5. Recovery Procedures

### 5.1 Full Redeployment
```
1. git clone https://github.com/EvenfallAdvantage/evenfalladvantage.github.io
2. cd overwatch-src && npm ci && npm run build
3. Deploy to GitHub Pages (push to main triggers automated deploy)
```

### 5.2 Database Restore (Supabase PITR)
```
1. Log in to Supabase Dashboard
2. Navigate to Database > Backups
3. Select point-in-time to restore to
4. Confirm restore
5. Verify application functionality
6. Check error_logs for any post-restore issues
```

### 5.3 Edge Function Redeployment
```
1. npx supabase link --project-ref vaagvairvwmgyzsmymhs
2. npx supabase functions deploy send-email
3. npx supabase functions deploy create-student
4. npx supabase functions deploy delete-student
5. npx supabase functions deploy process-course-payment
6. npx supabase functions deploy send-welcome-email
7. npx supabase functions deploy create-checkout-session
```

## 6. Testing

- **Annual:** Full BCP tabletop exercise simulating a P1 scenario
- **Quarterly:** Verify backup restoration works (Supabase PITR test)
- **Monthly:** Review UptimeRobot reports for patterns

## 7. Review

This plan is reviewed annually or after any significant incident.

---

**Approved by:** James Ferguson, CTO
**Date:** April 6, 2026
