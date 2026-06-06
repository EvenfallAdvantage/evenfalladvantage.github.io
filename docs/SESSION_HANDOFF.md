# Session Handoff — April 23, 2026

**Project:** Evenfall Advantage — Overwatch Platform
**Repo:** https://github.com/EvenfallAdvantage/evenfalladvantage.github.io
**Working Directory:** `C:\Users\54MUR41\projects\evenfalladvantage.github.io`
**CI/CD:** Build & Deploy passing on GitHub Pages. Next.js 16.2.4, Node 22.
**Tests:** 519/519 passing (28 test files), 0 TypeScript errors.
**Commits this session:** 55
**React Query pages:** 15 migrated
**PageShell pages:** 14 migrated
**SMTP:** Resend custom SMTP configured in Supabase (noreply@evenfalladvantage.com)
**Native confirm():** 0 remaining (37/37 migrated)
**Empty catch blocks:** 0 remaining (141/141 replaced)
**ESLint:** 0 errors, 0 warnings. Lint is blocking in CI (--max-warnings 0).
**npm audit:** 0 vulnerabilities.
**Navigation:** Client-side via Next.js `<Link>`.

---

## What Was Done This Session (April 21, 2026) — 8 Commits

### COMPREHENSIVE AUDIT & SECURITY FIXES
- Fixed XSS in `entity-popup.tsx` — DB-sourced HTML now sanitized with DOMPurify
- Replaced bypassable regex HTML sanitizer in `slides-panel.tsx` and `training/viewer/page.tsx` with centralized `sanitizeHtml()` using DOMPurify
- Hardened `getSignedFileUrl` to throw on failure instead of falling back to public URL (prevented potential private file exposure)
- Removed Supabase project subdomain reconnaissance data from `legacy-bridge.ts` docstring
- Added `dompurify` + `@types/dompurify` dependencies

### CENTRALIZED LOGGER (141 empty catches eliminated)
- Created `src/lib/logger.ts` — leveled logger (trace/debug/warn/error) with `swallow()` method
- Replaced **141 silent `catch {}` blocks** across 65+ files with contextual `logger.swallow("context", e, level)` calls
- Three severity tiers: trace (cleanup), debug (optional loads), warn (user-visible failures)
- Suppresses trace/debug in production unless `localStorage.overwatch-debug === "1"`

### TYPED WINDOW GLOBALS (25 unsafe casts eliminated)
- Created `src/types/window.d.ts` — typed declarations for 12 custom window properties
- Eliminated ~25 `(window as any).__prop` casts across 10 files
- Properties: `__tacticalMapViewer`, `__deleteAnnotation`, `__openOpDoc`, `__openStaffDM`, `__siteMapAlignerAddPoint`, `__sbSaveTimer`, `__OVERWATCH_AUTH_STORE__`, `satellite`, `BarcodeDetector`, `SpeechRecognition`, `webkitSpeechRecognition`

### PERFORMANCE OPTIMIZATIONS
- Removed dead dependencies: `recharts`, `framer-motion`, `@tanstack/react-query` (-38 packages, ~360KB)
- Converted `jspdf` to dynamic import in `export-pdf.ts` (~280KB off geo-risk route chunk)
- Converted `qrcode` to dynamic import in 4 files (~50KB off roster/badge/profile chunks)
- Moved `@types/leaflet` and `@types/qrcode` to devDependencies
- Added `knip` for dead code detection

### FILE DECOMPOSITIONS (5 monoliths → 44 focused modules)
| Original | Before | After |
|----------|--------|-------|
| `storyboard-editor.tsx` | 1,126 lines | 561 + 8 modules under `storyboard/` |
| `legacy-bridge.ts` | 1,006 lines | 11-line barrel + 9 modules under `legacy/` |
| `use-cesium-layers.ts` | 975 lines | 382 + 11 sub-hooks |
| `db-operations.ts` | 862 lines | 7-line barrel + 7 domain modules |
| `shift-management.tsx` | 787 lines | 189 + 8 modules under `shift-management/` |

