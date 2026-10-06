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
psql -v ON_ERROR_STOP=1 -d ow_rls_test -f migrations/20261006175319_rls_hardening.sql
psql -d ow_rls_test -f tests/rls_hardening_test_plan.sql   # prints PASS/FAIL per check
```

Results on 2026-10-06 (Postgres 17):

* After the migration: **121 passed, 0 failed**.
* Same plan before the migration (live policies): 52 passed, **69 failed**.
  Every failure is an attack path that is open today or a new flow that does
  not exist yet.
* `migrations/rollback/20261006175319_rls_hardening.rollback.sql` restores
  policies, function definitions, table grants, join codes and bucket flags
  identical to the pre-migration stub (diffed), and the migration re-applies
  cleanly after a rollback.
* EADB: migration and rollback apply cleanly; anon INSERT is denied, an
  authenticated student can insert only their own row; rollback restores
  policies and grants identically. Each file refuses to run on the other
  database (guard block).
