# Secrets register

Names, locations and owners only. **Never put a secret value in this repo**: not in code, docs,
issues, PR descriptions or commit messages. The repo is **public**.

- Last reviewed: 2026-10-18.
- Owner: the Evenfall Advantage account owner (Supabase, GitHub, Stripe, Resend, Twilio, Google Cloud
  and Cesium accounts). Only the owner sets or rotates values.
- Projects: **OverwatchDB** = Supabase `nneueuvyeohwnspbwfub` (live). **EADB** = Supabase
  `vaagvairvwmgyzsmymhs` (legacy, being retired, see `EADB_RETIREMENT_PLAN`/PR #102).

## Where secrets are allowed

| Kind | Allowed location | Never |
|---|---|---|
| Server secrets (service role, Stripe, Resend, Twilio, webhook/cron secrets) | Supabase Edge Function secrets, or Supabase Vault | Browser code, `NEXT_PUBLIC_*`, the repo, the Pages artifact |
| Per-company integration credentials (API keys, OAuth tokens, SMTP passwords) | Vault, written only by `*-save-credentials` Edge Functions; `integrations_config.config` keeps public fields + `secret_keys_set` | `integrations_config.config`, any table the browser can read |
| Public client keys (Supabase URL + publishable key, Sentinel Hub instance id, intake-only website key) | GitHub Actions secrets → build env, or the static file noted below | Anything with more than read/intake rights |

## Register

### GitHub Actions (repo `EvenfallAdvantage/evenfalladvantage.github.io` → Settings → Secrets and variables → Actions)

| Name | Type | Used by | Public in bundle? | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | secret | `deploy.yml` build | yes (by design) | OverwatchDB API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | secret | `deploy.yml` build | yes (by design) | OverwatchDB **publishable** key (`sb_publishable_…`), RLS-protected |
| `NEXT_PUBLIC_SENTINEL_HUB_INSTANCE_ID` | secret | `deploy.yml` build | yes (by design) | Sentinel Hub OGC instance id; restrict it by referrer in Sentinel Hub |
| `NEXT_PUBLIC_CESIUM_TOKEN` | secret | `deploy.yml` build, **only** when variable `CESIUM_ION_COMMERCIAL=true` | only when ion is licensed | ion is off (free sources are used). Was exposed: see history table. Proposed: delete |
| `CESIUM_ION_COMMERCIAL` | variable (not set) | `deploy.yml` | n/a | Set to `true` only with a commercial Cesium ion licence |
| `NEXT_PUBLIC_GOOGLE_MAP_TILES_KEY` | secret (not created) | draft PR #101 only | yes (by design) | Only if #101 is ever revived; referrer + API restricted |
| `GITHUB_TOKEN` | automatic | workflows | no | Scoped by each workflow's `permissions:` |

### OverwatchDB Edge Function secrets (Dashboard → Edge Functions → Secrets)

| Name | Used by | Notes |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | most functions | Injected by Supabase; never copy them anywhere else |
| `RESEND_API_KEY` | `_shared/email/*` (platform sender), `send-welcome-email` | Platform fallback sender; per-company keys live in Vault |
| `PLATFORM_FROM_EMAIL` | `_shared/email/factory.ts` | Not secret (address) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | `_shared/sms/factory.ts` (platform sender) | Per-company Twilio creds live in Vault |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `course-checkout`, `course-payment-webhook` (PR #102) | Test mode first; see `docs/COURSE_CHECKOUT_GO_LIVE.md` |
| `INTEGRATIONS_PUBLIC_BASE`, `OVERWATCH_APP_URL`, `SITE_URL` | integrations, invites | Not secret (URLs) |
| `INTAKE_ALLOWED_ORIGINS`, `INTEL_SWEEP_ENABLED`, `CCTV_ENABLE_PENDING_SOURCES`, `INTEGRATIONS_ENABLE_MOCK` | various | Not secret (flags) |
| `MOCK_CLIENT_ID`, `MOCK_WEBHOOK_SECRET` | `_shared/integrations/mock.ts` | Test adapter only; leave unset in production |
| Vendor OAuth app creds (`<VENDOR>_CLIENT_ID` / `_CLIENT_SECRET`) | integration adapters | Only when a vendor adapter goes live |
| `ONTARIO511_API_KEY`, `ALBERTA511_API_KEY`, `GA511_API_KEY`, `AZ511_API_KEY`, `NVROADS_API_KEY`, `UDOT_API_KEY`, `PA511_API_KEY`, `WI511_API_KEY`, `FL511_API_KEY`, `NY511_API_KEY`, `WSDOT_ACCESS_CODE`, `OHGO_API_KEY`, `COTRIP_API_KEY`, `TFNSW_API_KEY` | CCTV key-gated sources (not implemented) | Optional; none set |

### OverwatchDB Vault (`vault.secrets`; read only by SECURITY DEFINER functions / service role)

| Name (pattern) | Written by | Read by |
|---|---|---|
| `cctv_ingest_secret` | migration `20261016224117_cctv_ingest_secret_rpc` | pg_cron → `intel-cctv-ingest` (`x-ingest-secret`) |
| `integrations_cron_secret` | migration `20261018004108_integration_cron_secret_vault` | pg_cron → `integration-token-refresh` / `integration-jobs-worker` |
| `TOMTOM_API_KEY` | migration `20261028174112_tomtom_api_key_vault` | `intel-traffic` (`get_tomtom_api_key()` service_role RPC) |
| `integration:<company_id>:<provider>` | `integration-save-credentials` | integration adapters, `airtable-proxy` |
| `overwatch.email.smtp.<company_id>` (and the Resend/SMS equivalents) | `email-save-credentials`, `sms-save-credentials` | `_shared/email`, `_shared/sms` |

### EADB Edge Function secrets (legacy; retire with EADB)

| Name | Used by | Notes |
|---|---|---|
| `OVERWATCH_SUPABASE_URL`, `OVERWATCH_SUPABASE_ANON_KEY` | `legacy-bridge-write` | Public values (OverwatchDB URL + publishable key) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `create-checkout-session`, `process-course-payment` | Delete after PR #102 go-live (checklist in `docs/COURSE_CHECKOUT_GO_LIVE.md`) |

### Public by design (in the repo)

| What | Where | Why it's OK |
|---|---|---|
| Intake-only website key (`ova_live_…`, prefix `ova_live_d80`) | `js/lead-config.js` | `intake:write` scope only, origin-locked, rate-limited. Rotate in Overwatch → Settings → API Sources |

## Exposed in git history (not rewritten; rotate instead)

Fingerprints are the first 8 hex chars of sha256(value), so you can match a key without seeing it.
They're baselined in `.gitleaksignore` so scans stay green; the rotation is the fix.

| What | Where / when | Fingerprint | Risk | Action (owner) |
|---|---|---|---|---|
| OverwatchDB **service_role** JWT (legacy key) | `overwatch-src/scripts/geocode-frequencies.js` @ `cb71f6967` (2026-06-13) | `55a394dd` | **Critical**: bypasses RLS if legacy JWT keys are still enabled | Disable legacy JWT API keys (or rotate the JWT secret) in Supabase |
| Google API key (`AIza…`) | `admin/js/ai-question-generator-free.js` @ `6443c36ba` (2025-10-14), `1d78fbb37` (2026-03-15) | `8f688fa8` | High: billable Google APIs | Delete/regenerate in Google Cloud Console |
| Cesium ion token | `cesium-config.ts` @ `08be186a2`/`afb21f682` (2026-04-09), and the **live bundle** until this PR deploys | `34fe07e3` | Medium: ion quota/billing on your account | Revoke in Cesium ion, then delete the GitHub secret |
| OverwatchDB legacy anon JWT | old built chunks (2026-03 to 06) | `2c20bb8c` | Low (public role, RLS) | Goes away when legacy JWT keys are disabled |
| EADB anon JWTs | old portal JS (2025-10) | `4854df51`, `ea1602b2` | Low (public role) | Goes away with EADB retirement |
| CARTO basemap raster key | `geo-risk-map.tsx` / `use-night-vision.ts` @ `558744027` (2026-09-23) | n/a | Low (public tile key) | Removed by this PR; revoke in CARTO if you no longer use it |

## Guards

- **CI**: `.github/workflows/secret-scan.yml` runs gitleaks (pinned, checksum-verified) on every PR and
  push to main (new commits + working tree) and a weekly full-history scan. Config `.gitleaks.toml`
  (default rules + Supabase secret/service-role, Overwatch API key, Stripe webhook rules).
- **Deploy**: `deploy.yml` runs `.github/scripts/check-public-secrets.py _deploy` and fails if a
  server secret, a service_role JWT, or an unlicensed Cesium ion token is in the Pages artifact.
- **GitHub**: secret scanning + push protection are enabled on the repo.
- **Local**: `git config core.hooksPath .githooks` enables `.githooks/pre-commit` (gitleaks on staged
  changes if installed, otherwise a pattern check; always blocks `.env*`, key files, service-account JSON).
- `.gitignore` covers env files, key material, Supabase CLI state and scan reports.

## If a secret leaks

1. Rotate/revoke it at the provider first (removing it from the repo is not enough; history is public).
2. Remove it from the code in a normal commit; do not rewrite history without the owner's approval.
3. Add the historical fingerprint to `.gitleaksignore` with a comment, and update the table above.