### UI/UX IMPROVEMENTS
- Installed shadcn `checkbox`, `radio-group`, `alert-dialog`, `table`, `progress` components
- Created shared `PageLoader` and `InlineSpinner` components with `motion-reduce` support
- Added `loading.tsx` skeletons for 8 major routes (feed, admin/staff, admin/events, schedule, chat, profile, incidents, timeclock)
- Added segment-level `error.tsx` for admin, academy, and feed segments
- Added `global-error.tsx` for layout-level crash recovery
- Wrapped `TacticalGlobe` and `TacticalMap` in `ErrorBoundary`
- Added `prefers-reduced-motion` CSS support

### ACCESSIBILITY (WCAG 1.3.1)
- Fixed ~162 `Label`/`htmlFor` + `Input`/`id` associations across 23 form files
- Added `aria-live="polite"` + `role="status"` to PageLoader
- Added `sr-only` screen reader text for loading states
- Created `toast-helpers.ts` (toastSuccess/toastError/toastInfo/toastWarning) for consistent voice
- Converted misused group-header `<label>` elements to `<span>`
- Extracted nested `SectionHeader`/`Chips` components from intake-panel and opord-panel to module-level `ops-shared.tsx` (React Compiler compliance)

### INTEGRATION SERVICES (5 new providers)
| Provider | Service File | Settings UI | App UI Wired |
|----------|-------------|:-----------:|:------------:|
| **QuickBooks Online** | `quickbooks-service.ts` | Yes | Timesheets sync button |
| **ADP Workforce Now** | `adp-service.ts` | Yes | Timesheets sync button |
| **Paychex Flex** | `paychex-service.ts` | Yes | Timesheets sync button |
| **Signal** | `signal-service.ts` (stub) | Yes | Group link management |
| **Fillout** | `fillout-service.ts` | Yes | Webhook handler + field mapper |

- All payroll services follow the same pattern: employee/worker lookup by email → timesheet mapping → batch submission
- Added `oauth-refresh` Supabase Edge Function for token refresh across all OAuth providers
- Wired Airtable applicant import button into applicants tab toolbar
- Fixed `courses/page.tsx` checkout to call Edge Function instead of broken `/api/checkout`

### INFRASTRUCTURE ADDITIONS
- `src/lib/logger.ts` — centralized leveled logger
- `src/types/window.d.ts` — typed window declarations
- `src/lib/security/index.ts` — `sanitizeHtml()` via DOMPurify
- `src/lib/toast-helpers.ts` — consistent toast messaging
- `src/components/page-loader.tsx` — shared loading components
- `src/components/ops/ops-shared.tsx` — extracted section headers and chip toggles
- `supabase/functions/oauth-refresh/index.ts` — OAuth token refresh Edge Function

---

## GitHub Secrets Required

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase |
| `NEXT_PUBLIC_CESIUM_TOKEN` | Cesium Ion 3D globe |
| `NEXT_PUBLIC_SENTINEL_HUB_INSTANCE_ID` | Sentinel-1 SAR imagery |
| `NEXT_PUBLIC_LEGACY_SUPABASE_URL` | Legacy training content bridge |
| `NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY` | Legacy training content bridge |

---

## Known Issues / Technical Debt

### High
- **Backup workflow failing** — `SUPABASE_DB_URL` needs Session Mode pooler URL (IPv4).
- **ESLint 10 blocked** — `eslint-config-next` not yet compatible. Pinned to ESLint 9.x.
- **Instructor role lacks scan permissions** — Instructors can't mass clock (RLS blocks). Fix: add 'instructor' to `is_company_manager()`.
- **OAuth token refresh** — Edge Function scaffold deployed but not yet connected to a cron trigger. Needs `supabase functions deploy oauth-refresh`.

### Medium
- **Offline scan retry always clocks IN** — doesn't check if person was already clocked in.
- **Cross-device race condition** — two scanners can double-clock-in same person.
- **Integration services run client-side** — API keys fetched from DB used in browser fetch. Migration to Edge Functions needed for production security.
- **Remaining large files** — `crime-incidents.ts` (821), `page.tsx` landing (769), `tactical-globe.tsx` (766), `document-scanner.tsx` (751), `sidebar.tsx` (723 — shadcn generated, acceptable).

### Low
- **Offline queue not persisted** — tab close/refresh loses queue (useState only).
- **No event filter on "Currently Clocked In" panel** — shows all company staff.
- **eslint-plugin-react-hooks v7** — upgrade brings 100+ new React Compiler lint rules; most are `set-state-in-effect` patterns across ~30 pages. Deferred.

