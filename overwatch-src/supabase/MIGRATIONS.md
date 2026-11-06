# Migrations: what is applied where

Checked read-only against both projects on 2026-10-06.

| File | Project | Status |
| --- | --- | --- |
| `migrations/00000000000000_initial_schema.sql` | OverwatchDB | Placeholder (`SELECT 'Migration placeholder…'`). Not in the remote history. The real schema predates the CLI and lives in `../prisma/*.sql`. |
| `migrations/20261006175319_rls_hardening.sql` | OverwatchDB `nneueuvyeohwnspbwfub` | **Applied** 2026-10-06 10:53 PT (PR #45), version `20261006175319`. |
| `migrations/rollback/20261006175319_rls_hardening.rollback.sql` | OverwatchDB | Manual rollback; never run. Not scanned by the CLI. |
| `migrations/eadb/*.sql` | Legacy EADB `vaagvairvwmgyzsmymhs` | **Held / not applied.** Not scanned by the CLI for this project. |
| `migrations/20261017184312_training_eadb_consolidation.sql` | OverwatchDB | **Applied** 2026-10-17 11:43 PT (PR #85), version `20261017184312`. EADB retirement phase 1. Test: `tests/training_eadb_consolidation_rolledback_test.sql`. Rollback: `rollback/20261017184312_training_eadb_consolidation.rollback.sql`. |
| `migrations/20261017202341_training_cutover.sql` | OverwatchDB | **Applied** 2026-10-17 13:23 PT (PR #86), version `20261017202341`. EADB retirement phase 6. Moves inline quiz answers to `training_quiz_answer_keys`, blocks inline answers (CHECK), training writes need `training_can_manage`, quiz attempts only via `grade_training_quiz` (404/403 instead of 500), Instructor HQ RPCs, class scoping (instructors and managers: own classes and rosters only; owners and admins: all). Must be applied **before** the phase 6 app deploy. Test: `tests/training_cutover_rolledback_test.sql` (build with `tests/build_training_cutover_test.sh`). Rollback: `rollback/20261017202341_training_cutover.rollback.sql`. |
| `migrations/20261017202346_remove_duplicate_empty_courses.sql` | OverwatchDB | **Applied** 2026-10-17 13:23 PT (PR #86), version `20261017202346`. Deleted the 3 empty duplicate course shells (guarded); EADB prices kept by decision. Rollback re-inserts the exact rows. |
| `migrations/20261017230420_roster_invitation_expiry_24h.sql` | OverwatchDB | **Applied** 2026-10-17 16:04 PT (PR #88), version `20261017230420`. `upsert_roster_invitation` sets `roster_invitations.expires_at` to now() + 24 hours instead of 7 days, to match the invite email (roster-invite v13). Test: `tests/roster_invitation_expiry_24h_rolledback_test.sql`. Rollback: `rollback/20261017230420_roster_invitation_expiry_24h.rollback.sql`. |
| `migrations/20261017232039_integration_framework.sql` | OverwatchDB | **Applied** 2026-10-17 16:20 PT (PR #69), version `20261017232039`. Vendor integration framework: `integration_connections`, `integration_oauth_states`, `integration_events`, `integration_jobs`, `employee_external_ids` (RLS on; owners/admins manage, managers read-only, anon nothing) and service-role-only RPCs. Test: `tests/integration_framework_live_check.sql` (29 checks, rolled back). Rollback: `rollback/20261017232039_integration_framework.rollback.sql`. |
| `migrations/20261018004108_integration_cron_secret_vault.sql` | OverwatchDB | **Applied** 2026-10-17 17:41 PT, version `20261018004108`. Generates the Vault secret `integrations_cron_secret` in-database (never exported) and adds `integration_cron_secret_matches(text)` (SECURITY DEFINER, empty search_path, service_role only, sha256 compare). Replaces the `INTEGRATIONS_CRON_SECRET` Edge secret. Rollback: `rollback/20261018004108_integration_cron_secret_vault.rollback.sql` (roll back integration_cron first). |
| `migrations/20261018004232_integration_cron.sql` | OverwatchDB | **Applied** 2026-10-17 17:42 PT, version `20261018004232`. pg_cron jobs `integration-token-refresh` (*/10), `integration-jobs-worker` (every minute), `integration-oauth-state-purge` (03:17) via `integration_cron_call()` (service_role only), sending the Vault-only secret. Rollback: `rollback/20261018004232_integration_cron.rollback.sql`. |
| `migrations/20261106223000_airtable_roster_reconcile.sql` | OverwatchDB | **Applied.** Live `schema_migrations` version `20261106204456`, name `20261106223000_airtable_roster_reconcile` (metadata read 2026-11-06; no user or auth rows were read or written). `pg_get_functiondef` of `apply_airtable_roster_sync(uuid, text, text, jsonb)` matches this file: five per-row handlers (create, attach, link, update, remove) and the removal holdback after an earlier write failure. `users_phone_key` is a btree unique index on `users.phone`. The helpers in `20261106234500` are not in this function. Rollback: `rollback/20261106223000_airtable_roster_reconcile.rollback.sql`. |
| `migrations/20261106234500_airtable_roster_phone_conflict.sql` | OverwatchDB | **NOT APPLIED.** Production does not have `airtable_roster_phone_to_store` or `airtable_roster_failure_text`. Do not run from CI or a deploy. Replaces `apply_airtable_roster_sync` so a duplicate digit-string phone fails only that row. Comparison strips non-digits only: it does not fold country codes or extensions. Phone locks are sorted `try_lock`s, not blocking locks. Blank phones stay NULL. Does not drop `users_phone_key` and does not update existing rows. The existence check can scan `users` once per phone (no expression index). A warm local lookup of that expression over 4000 users measured 0.951 ms, so a 1000-phone plan is about a second of scan time on that fixture before the rest of the function. Apply by hand after review. Rollback: `rollback/20261106234500_airtable_roster_phone_conflict.rollback.sql`. |

## Why the rename

The RLS migration was drafted as `20261006120000_rls_hardening.sql`. It was
applied with a tool that records the **apply time** as the version
(`20261006175319`), as Supabase MCP `apply_migration` and the dashboard do. With the old file name,
`supabase db push` / `supabase migration list` would see a remote version with
no local file and a local file that was never applied, and `db push` would
try to run the whole migration a second time.

The file is now named after the applied version. Its SQL is unchanged apart
from the header comment (the md5 of the applied statement matches the
original file).

## If you use the Supabase CLI against OverwatchDB

`supabase migration list --linked` should show `20261006175319` on both sides.
The placeholder `00000000000000` will show as local-only. It is harmless (a
single `SELECT`), but to keep `db push` from recording it later you can mark
it as applied without running it:

```bash
supabase link --project-ref nneueuvyeohwnspbwfub
supabase migration repair --status applied 00000000000000
```

`migration repair` only edits `supabase_migrations.schema_migrations`; it does
not run any SQL. Alternative to the rename (not needed now): keep the old file
name and run `supabase migration repair --status reverted 20261006175319` plus
`--status applied 20261006120000`.

## Going forward

Prefer `supabase migration new <name>` + `supabase db push`, so the file name
and the recorded version are the same. If you apply through MCP
`apply_migration`, rename the file to the version it reports afterwards.
