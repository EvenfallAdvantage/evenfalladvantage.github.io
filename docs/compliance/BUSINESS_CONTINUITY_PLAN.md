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
| Supabase database (OverwatchDB) | ≤ 24 hrs (Supabase daily backup) | < 1 hour (target, not yet measured) | P1 |
| User authentication (Supabase Auth) | 0 (managed) | < 15 min | P1 |
| File storage (Supabase Storage) | No backup (not covered by Supabase database backups) | < 1 hour | P2 |
| Payment processing (Stripe) | 0 (managed) | N/A (external) | P2 |
| Email delivery (Resend) | 0 (managed) | N/A (external) | P3 |
| Legacy training DB (EADB) | ≤ 24 hrs (Supabase daily backup) | < 2 hours | P3 |

**RPO** = Recovery Point Objective (max data loss)
**RTO** = Recovery Time Objective (max downtime)

Current backup posture (as of October 9, 2026):

- **Supabase Pro daily backups.** Supabase takes an automatic daily **physical** backup of each project (OverwatchDB and EADB) and keeps the **last 7 days**. They can be restored from the Dashboard (in place, or to a new project) but are **not downloadable**, and they **do not include Supabase Storage files** (only the file metadata rows).
- **Point-in-Time Recovery (PITR) is NOT enabled** on either project.
- **No off-site backup exists yet.** An encrypted off-site logical backup is planned. The former GitHub Actions `backup.yml` workflow never completed a successful run and has been removed.
- **RPO: up to 24 hours** (time since the last daily backup). Deleting a Supabase project also deletes its backups.

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
  2. Restore the most recent Supabase daily backup taken before the corruption (Database > Backups). Prefer "Restore to a new project" and copy back affected rows when only part of the data is damaged; an in-place restore makes the project unavailable while it runs
  3. Verify data integrity after restore
  4. Investigate root cause
- **RPO:** up to 24 hours (Supabase daily backups; PITR is not enabled)

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

### 5.2 Database Restore (Supabase daily backup)
```
1. Log in to Supabase Dashboard and open the affected project
2. Navigate to Database > Backups > Scheduled
3. Choose the newest daily backup taken before the incident
   (or use "Restore to a new project" to recover data without downtime)
4. Confirm restore (project is unavailable while an in-place restore runs)
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
- **Quarterly:** Verify backup restoration works (restore the latest Supabase daily backup to a new project, compare row counts, then delete the copy)
- **Monthly:** Review UptimeRobot reports for patterns

## 7. Review

This plan is reviewed annually or after any significant incident.

---

**Approved by:** James Ferguson, CTO
**Date:** April 6, 2026