---

## Architecture Notes

### File Structure After Decompositions
```
src/lib/
  legacy/           — 9 domain modules (courses, modules, assessments, etc.)
  legacy-bridge.ts  — barrel re-export
  supabase/
    db-operations.ts — barrel re-export
    db-events.ts     — event CRUD
    db-shifts.ts     — shift operations
    db-storyboards.ts
    db-site-bounds.ts
    db-assets.ts
    db-incidents.ts
    db-checkpoints.ts
  services/
    integrations.ts     — config loader + typed getters
    gusto-service.ts    — Gusto payroll sync
    quickbooks-service.ts — QuickBooks payroll sync
    adp-service.ts      — ADP payroll sync
    paychex-service.ts  — Paychex payroll sync
    airtable-service.ts — Airtable bidirectional sync
    signal-service.ts   — Signal group link (stub)
    fillout-service.ts  — Fillout webhook handler
    ...existing services...

src/components/
  storyboard/       — 8 modules (icon-catalog, icon-picker, pin-form, etc.)
  storyboard-editor.tsx — orchestrator
  ops/
    ops-shared.tsx   — shared SectionHeader + OpsChips components
  tactical-map/
    hooks/
      cesium-layer-types.ts — shared type aliases
      use-cesium-layers.ts  — orchestrator (382 lines)
      use-operations-layer.ts
      use-staff-layer.ts
      use-incidents-layer.ts
      use-weather-layer.ts
      use-night-vision.ts
      use-aircraft-layer.ts
      use-orbit-layer.ts
      use-trails-layer.ts
      use-annotations-layer.ts
      use-poi-layer.ts

src/app/admin/events/components/
  shift-management.tsx   — orchestrator (189 lines)
  shift-management/      — 8 modules
```

### Integration Provider Keys
```ts
type ProviderKey =
  | "whatsapp" | "signal" | "twilio" | "email" | "onesignal"
  | "fillout" | "airtable" | "checkr" | "docusign"
  | "gusto" | "quickbooks" | "adp" | "paychex";
```

### Git Identity
- Name: `denalifox`
- Email: `denalifox@users.noreply.github.com`

### Push Authentication
```powershell
$token = gh auth token; git push "https://x-access-token:${token}@github.com/EvenfallAdvantage/evenfalladvantage.github.io.git" main
```

---

## Phase A-D Work (Late April 21, 2026) — 7 Additional Commits

### PHASE A — UX Foundation
- **Terminology unification** — 7 nav labels + 7 page headers aligned (Reports→Incidents, Roster→Directory, Planning→Ops Planning, etc.)
- **Killed 82 dead `"pending"` guards** across 42 files — replaced with `!activeCompanyId`
- **Command palette (Cmd+K)** — 25+ searchable pages with role filtering, using existing `cmdk` dependency
- **useConfirmDialog hook** — async AlertDialog replacement for native `confirm()`
- **Deleted ghost redirect pages** — `/settings` and `/assets`

### PHASE B — Architecture Hardening
- **React Query** re-introduced with shared `QueryClient` + `useCompanyQuery` hook (keyed by `[resource, companyId]`)
- **Soft company switching** — replaced `window.location.reload()` with query cache invalidation + `router.push`
- **PageShell component** — declarative header management (pages wrap content instead of manual setHeader/clearHeader)
- **Auth store fixes** — `useActiveCompany()` memoized selector, `clearSession` removes persisted company to prevent cross-user leakage

### PHASE C — Critical Features (Data + UI)
- **Certification compliance** (`db-compliance.ts`) — expiry tracking, compliance summary, shift qualification gating + ComplianceWidget on dashboard
- **Invoicing system** (`db-invoices.ts`) — full CRUD, auto-increment numbers, generate-from-timesheets, bill rates
- **Overtime detection** (`db-overtime.ts`) — configurable thresholds, weekly hours report, OT/DT split + OvertimeWidget on dashboard
- **Shift swap marketplace** (`db-shift-swap.ts`) — create/claim/approve/reject + ShiftSwapTab in schedule page
- **Panic/SOS alerts** (`db-panic.ts`) — GPS capture, manager notification + SOS button on mobile nav + PanicAlertBanner on dashboard

