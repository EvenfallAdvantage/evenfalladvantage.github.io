# Migrations: what is applied where

Checked read-only against both projects on 2026-10-06.

| File | Project | Status |
| --- | --- | --- |
| `migrations/00000000000000_initial_schema.sql` | OverwatchDB | Placeholder (`SELECT 'Migration placeholder…'`). Not in the remote history. The real schema predates the CLI and lives in `../prisma/*.sql`. |
| `migrations/20261006175319_rls_hardening.sql` | OverwatchDB `nneueuvyeohwnspbwfub` | **Applied** 2026-10-06 10:53 PT (PR #45), version `20261006175319`. |
| `migrations/rollback/20261006175319_rls_hardening.rollback.sql` | OverwatchDB | Manual rollback; never run. Not scanned by the CLI. |
| `migrations/eadb/*.sql` | Legacy EADB `vaagvairvwmgyzsmymhs` | **Held / not applied.** Not scanned by the CLI for this project. |
| `migrations/20261017184312_training_eadb_consolidation.sql` | OverwatchDB | **Applied** 2026-10-17 11:43 PT (PR #85), version `20261017184312`. EADB retirement phase 1. Test: `tests/training_eadb_consolidation_rolledback_test.sql`. Rollback: `rollback/20261017184312_training_eadb_consolidation.rollback.sql`. |
| `migrations/20261017233000_training_cutover.sql` | OverwatchDB | **DRAFT, not applied** (EADB retirement phase 6 PR). Moves inline quiz answers to `training_quiz_answer_keys`, blocks inline answers (CHECK), training writes need `training_can_manage`, quiz attempts only via `grade_training_quiz` (404/403 instead of 500), Instructor HQ RPCs. Must be applied **before** the phase 6 app deploy. Test: `tests/training_cutover_rolledback_test.sql` (build with `tests/build_training_cutover_test.sh`). Rollback: `rollback/20261017233000_training_cutover.rollback.sql`. Rename to the applied version afterwards. |
| `migrations/20261017233100_remove_duplicate_empty_courses.sql` | OverwatchDB | **DRAFT, not applied.** Deletes the 3 empty duplicate course shells (guarded). Confirm the shells' prices first (see header). Rollback re-inserts the exact rows. |

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
