# Session Handoff — April 14, 2026

**Project:** Evenfall Advantage — Overwatch Platform
**Repo:** https://github.com/EvenfallAdvantage/evenfalladvantage.github.io
**Working Directory:** `C:\Users\54MUR41\projects\evenfalladvantage.github.io`
**CI/CD:** Build & Deploy passing on GitHub Pages.
**Tests:** 425/425 passing (22 test files), 0 TypeScript errors.
**ESLint:** 0 errors, 139 warnings. Was 94 errors / 2,461 warnings.

---

## What Was Done This Session (April 13, 2026)

### DEPENDENCY MANAGEMENT & CI/CD

#### Dependabot PR Triage (17 PRs)
- **Merged 15 PRs** — 5 GitHub Actions (checkout v6, setup-node v6, codeql-action v4, configure-pages v6, deploy-pages v5), 5 patch/minor npm (tailwindcss/postcss, react-hook-form, recharts, framer-motion, @supabase/ssr), 5 major npm (lucide-react 1.8.0, @types/node 25, TypeScript 6.0, dotenv 17, @google-cloud/functions-framework 5)
- **Closed 2 PRs** — ESLint 10 (incompatible with eslint-config-next), @types/qrcode.react (stub package, conflicting)

#### TypeScript 6.0 Compatibility
- Added `noUncheckedSideEffectImports: false` to tsconfig.json — TS 6.0 defaults this to true, breaking bare CSS imports (`import "./globals.css"`) since Next.js only declares `*.module.css` in its type definitions

#### Service Worker Build-Time Versioning
- Replaced hardcoded `CACHE_NAME = "overwatch-v10"` with `"overwatch-__BUILD_HASH__"`
- CI pipeline injects first 8 chars of `GITHUB_SHA` into `out/sw.js` after build
- Eliminates stale chunk 404s after deploys — no more manual version bumps

#### CI Node.js 24 Compatibility
- `actions/cache` v4 → v5, `actions/upload-pages-artifact` v3 → v4
- Node.js runtime 20 → 22 (current LTS)
- Fixes deprecation warning (Node.js 20 forced to 24 starting June 2, 2026)

### COMPONENT DECOMPOSITION

#### tactical-map.tsx: 1,943 → 410 lines (−79%)
Extracted 8 custom hooks, 1 component, and 1 types file into `components/tactical-map/`:
- `hooks/use-cesium-layers.ts` (888 lines) — all 21 layer plotting/toggling effects
- `hooks/use-click-handler.ts` (372 lines) — entity picking, tools, drawing, waypoints
- `hooks/use-annotations.ts` (76 lines) — drawing state, subscription, save/cancel/clear
- `hooks/use-map-tools.ts` (56 lines) — measure, range rings, LOS, elevation state
- `hooks/use-time-machine.ts` (45 lines) — replay state, debounced fetch, effectiveStaff
- `hooks/use-event-documents.ts` (33 lines) — operation doc loading + ref mirror
- `hooks/use-direct-message.ts` (18 lines) — DM target/text/sending + sendMessage
- `hooks/use-drone-planner.ts` (7 lines) — planner open + waypoints state
- `quick-dm-modal.tsx` — extracted inline DM dialog to standalone component
- `types.ts` — shared StaffPin, OperationPin, IncidentPin, TacticalMapProps

#### admin/staff/page.tsx: 2,173 → 202 lines (−91%)
Extracted 8 tab components and 2 modals into `app/admin/staff/components/`:
- `roster-tab.tsx` (364 lines) — member cards, role management, badges, CSV import
- `applicants-tab.tsx` (432 lines) — pipeline, add form, status workflow, hire
- `reports-tab.tsx` (398 lines) — form submissions + incidents review/edit
- `timesheets-tab.tsx` (171 lines) — grouped timesheets, approve, Gusto sync
- `leave-tab.tsx` (160 lines) — leave requests with filter + review
- `onboarding-tab.tsx` (152 lines) — task CRUD with reorder
- `postings-tab.tsx` (137 lines) — job postings + posting form modal
- `corrections-tab.tsx` (121 lines) — time change requests review
- `applicant-detail-modal.tsx` (237 lines) — applicant detail view
- `posting-form-modal.tsx` (104 lines) — new/edit posting form
- Each tab self-loads its data on mount; parent is thin orchestrator with tab bar + badge counts

