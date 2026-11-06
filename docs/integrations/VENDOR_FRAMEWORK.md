# Vendor integration framework (PR V0)

Server-side framework every vendor adapter (Fillout, WhatsApp, DocuSign, QuickBooks,
Checkr, Gusto, Paychex, ADP) plugs into. Plan: `VENDOR_INTEGRATIONS_PLAN.md` §1 and §5.

## Pieces

| Piece | Where |
|---|---|
| Tables + RLS + RPCs | `overwatch-src/supabase/migrations/20261017232039_integration_framework.sql` (+ rollback) |
| Schedules (optional) | `…/20261018004232_integration_cron.sql` (pg_cron + pg_net, + rollback) |
| Adapter interface | `supabase/functions/_shared/integrations/types.ts` |
| Registry (vendor PRs add one line) | `…/_shared/integrations/registry.ts` |
| Vault storage, refresh lease, `withFreshToken` | `…/_shared/integrations/connections.ts` (uses PR #63 `vault_*` RPCs) |
| Fail-closed webhook pipeline | `…/_shared/integrations/webhook-core.ts` |
| `vendorFetch` (timeout, 429/5xx retry, Retry-After) | `…/_shared/integrations/vendor-fetch.ts` |
| Mock adapter + recorded fixtures + tests | `…/_shared/integrations/mock.ts`, `fixtures/`, `integrations_test.ts` |
| Edge Functions | `integration-oauth-start`, `integration-oauth-callback`, `integration-token-refresh`, `integration-webhook`, `integration-action`, `integration-jobs-worker` |
| HQ Config | `connection-cards.tsx`, `integration-health-strip.tsx`, `lib/integrations/connections.ts` |
| Custom-domain proxy | `supabase/proxy/integrations-proxy.worker.js` |

Removed (never deployed, failed open): `oauth-refresh`, `webhook-checkr`, `webhook-fillout`.

## URLs

`INTEGRATIONS_PUBLIC_BASE` unset → `https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/integration-oauth-callback/<provider>` and `…/integration-webhook/<provider>`.
Set to `https://api.evenfalladvantage.com/integrations` → `…/oauth/callback/<provider>` and `…/webhook/<provider>` (needs the Worker + DNS). Register the URL that is active with each vendor.

## Secrets (Edge Function secrets on OverwatchDB; the user sets them, never in chat)

| Secret | Needed for |
|---|---|
| (none, Vault only) | token-refresh + jobs-worker check `x-integrations-cron-secret` against Vault `integrations_cron_secret` via `integration_cron_secret_matches()`; the value is generated in-database and never exported. |
| `OVERWATCH_APP_URL` | post-OAuth redirect (default `https://www.evenfalladvantage.com/overwatch`) |
| `INTEGRATIONS_PUBLIC_BASE` | only once the custom domain is live |
| `INTEGRATIONS_ENABLE_MOCK` | leave unset in production |
| per-vendor client ids/secrets | added by each vendor PR (plan §1.5) |

Airtable is the first real adapter (`_shared/integrations/airtable.ts`). Its redirect is pinned to
`https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/integration-oauth-callback/airtable`
and does not follow `INTEGRATIONS_PUBLIC_BASE`. Scopes stay read-only: `schema.bases:read`, `data.records:read`, and `user.email:read`. There is one OAuth grant per company. Do not start a second consent flow for Roster or Events.

## Airtable roster and events

Migration `overwatch-src/supabase/migrations/20261106203000_airtable_roster_events.sql` is additive. Apply it on OverwatchDB only, before relying on Roster or Events saves. It does not read Vault or rewrite applicant rows. Roll back with the sibling file under `migrations/rollback/`.

Deploy order:

1. Apply the migration.
2. Deploy the `integration-action` Edge Function (it hosts the new actions). OAuth start, callback, and token refresh keep the existing read scopes.
3. Deploy the frontend. HQ Config → Integrations lists every authorized table after Load bases. A saved table is the selection, not the option list.

Applicants keep the reviewed import and the original name/email reader. That path does not require a field mapping. Saving Applicants does not change the Roster or Events table.

Roster and Ops Planning each save a base and table, then a confirmed field mapping stored in `airtable_field_mappings` for that company, purpose, base, and table. Same-name suggestions are not saved. The first sync stays disabled until an owner or admin confirms the mapping. Sync is explicit, capped, and does not poll. Airtable is not written.

Roster links use `employee_external_ids` (`provider = airtable`). New people are created as `staff` through `create_roster_member`. Owner and admin memberships are not created, demoted, deactivated, or deleted. Email can attach one unlinked non-protected person when it matches exactly one roster row. It never decides between two people. Repeated syncs upsert on company + Airtable record id. People missing from Airtable stay on the roster and are reported.

Events are created as `draft` and updated only when the Airtable record id and the last synced field hash still match. Manually owned operations (no Airtable id) are not matched by title and are not deleted. Date-only values are stored as UTC start-of-day and end-of-day. Date-time values keep the instant Airtable sent.

Supported destinations (no role, status, pay, or approval column exists):

| Purpose | Field | Required | Airtable types | Writes |
|---|---|---|---|---|
| Roster | First name | yes | singleLineText, multilineText | users.first_name |
| Roster | Last name | no | singleLineText, multilineText | users.last_name |
| Roster | Email | yes | email, singleLineText | match and create only |
| Roster | Phone | no | phoneNumber, singleLineText | users.phone |
| Roster | Title | no | singleLineText, multilineText, singleSelect | membership title |
| Events | Title | yes | singleLineText, multilineText, singleSelect | events.name |
| Events | Start | yes | date, dateTime | events.start_date |
| Events | End | yes | date, dateTime | events.end_date |
| Events | Location | no | singleLineText, multilineText, singleSelect | events.location |
| Events | Notes | no | singleLineText, multilineText, richText | events.notes |

Preview reports a missing required mapping, a source type that is not in that list, a select value outside the table's choices, and an email, phone, or date the destination cannot store. Other columns are shown as unmapped and are not imported.

Do not run a sync against a customer's live table from CI. Synthetic fixture tests cover the planner. A live check is an owner preview in the product after Test connection. One sync reads at most 300 Airtable records and considers at most 2000 local roster or operation rows. A partial read is reported and does not delete anyone.

## Adding a vendor (V1–V9)

1. `_shared/integrations/<provider>.ts` implementing `VendorAdapter`, plus `<provider>_test.ts` replaying recorded fixtures.
2. One line in `registry.ts`.
3. One entry in `FRAMEWORK_PROVIDERS` (`lib/integrations/connections.ts`) and drop the legacy "Not available yet" tile.
4. Vendor-specific actions/jobs and feature surfaces (Applicants, Timesheets, notify-send).