### PHASE D — Enhanced Features
- **Broadcast messaging** (`db-broadcast.ts`) — send to all/on-duty/managers with ack tracking
- **Incident media attachments** (`db-incident-media.ts`) — photo/video upload with SHA-256 chain-of-custody hash
- **Break tracking** (`db-breaks.ts`) — meal/rest breaks, CA labor law compliance check, geofence enforcement
- **DAR auto-generation** (`db-dar.ts`) — compiles clock times + patrols + incidents + breaks into a structured report

### CONTINUED WORK (April 22, 2026) — 8 More Commits
- **Auto-scheduling engine** (`db-scheduling.ts`) — shift templates with recurrence, smart-fill algorithm (availability + certs + OT + rest constraints)
- **All 37 native `confirm()` calls** migrated to shadcn AlertDialog via `useConfirmDialog`
- **Client portal** — 5 pages (`/client/*`) with dedicated shell, client role, invite flow in admin settings
- **React Query migration** — 8 total pages now use `useCompanyQuery` (directory, notifications, time-off, knowledge-base, incidents, quizzes, updates, admin/events)
- **PageShell migration** — 11 pages use declarative `<PageShell>` instead of manual setHeader
- **Mobile tab bars** fixed across 12 pages (shrink-0 + scrollbar-hide)
- **Landing page** updated with new features, 14 integrations, updated stats
- **Bug fixes** — shift swap PostgREST query rewrite, patrols header, Reports nav label restored, db-error message extraction

### SQL Migrations To Run