#### admin/events/page.tsx: 1,674 → 217 lines (−87%)
Extracted into `app/admin/events/components/`:
- `create-wizard.tsx` (441 lines) — 5-step operation creation wizard
- `operation-detail.tsx` (940 lines) — expanded op view with shifts, docs, storyboard, calendar, activity
- `conflict-warning-modal.tsx` (51 lines) — shift conflict dialog
- `shared.tsx` (99 lines) — types, constants, helper functions

#### feed/page.tsx: 1,121 → 69 lines (−94%)
Extracted 10 components into `app/feed/components/`:
- `intel-center.tsx` (332 lines) — leadership dashboard with charts
- `duty-status.tsx` (279 lines) — clock in/out widget + modal
- `pinned-briefing.tsx` (146 lines) — pinned posts with reactions
- `onboarding-banner.tsx` (131 lines) — no-company banner + create modal
- `shared.tsx` (135 lines) — types, utilities, chart components
- Plus 5 smaller components (upcoming shift, KPI cards, actions, tools)

#### incidents/page.tsx: 981 → 131 lines (−87%)
Extracted 5 components into `app/incidents/components/`:
- `incident-list.tsx` (431 lines) — cards, expand/detail, edit, timeline
- `incident-create-form.tsx` (437 lines) — full creation form + site map pin
- `incident-filters.tsx` (59 lines) — search + status filter + stats
- `site-map-mark-modal.tsx` (83 lines) / `site-map-view-modal.tsx` (64 lines)
- `constants.ts` (46 lines) — shared types and enums

#### geo-risk/page.tsx: 1,023 → 164 lines (−84%)
Extracted 8 components: address-search, risk-results, export-pdf (pure 457-line util), api-key-config, shared types, etc.

#### profile/page.tsx: 944 → 118 lines (−88%)
Extracted 10 components: personal-profile-card, education-card, work-history-card, notification-prefs, avatar, completeness bar, etc.

#### admin/instructor/page.tsx: 907 → 112 lines (−88%)
Extracted 5 tab components: courses, classes, students, assessments, slides-panel.

#### admin/training/page.tsx: 899 → 97 lines (−89%)
Extracted 3 tab components: modules-tab, question-bank-tab, staff-progress-tab.

#### schedule/page.tsx: 898 → 320 lines (−64%)
Extracted 3 components: schedule-tab, armory-tab, shift-accordion.

#### chat/page.tsx: 819 → 102 lines (−88%)
Extracted 3 components + 1 hook: channels-tab, external-tab, use-chat-channels.

### ESLINT CLEANUP: 94 → 30 errors, 2,461 → 133 warnings
- Added proper types for 20+ `any` usages across 12 files
- Excluded vendored `public/cesium/**` from linting (25 no-this-alias + 2,328 warnings)
- Fixed 3 unescaped entities, 6 require-imports, 1 array constructor
- Remaining 30 errors are all `react-compiler` rules requiring behavioral analysis

### TEST COVERAGE: 58 → 410 Tests

#### New Test Files (14)
- `helpers/mock-supabase.ts` — reusable Supabase client mock factory with chainable query builder
- `security-full.test.ts` (43 tests) — password strength, sanitizeObject, encrypt/decrypt round-trip, CSRF tokens, security constants
- `db-helpers.test.ts` (22 tests) — ts(), getAuthUserId, ensureInternalUser caching/dedup, getSignedFileUrl URL parsing + fallback
- `db-postings.test.ts` (28 tests) — generateJobFeedXML (pure), CRUD, applicant counts aggregation, slug-based public lookup
- `db-badges.test.ts` (25 tests) — getOrCreateBadge, QR data format, clock-in/out, lookupBadge JSON parsing, revoke
- `db-intake-shares.test.ts` (16 tests) — token-based share lookup, create/submit/delete lifecycle
- `db-assessments.test.ts` (18 tests) — upsert (update vs insert), unlinked filter, event linking
- `db-operations-events.test.ts` (18 tests) — CRUD, updateEvent conditional field mapping
- `db-operations-shifts.test.ts` (19 tests) — createShift/assignShift status branching, getConflictingShifts conditional .neq
- `db-operations-assets.test.ts` (16 tests) — checkout/checkin multi-step + auth, getAssetByQrCode two-phase lookup
- `db-operations-incidents.test.ts` (24 tests) — deleteIncident storyboard pin removal, getIncidents conditional status filter
- `db-operations-patrols.test.ts` (21 tests) — logPatrolScan auth, checkpoint QR format
- `db-operations-storyboards.test.ts` (20 tests) — saveStoryboard 3-path upsert, getOperationActivity 3-source aggregation
- `db-users.test.ts` (82 tests) — upsertUser phone-key retry, fetchUserProfile auto-create + race condition retry, createCompany slug generation, uploadAvatar validation

