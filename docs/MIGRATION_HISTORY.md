# OverwatchDB migration history: repo ↔ database

**Source of truth:** `supabase_migrations.schema_migrations` on OverwatchDB (`nneueuvyeohwnspbwfub`).

## Why they drifted
Migrations are applied through the Supabase `apply_migration` API, which records the version as **the time it was applied**, not the timestamp in the file name. Twenty-eight files were applied but kept their authoring timestamps, so `supabase db push` / `migration list` would treat them as unapplied and re-run them.

## Repair (Oct 22, 2026), files only, no database change
- Checked read-only against the live history: 42 recorded versions, 42 repo files.
- **28 files renamed** to their recorded versions (and their rollback files). Content was compared after stripping comments and whitespace: every file matches the recorded statements. The only difference is the `BEGIN;`/`COMMIT;` wrapper in the repo copy, which the API strips.
- **1 missing file added:** `20261017185422_eadb_import_staging_training_media.sql`, copied verbatim from the recorded statements. It was applied in EADB retirement phase 3 but never committed.
- References in docs, tests and code comments were updated to the new versions.
- `00000000000000_initial_schema.sql` is the pre-history baseline. The database's history starts at `20261006175319` because everything before it was applied outside the migration tool. Leave it unrecorded. Optional (a database write, needs approval): `supabase migration repair --status applied 00000000000000`.

## Rule going forward
After `apply_migration`, rename the file to the version it reports (`list_migrations`) in the same PR. Re-check with the query in `overwatch-src/supabase/tests/migration_history_check.sql`.
