# Backup & Recovery Drill — Q2 2026

**Date:** April 6, 2026
**Conductor:** James Ferguson, CTO

---

> **Correction (October 9, 2026):** Parts of this report were inaccurate and have been corrected below. The GitHub Actions backup workflow described here **never completed a successful run**: all 146 scheduled runs (April 7 to August 28, 2026) failed before producing a dump, and **no backup files were ever committed to the repository or uploaded as artifacts**. The workflow has been removed. The organization has since moved to the Supabase Pro plan.
>
> Current backup posture (as of October 9, 2026):
>
> - **Supabase Pro daily backups.** Supabase takes an automatic daily **physical** backup of each project (OverwatchDB and EADB) and keeps the **last 7 days**. They can be restored from the Dashboard (in place, or to a new project) but are **not downloadable**, and they **do not include Supabase Storage files** (only the file metadata rows).
> - **Point-in-Time Recovery (PITR) is NOT enabled** on either project.
> - **No off-site backup exists yet.** An encrypted off-site logical backup is planned. The former GitHub Actions `backup.yml` workflow never completed a successful run and has been removed.
> - **RPO: up to 24 hours** (time since the last daily backup). Deleting a Supabase project also deletes its backups.

## 1. Objective

Verify the platform's backup and recovery capabilities.

## 2. Pre-Drill State

| Table | Record Count |
|-------|-------------|
| companies | 5 |
| users | 11 |
| timesheets | 31 |
| events | 4 |
| company_memberships | 18 |

## 3. Finding: PITR Not Available on Free Tier

**Discovery:** Supabase Point-in-Time Recovery (PITR) requires the Pro plan ($25/mo minimum, $100/mo for PITR add-on). The current free tier does not include any managed backup capability (no PITR, no scheduled backups).

**Impact:** The Business Continuity Plan's RPO of "< 5 minutes" was inaccurate for the free tier.

**Immediate Remediation (attempted):**
- Created a GitHub Actions workflow (`backup.yml`) intended to run `pg_dump` daily at 6:00 AM UTC and upload the dump as a 30-day workflow artifact (not committed to the repository)
- **Outcome:** the workflow never succeeded (the configured database URL was IPv6-only and unreachable from GitHub runners) and has been removed. Workflow artifacts in a public repository would also have been downloadable by any signed-in GitHub user, so this approach is not being revived.

**Corrected RPO:** up to 24 hours (Supabase Pro daily backups; PITR not enabled)
**RTO:** < 1 hour target, not yet measured by a restore test

## 4. Test Marker Verification

- Test marker post inserted at **1:50 PM MST** on April 6, 2026
- Marker content: `PITR DRILL MARKER — DELETE AFTER DRILL`
- Marker successfully deleted via SQL: `DELETE FROM posts WHERE content LIKE '%PITR DRILL MARKER%'`
- Post-deletion counts verified: all tables match pre-drill state

## 5. Recovery Procedure (Updated)

### To restore from a Supabase daily backup:

1. Supabase Dashboard > the affected project > Database > Backups > Scheduled.
2. Pick the newest backup taken before the incident.
3. Either restore in place (the project is unavailable while it runs) or use "Restore to a new project" and copy the needed rows back.
4. Storage files are not included in database backups and must be handled separately.

### To manually create a logical backup (anytime):

Use the IPv4 Session pooler connection string from Dashboard > Connect and a Postgres 17 client, and **never store the dump in this public repository**:

```bash
pg_dump "postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[POOLER-HOST]:5432/postgres" \
  --no-owner --no-privileges --format=custom \
  --file="overwatch-manual-$(date +%Y-%m-%d).dump"
```

## 6. Recommendations

| Priority | Recommendation | Status |
|----------|---------------|--------|
| High | Upgrade to Supabase Pro ($25/mo) for daily managed backups | Done (Pro plan active) |
| High | Add PITR add-on ($100/mo) for < 5 min RPO | Future consideration |
| Medium | Test a full restore quarterly (Supabase backup restored to a new project) | Not yet done |
| Medium | Encrypted off-site logical backup (private storage, never this public repo) | Planned |

## 7. Sign-off

| Name | Role | Date |
|------|------|------|
| James Ferguson | CTO | April 6, 2026 |

---

**Next Drill:** Q3 2026