**As of May 15, 2026 — pending migrations grouped by feature.** Run each
file in the Supabase SQL Editor (Overwatch DB, `nneueuvyeohwnspbwfub`).
All migrations are idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`,
etc.) — safe to re-run.

#### Pre-April migrations (legacy reference)
| File | Purpose | Status |
|------|---------|--------|
| `sql/run_all_new_migrations.sql` | Invoices + Panic Alerts + Shift Swap Requests | Run |
| `sql/add_broadcasts_breaks_media.sql` | Broadcasts + Timesheet Breaks + Incident Media | Run |
| `sql/add_shift_templates.sql` | Was for the now-removed Auto-Schedule feature | **Skip — Auto-Schedule removed May 15** |

#### May 2026 migrations
| File | Purpose | Required if you use... |
|------|---------|-------------------------|
| `sql/add_client_intake_tokens.sql` | Backs the `ClientIntakeShareModal` (Request from Client + Share Intake) | Any client-share link feature |
| `sql/add_intake_api_keys.sql` | API Sources tab in HQ Config (api_keys, intake_field_mappings, api_request_log tables; extends client_intake_tokens with source/api_key_id columns) | The intake-ingest Edge Function endpoint |
| `sql/add_site_map_bounds.sql` | `site_map_bounds` table for company-wide rubber-sheet visibility; tightens operation-maps storage bucket policies | Tactical map site overlays |
| `sql/drop_event_pay_rate.sql` | Drops the redundant `events.pay_rate` column (pay rates are now strictly per-employee) | Pay rate cascade fix |
| `sql/add_client_role.sql` | Adds `client` to the `CompanyRole` enum + updates the `update_member_role` RPC | Client Portal section in HQ Config |
| `sql/add_site_map_quad.sql` | Adds 8 quad-corner columns to `site_map_bounds` so rotated/sheared site maps drape correctly (was axis-aligned only — west-up site plans skewed) | Site map alignment for any non-north-up source image |
| `sql/fix_supabase_linter_warnings.sql` | One-shot cleanup of the Supabase Database Linter warnings: pins `search_path` on `operation_maps_company_for_object`, drops file-enumeration policies on `avatars` + `company-logos` buckets, and locks down `EXECUTE` on every SECURITY DEFINER function with the correct pattern (`REVOKE FROM PUBLIC` — which is where Postgres puts the default grant — followed by an explicit `GRANT TO authenticated` for RPCs that need it). The earlier version only revoked from `anon`/`authenticated` directly and had no effect because the grant lives on `PUBLIC`. Verified safe — every `supabase.rpc()` call site was grepped first. **Also requires:** dashboard toggle at Authentication → Policies → "Prevent use of leaked passwords" (no SQL). The source-of-truth `CREATE FUNCTION` files (e.g. `add-create-company-rpc.sql`, `fix-security-warnings.sql`, `enable-rls.sql`, `supabase-setup.sql`, the four `join_company_by_code` variants, etc.) were ALSO patched in the same commit so fresh deployments don't re-introduce the warnings. | Recommended for any Supabase project — drops ~32 linter warnings to ~6-8 expected ones |
| `sql/fix_perf_phase1_duplicate_indexes.sql` | Drops duplicate indexes `time_off_policies_company_id_idx` and `time_off_requests_user_id_idx` (the Prisma-generated copies of `idx_time_off_policies_company` and `idx_time_off_user`). Two indexes covering the same columns serve no purpose and slow down writes. Also commented out the duplicate `CREATE INDEX` entries in `overwatch-src/prisma/supabase-init.sql` so re-running that file won't re-introduce them. | Performance linter cleanup |
| `sql/fix_perf_phase2_rls_initplan.sql` | **Run this LAST after any DB setup script.** Iterates over every policy in `public.*` and wraps bare `auth.uid()` / `auth.role()` / `auth.jwt()` calls in `(SELECT ...)`, which lets PostgreSQL evaluate them once per query (InitPlan) instead of once per row. ~94 policies rewritten in the Overwatch DB. Idempotent — re-running finds nothing to change because the rewrite normalizes double-wrapping. Includes a `DRY_RUN` flag at the top (default `false`) for preview-only mode. Source-file patches were intentionally NOT made: ~70 SQL files contain bare `auth.uid()` and bulk regex replacement risks edge cases; the canonical fix is to always re-run this script after any setup script. | Required after `supabase-setup.sql`, `add-delete-policies.sql`, `enable-rls.sql`, etc. — drops ~95 performance linter warnings to 0 |

#### June 2026 migrations — Roster Invitations + Mass Email
**Pre-flight first.** Run `sql/check_supabase_vault.sql` and confirm the `supabase_vault` extension shows up. If empty, enable Vault via Dashboard → Database → Extensions → search "vault" → Enable. The migrations below require Vault.

| File | Purpose | Required if you use... |
|------|---------|-------------------------|
| `sql/check_supabase_vault.sql` | Diagnostic — does NOT alter anything. Confirms `supabase_vault` extension is installed and `vault.decrypted_secrets` is readable. | Run first |
| `sql/add_vault_rpc_wrappers.sql` | Public-schema SECURITY DEFINER wrappers (`vault_read_secret`, `vault_create_secret`, `vault_update_secret`, `vault_delete_secret`) for the Vault primitives. Locked to `service_role` only. supabase-js `.rpc()` can only call public-schema functions, so the Edge Functions use these wrappers to read/write encrypted email-provider credentials. | Roster invitations / mass email |
| `sql/extend_integrations_config_email.sql` | Adds columns to existing `integrations_config` for per-company email sending: `delivery_method` (smtp/resend/platform), `from_email`, `from_name`, `reply_to`, `verified_at`, `test_sent_to`, `vault_secret_id`. Legacy `config.{provider,api_key}` rows are ignored by the new code path — admins re-save through the new UI to migrate. | Roster invitations / mass email |
| `sql/add_roster_invitations.sql` | Creates `roster_invitations` (per-membership shadow of Supabase Auth invitations: sent_at, expires_at, accepted_at, resend_count, etc.) + RLS (SELECT for `is_company_admin`, writes service-role only) + the `upsert_roster_invitation` RPC for atomic insert-or-bump-resend-count. | Roster invitations |
| `sql/add_email_send_log.sql` | Creates `email_send_log` for per-message audit: company_id, delivery_method, to_email, subject, purpose, status, provider_id, error_message. RLS SELECT for `is_company_admin`. Indexes on (company_id, sent_at DESC) and to_email. | Roster invitations / mass email |
| `sql/add_accept_roster_invitation_rpc.sql` | `public.accept_roster_invitation()` SECURITY DEFINER RPC called from `/auth/update-password` after a session is established. Three cases: (1) link existing unlinked roster `users` row to caller's `supabase_id`, (2) cross-company invite — attach a `company_memberships` row to the caller's existing user, (3) no-op for plain password resets. Locked to `authenticated`. | Roster invitations |

#### Edge Function deployment for the email feature
| Action | Required if you use... |
|--------|-------------------------|
| `npx supabase functions deploy email-send` | Internal mail dispatcher. `verify_jwt = false` — service-role-only. Resolves company → provider via factory → sends → logs to `email_send_log`. |
| `npx supabase functions deploy roster-invite roster-bulk-email email-test-send` | User-callable (admin/manager/owner). `verify_jwt = true` (default). |
| Supabase Dashboard → Authentication → URL Configuration → Redirect URLs | Add `https://www.evenfalladvantage.com/overwatch/auth/update-password/` and `https://evenfalladvantage.github.io/overwatch/auth/update-password/` so invite/recovery links don't get rejected. |
| Supabase Dashboard → Edge Functions → Secrets | Set `RESEND_API_KEY` (platform fallback) and optionally `PLATFORM_FROM_EMAIL` (default `invite@evenfalladvantage.com`). `SITE_URL` defaults to `https://www.evenfalladvantage.com` but can be overridden. |

