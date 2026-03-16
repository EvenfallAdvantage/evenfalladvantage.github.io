# Legacy DB Merge Plan

## Current State

Two Supabase instances:

- **Overwatch** (`nneueuvyeohwnspbwfub`) — Primary platform DB
- **Legacy** (`vaagvairvwmgyzsmymhs`) — Student/instructor portals

Currently connected via `legacy-bridge.ts` (read-only cross-DB service).

## Goal

Consolidate into a single Overwatch Supabase instance, retiring the legacy DB.

## Phase 1: Data Audit (Current)

### Legacy tables to migrate

| Table | Row estimate | Target in Overwatch |
|---|---|---|
| `students` + `student_profiles` | ~200 | `users` (merge by email) |
| `instructors` | ~10 | `users` + `company_memberships` (role=manager) |
| `administrators` | ~5 | `users` + `company_memberships` (role=admin) |
| `training_modules` | ~20 | `training_modules` (already exists) |
| `module_slides` | ~200 | `module_slides` (already exists) |
| `student_module_progress` | ~500 | `student_module_progress` (already exists) |
| `assessments` + `assessment_results` | ~100 | `quizzes` + `quiz_attempts` |
| `certificates` | ~50 | `certifications` |
| `courses` + `course_modules` | ~5 | `courses` (already exists) |
| `student_course_enrollments` | ~100 | New: `course_enrollments` |
| `payment_transactions` | ~50 | `payment_transactions` (already exists) |
| `scheduled_classes` + `class_enrollments` | ~20 | `events` + `shifts` |
| `activity_log` | ~1000 | `audit_logs` (append) |
| `clients` | ~10 | `companies` (map) |

### Identity merge strategy

1. Match legacy `students.email` → Overwatch `users.email`
2. For matched users: link via `legacy_account_links` table
3. For unmatched: create Overwatch user records (no auth — invite-only)
4. Preserve legacy IDs in `legacy_account_links.legacy_id`

## Phase 2: Migration Script

Create `prisma/legacy-merge.sql` that:

1. Connects to legacy DB via `postgres_fdw` or runs as a Node script
2. For each legacy table:
   - SELECT all rows from legacy
   - Transform column names to Overwatch schema
   - INSERT into Overwatch tables with conflict handling
   - Log each migration in `legacy_sync_log`

### Recommended approach: Node migration script

Since both DBs are accessible via Supabase JS client, a Node script is simpler than `postgres_fdw`:

```
scripts/migrate-legacy.ts
├── connectBothClients()
├── migrateUsers()        — students + instructors + admins → users
├── migrateModules()      — training_modules + slides → training_modules + module_slides
├── migrateProgress()     — student_module_progress → student_module_progress
├── migrateAssessments()  — assessments + results → quizzes + quiz_attempts
├── migrateCerts()        — certificates → certifications
├── migrateCourses()      — courses + enrollments → courses + course_enrollments
├── migrateClasses()      — scheduled_classes → events + shifts
├── migratePayments()     — payment_transactions → payment_transactions
└── generateReport()      — summary of migrated/skipped/errored rows
```

### Conflict resolution

- **Duplicate emails:** Merge into existing Overwatch user, keep latest profile data
- **Duplicate modules:** Match by `module_code`, update if newer
- **Duplicate certs:** Skip if `certificate_number` already exists
- **ID mapping:** Store `{legacy_id → overwatch_id}` map in memory during migration

## Phase 3: Legacy Bridge Cutover

1. Run migration script (Phase 2)
2. Verify row counts match expectations
3. Update `legacy-bridge.ts` functions to read from Overwatch DB instead of legacy
4. Deploy and test all Academy Hub features
5. Add deprecation warning to legacy portal login pages
6. Monitor for 2 weeks

## Phase 4: Legacy Sunset

1. Set legacy portal login pages to redirect → `/overwatch/academy`
2. Disable legacy Supabase write access (revoke anon key insert/update)
3. Keep legacy DB in read-only mode for 90 days (audit trail)
4. After 90 days: export final backup, delete legacy Supabase project

## Multi-Region Health Checks

The `/admin/health` page now monitors:

- **Overwatch Supabase Auth** — Session connectivity
- **Overwatch PostgREST** — Database query latency
- **Legacy Supabase** — Training DB availability
- **Static Assets (CDN)** — GitHub Pages delivery

### Future enhancements

- Add Stripe API health check
- Add periodic auto-refresh (every 60s)
- Add historical latency tracking (store in `health_checks` table)
- Alert notification when service degrades (push to Comms channel)

## Timeline Estimate

| Phase | Effort | Dependency |
|---|---|---|
| Phase 1 (Audit) | Done | — |
| Phase 2 (Migration script) | 2-3 hours | Phase 1 |
| Phase 3 (Cutover) | 1 hour | Phase 2 + testing |
| Phase 4 (Sunset) | 30 min | Phase 3 + 2-week soak |

## Risks

- **Data loss:** Mitigated by keeping legacy DB read-only for 90 days post-merge
- **Auth mismatch:** Legacy students may not have Overwatch auth accounts — handled by invite flow
- **Foreign key conflicts:** Migration script uses UUID generation for new rows, preserves legacy IDs in link table
- **Downtime:** Zero downtime — migration runs alongside live system, cutover is a config change