### SITE ASSESSMENT → DATABASE

Replaced single-assessment localStorage model with multi-assessment DB-backed persistence:
- Saved assessments panel with risk level badges and date
- Save/Update button with DB persistence via `saveSiteAssessment`
- Load from DB via `?id=` URL param or list selection
- Delete assessment from DB
- New Assessment button to start fresh
- `lon`/`lng` mapping between page state and DB schema
- localStorage retained as crash-recovery draft buffer

### ERROR FEEDBACK FOR DB READ FAILURES

Created centralized `db-error.ts` with `logDbReadError()` — toast notifications + structured console logging. Updated 13 DB modules (~65 read functions) to show user-visible errors instead of silently returning empty arrays. All return values unchanged — no caller contracts broken.

---

## SQL Migrations To Run

| File | Status | Purpose |
|------|--------|---------|
| `sql/v2_upgrade_tables.sql` | **DONE** | All v2 tables (site_assessments, intake_shares, job_postings, staff_badges) |
| `sql/v2_fix_rls_policies.sql` | **DONE** | Role-scoped RLS with WITH CHECK, is_company_manager() helper, token-based intake_shares read |
| `sql/add_events_settings_column.sql` | Run if not done | JSONB settings column for site map bounds |

### FK Fix for staff_badges
```sql
ALTER TABLE staff_badges DROP CONSTRAINT staff_badges_user_id_fkey;
ALTER TABLE staff_badges ADD CONSTRAINT staff_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE staff_badges DROP CONSTRAINT IF EXISTS staff_badges_generated_by_fkey;
ALTER TABLE staff_badges ADD CONSTRAINT staff_badges_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL;
```

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
- **Sidebar uses hard navigation** — Native `<a>` tags instead of Next.js `<Link>` because CesiumJS blocks React router. Causes full page reloads on nav (~200ms slower). Root cause needs investigation.
- **Backup workflow failing** — `SUPABASE_DB_URL` needs Session Mode pooler URL (IPv4).
- **ESLint 10 blocked** — `eslint-config-next` is not yet compatible with ESLint 10. Pinned to ESLint 9.x. Revisit when Next.js ships ESLint 10 support.

### Medium
- **Sentinel-1 SAR rate limiting** — Free tier has request limits.
- **operation-detail.tsx** (940 lines) — largest remaining extracted component, could benefit from further decomposition
- **landing page (720 lines)** — not decomposed yet (low churn, mostly static marketing)
- **4 suppressed ESLint warnings** — storyboard-editor popover positioning (3) + theme-toggle hydration (1)

### Low
- **XML job feed endpoint** — Generator function exists in `db-postings.ts` but no API route to serve it.
- **LinkedIn/ZipRecruiter API** — Integration scaffolding not yet built. Requires partner approvals.
- **Whisper WASM dictation** — 75MB model download on first use.
- **Drone Planner** — Camera footprint cones and no-fly zones not implemented.
- **Duplicate QR libraries** — `html5-qrcode` (fallback in qr-scanner.tsx) + `jsqr` (primary in scan/page.tsx). Could consolidate.

---

## Architecture Notes

### Component Decomposition (Phase 2 — completed April 13)