#### Deployment-side
| Action | Required if you use... |
|--------|-------------------------|
| `npx supabase functions deploy intake-ingest --no-verify-jwt` | API Sources / external website forwarding |
| Run `overwatch-src/prisma/add-company-logos-storage.sql` (if not already applied) | Company logo upload (Issue diagnosed May 15) |
| Run `overwatch-src/prisma/add-avatar-storage.sql` (if not already applied) | **User avatar upload** — without this, profile picture upload fails with `new row violates row-level security policy` (Tony reported May 15) |
| `npx supabase functions deploy intel-earthquakes intel-fires intel-eonet-weather intel-space-weather intel-news intel-gdelt intel-live-news intel-infrastructure intel-conflict-zones intel-maritime intel-country-risk intel-cyber-threats intel-region-dossier intel-cctv intel-osint-dns intel-osint-whois intel-osint-ip intel-osint-cve intel-osint-threats intel-osint-bgp intel-osint-certs intel-osint-sweep --no-verify-jwt` | **Intel features (Phase A backend lift)** — 22 Edge Functions ported from the Osiris OSS project (MIT). Required before any client-side Intel UI is wired. All keyless and free; `intel-cctv` is feature-flag-gated until legal review per `THIRD-PARTY-NOTICES.md`. |

### Intel feature flags (`overwatch-src/src/lib/intel-feature-flags.ts`)

Phase A wired 22 Supabase Edge Functions that proxy free public OSINT data
(earthquakes, fires, EONET, space weather, news, GDELT, live broadcasters,
nuclear infrastructure, conflict zones, maritime ports/chokepoints, country
risk, CISA KEV, region dossier, CCTV, plus 8 RECON tools: DNS, WHOIS, IP,
CVE, threats, BGP, certs, sweep). Each layer has a feature flag controlling
whether the corresponding UI toggle is enabled. Two are off by default:

- `cctv` — gated by legal review (TfL, state DOT terms vary)
- `maritime_ais` — needs aisstream.io API key + long-lived worker (Phase E)

Update the flag's `enabled: true` only after the corresponding gate clears.
Required attribution strings are listed per-flag and surfaced by the
`getRequiredAttributions()` helper.

See `docs/THIRD-PARTY-NOTICES.md` for the full attribution list.

#### Detection in the UI
The HQ Config sections now detect missing migrations and show a clear
"Database setup required" banner with the exact filename to run, instead
of a generic red toast. So you can land on the page, see the banner,
run the migration, and reload. Sections covered:
- **API Sources** (detects missing `api_keys` / `intake_field_mappings`)
- **Client Portal** (detects missing `client` value in `CompanyRole` enum)

---

## Recommended Next Steps

1. **Apply pending May 2026 migrations** — see the table above. Run each `.sql` file in the Supabase SQL Editor.
2. **Deploy OAuth refresh Edge Function** — `supabase functions deploy oauth-refresh --no-verify-jwt` + cron trigger
3. **Fix instructor scan permissions** — add 'instructor' to `is_company_manager()` RLS function
4. **Migrate integration service calls to Edge Functions** — prevent API key exposure in browser
5. **Persist offline scan queue** — move from useState to localStorage/IndexedDB
6. **Visitor management** — guard-post kiosk mode with sign-in log
7. **Full offline support** — IndexedDB outbox for all mutations + background sync
8. **Upgrade eslint-plugin-react-hooks** to v7 — fix ~100 setState-in-effect patterns
