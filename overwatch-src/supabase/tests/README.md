# RLS hardening: local validation

Everything in this folder runs against a **throwaway local Postgres only**.
It creates roles, an `auth.uid()` stub and fake `storage` tables. Never point
it at a Supabase project.

| File | Purpose |
| --- | --- |
| `local_stub_schema.sql` | OverwatchDB tables, helper functions, RPCs and **live** policies touched by the migration (copied from `pg_policies` / `pg_get_functiondef` on 2026-10-06) |
| `rls_hardening_seed.sql` | Two fake companies, 14 fake people across every role, timesheets, audit rows, storage objects |
| `rls_hardening_test_plan.sql` | 121 role-impersonation checks (`SET ROLE authenticated` / `anon` plus `request.jwt.claims`) |
| `eadb_local_stub.sql` | Minimal legacy EADB tables and live anon policies for the EADB migration |

## Run (Postgres 15+)

```bash
createdb ow_rls_test
psql -v ON_ERROR_STOP=1 -d ow_rls_test -f tests/local_stub_schema.sql
psql -v ON_ERROR_STOP=1 -d ow_rls_test -f tests/rls_hardening_seed.sql
psql -v ON_ERROR_STOP=1 -d ow_rls_test -f migrations/20261006120000_rls_hardening.sql
psql -d ow_rls_test -f tests/rls_hardening_test_plan.sql   # prints PASS/FAIL per check
```

Results on 2026-10-06 (Postgres 17):

* After the migration: **121 passed, 0 failed**.
* Same plan before the migration (live policies): 52 passed, **69 failed**.
  Every failure is an attack path that is open today or a new flow that does
  not exist yet.
* `migrations/rollback/20261006120000_rls_hardening.rollback.sql` restores
  policies, function definitions, table grants, join codes and bucket flags
  identical to the pre-migration stub (diffed), and the migration re-applies
  cleanly after a rollback.
* EADB: migration and rollback apply cleanly; anon INSERT is denied, an
  authenticated student can insert only their own row; rollback restores
  policies and grants identically. Each file refuses to run on the other
  database (guard block).

## Intake tokens RLS (`20261006200000_intake_tokens_rls.sql`, draft)

`intake_tokens_rls_test.sql` adds a stub `client_intake_tokens` table with the
live policies (phase `stub`) and runs 28 checks (phase `test`). Run it after
the three commands above:

```bash
psql -d ow_rls_test -v phase=stub -f tests/intake_tokens_rls_test.sql
psql -d ow_rls_test -f migrations/20261006200000_intake_tokens_rls.sql
psql -d ow_rls_test -v phase=test -f tests/intake_tokens_rls_test.sql
```

Results on 2026-10-06 (Postgres 17): **28 passed, 0 failed** after the
migration; 7 passed, 21 failed with today's live policies (anon can list and
edit every row; any signed-in user can read, insert and delete across
companies). The rollback restores policies and grants identically (diffed) and
the migration re-applies cleanly after it.
