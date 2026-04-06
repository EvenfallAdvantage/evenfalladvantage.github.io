# Backup & Recovery Drill — Q2 2026

**Date:** April 6, 2026
**Conductor:** James Ferguson, CTO

---

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

**Immediate Remediation:**
- Created automated daily database backup via GitHub Actions (`backup.yml`)
- Uses `pg_dump` to export the full database to a `.dump` file
- Runs daily at 6:00 AM UTC
- Retains last 30 days of backups
- Backup files committed to the repository

**Updated RPO:** < 24 hours (daily export cycle)
**Updated RTO:** < 1 hour (restore from dump file)

## 4. Test Marker Verification

- Test marker post inserted at **1:50 PM MST** on April 6, 2026
- Marker content: `PITR DRILL MARKER — DELETE AFTER DRILL`
- Marker successfully deleted via SQL: `DELETE FROM posts WHERE content LIKE '%PITR DRILL MARKER%'`
- Post-deletion counts verified: all tables match pre-drill state

## 5. Recovery Procedure (Updated)

### To restore from a daily backup:

```bash
# 1. Download the latest backup from the repository
git pull origin main
ls backups/  # find the most recent .dump file

# 2. Get the database connection string from Supabase Dashboard
# Settings → Database → Connection string → URI

# 3. Restore
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  backups/overwatch-YYYY-MM-DD.dump
```

### To manually create a backup (anytime):

```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  --no-owner --no-privileges --clean --if-exists \
  --format=custom --file="backups/overwatch-manual-$(date +%Y-%m-%d).dump"
```

## 6. Recommendations

| Priority | Recommendation | Status |
|----------|---------------|--------|
| High | Upgrade to Supabase Pro ($25/mo) for daily managed backups | Pending budget approval |
| High | Add PITR add-on ($100/mo) for < 5 min RPO | Future consideration |
| Medium | Test full restore from .dump file quarterly | Scheduled for Q3 2026 |
| Low | Consider secondary backup to S3/R2 for geographic redundancy | Future consideration |

## 7. Sign-off

| Name | Role | Date |
|------|------|------|
| James Ferguson | CTO | April 6, 2026 |

---

**Next Drill:** Q3 2026