**tactical-map.tsx** → thin orchestrator (410 lines) + 8 hooks in `hooks/` directory:
- `use-cesium-layers.ts` — all entity/layer plotting (operations, staff, incidents, weather, buildings, night vision, shaders, aircraft, satellites, breadcrumbs, annotations, POIs, geofence alerts, site map overlays, storyboard pins)
- `use-click-handler.ts` — entity picking, measurement tools, drawing, drone waypoints, LOS/elevation
- `use-annotations.ts` — drawing state + realtime subscription + save/cancel/clear
- `use-map-tools.ts` — tool state (measure, range rings, LOS, elevation) + cleanup
- `use-time-machine.ts` — time replay + debounced historical staff fetch
- `use-event-documents.ts` — operation document loading with ref mirror for closures
- `use-direct-message.ts` — DM modal state + send function
- `use-drone-planner.ts` — planner open/close + waypoints

**admin/staff/page.tsx** → thin orchestrator (202 lines) + 10 components in `components/`:
- Each tab component self-loads data on mount and owns its state
- Parent only manages: active tab, loading state, members list, company info, tab badge counts
- Modals (`ApplicantDetailModal`, `PostingFormModal`, `MemberProfileModal`, `ReadinessModal`) are standalone components receiving data via props

### New DB Tables (v2)
- `site_assessments` — Persisted security assessments
- `intake_shares` — Token-based client intake share links
- `job_postings` — Job listing management with status workflow
- `staff_badges` — QR badge records with badge numbers

### RLS Model (v2 tables)
All v2 tables use a two-tier RLS model:
- **Read**: Any authenticated company member can SELECT
- **Write**: Only `manager`, `admin`, or `owner` roles can INSERT/UPDATE/DELETE (via `is_company_manager()` function)
- **Public**: `job_postings` allows unauthenticated SELECT where `status = 'active'`; `intake_shares` allows unauthenticated SELECT only via token lookup

### Test Infrastructure
- **Mock factory**: `src/__tests__/helpers/mock-supabase.ts` — chainable Supabase client mock with `setMockResponse()` and `setAuthUser()` helpers
- **Convention**: Pure function tests need no mocking; DB tests use `vi.mock("@/lib/supabase/client")` + mock factory
- **Coverage**: Security (password, encryption, sanitization), DB helpers (caching, auth, signed URLs), all V2 DB modules (badges, intake shares, postings, assessments)

### Key Patterns
- **Badge download**: Shared `badge-download.ts` used by both roster inline buttons and standalone badge-generator
- **Public pages**: `/intake?t={token}`, `/careers?company={slug}`, `/apply?c={id}` — all use query params (not path segments) due to `output: "export"` static hosting
- **Sidebar navigation**: All links use native `<a>` tags with `/overwatch` basePath prefix
- **Tactical map click handler**: Entity picking runs FIRST (before globe.pick) to ensure billboard clicks work. `losEntityIds` is a ref, not state, to prevent infinite handler recreation.
- **Brand utilities**: `lib/brand-utils.ts` is the single source of truth for `hexToRgb`, `adjustBrightness`, `getLuminance` — used by brand-theme-provider, admin/settings, and tests
- **Service layer stubs**: `lib/services/*.ts` are scaffolding for server-side integrations (Twilio, DocuSign, etc.) — cannot run in static export
- **Error feedback**: `lib/supabase/db-error.ts` provides `logDbReadError()` — toast + console logging for all DB read failures across 13 modules

### Git Identity
- Name: `denalifox`
- Email: `denalifox@users.noreply.github.com`

### Push Authentication
- `$token = gh auth token; git push "https://x-access-token:${token}@github.com/EvenfallAdvantage/evenfalladvantage.github.io.git" main`

---

## Recommended Next Steps

1. **More component tests** — Expand `.test.tsx` coverage to auth guard, timeclock modal, roster tab, incident create form
2. **XML job feed route** — Supabase Edge Function serving `generateJobFeedXML()` output for Indeed auto-indexing
3. **Investigate React router + CesiumJS** — Find root cause of why `<Link>` navigation stalls when map is mounted
4. **Backup workflow fix** — Update `SUPABASE_DB_URL` to Session Mode pooler URL (IPv4)
5. **Make lint blocking in CI** — ESLint now has 0 errors; consider enabling `--max-warnings` threshold
6. **Decompose operation-detail.tsx** (940 lines) — further split shift management, doc panels, activity feed
