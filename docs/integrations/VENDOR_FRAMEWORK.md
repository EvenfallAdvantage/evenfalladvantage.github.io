# Vendor integration framework (PR V0)

Server-side framework every vendor adapter (Fillout, WhatsApp, DocuSign, QuickBooks,
Checkr, Gusto, Paychex, ADP) plugs into. Plan: `VENDOR_INTEGRATIONS_PLAN.md` §1 and §5.

## Pieces

| Piece | Where |
|---|---|
| Tables + RLS + RPCs | `overwatch-src/supabase/migrations/20261011000000_integration_framework.sql` (+ rollback) |
| Schedules (optional) | `…/20261011000100_integration_cron.sql` (pg_cron + pg_net, + rollback) |
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
| `INTEGRATIONS_CRON_SECRET` | token-refresh + jobs-worker (same value in Vault as `integrations_cron_secret`) |
| `OVERWATCH_APP_URL` | post-OAuth redirect (default `https://www.evenfalladvantage.com/overwatch`) |
| `INTEGRATIONS_PUBLIC_BASE` | only once the custom domain is live |
| `INTEGRATIONS_ENABLE_MOCK` | leave unset in production |
| per-vendor client ids/secrets | added by each vendor PR (plan §1.5) |

## Adding a vendor (V1–V9)

1. `_shared/integrations/<provider>.ts` implementing `VendorAdapter`, plus `<provider>_test.ts` replaying recorded fixtures.
2. One line in `registry.ts`.
3. One entry in `FRAMEWORK_PROVIDERS` (`lib/integrations/connections.ts`) and drop the legacy "Not available yet" tile.
4. Vendor-specific actions/jobs and feature surfaces (Applicants, Timesheets, notify-send).
