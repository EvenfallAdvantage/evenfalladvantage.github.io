# Backup restore test — October 21, 2026

**Project:** OverwatchDB (ref `nneueuvyeohwnspbwfub`), Supabase Pro, us-east-1, Postgres 17.6.1, about 64 MB.
**Method:** logical restore into an isolated local Postgres 17 on the ops box. Production was only read; nothing was written, paused or reconfigured.

## Steps
1. Created a stub for the Supabase platform (roles `anon`/`authenticated`/`service_role`, `auth.uid()/jwt()/role()` driven by `request.jwt.claims`, `extensions` with uuid-ossp and pgcrypto).
2. Generated DDL from the production catalog (tables, constraints, functions, policies, triggers, grants) and loaded it with **0 errors**.
3. Exported every `public` table as JSON and loaded it (generated columns such as `cctv_cameras.pt` were excluded).
4. Compared object and row counts, then replayed RLS as a real member (ZZTEST Field QA, aal1) and as anon.

## Results
| Check | Production | Restored |
|---|---|---|
| Tables (RLS on) | 125 (125) | 125 (125) |
| Policies / functions / triggers / FKs | 383 / 107 / 24 / 260 | identical |
| Rows | 58,926 | 58,820 (only `ships` differs: 25,570 vs 25,464. It is a live AIS feed that grew during the export) |
| RLS as ZZTEST: users / memberships / companies / shifts / audit_logs / applicants | 1/1/1/1/50/0 | identical |
| RLS as anon | 0 rows | 0 rows |

**Recovery time for a logical restore:** about 15 minutes of hands-on work for this data size.

## Not covered (gaps)
- `auth.users` (password hashes), Storage objects, Vault secrets and `pg_cron` jobs were not restored. A real disaster restore relies on Supabase's physical backups for these.
- Supabase **"Restore to new project"** (a binary clone of a daily backup) was not run. It needs physical backups enabled, creates a **billed** project (Supabase shows the cost before you start), and starts pg_cron/pg_net jobs immediately. Pause the cron jobs and outbound webhooks in the clone before any test. **PITR** is a paid add-on (needs at least Small compute).

## Recommendations
1. Run a "restore to new project" drill each quarter (needs owner approval for the cost), with cron disabled in the clone.
2. Decide on RPO: daily backups (Pro, 7-day retention) vs PITR.
3. Store the vault secret names and cron definitions in the repo (without values) so they can be rebuilt.

## Data handling
The restored copy contained production PII. After this report the local cluster was stopped and `/workspace/restore` was **deleted** (data dir, exports and dumps).
