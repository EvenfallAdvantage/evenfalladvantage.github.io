# Session Handoff — April 12, 2026

**Project:** Evenfall Advantage — Overwatch Platform
**Repo:** https://github.com/EvenfallAdvantage/evenfalladvantage.github.io
**Working Directory:** `C:\Users\54MUR41\projects\evenfalladvantage.github.io`
**CI/CD:** Build & Deploy passing on GitHub Pages.
**Tests:** 58/58 passing, 0 TypeScript errors.

---

## What Was Done This Session (April 12, 2026)

### COMPREHENSIVE AUDIT & FIX SPRINT (~30 commits)

#### Security Fixes (9)
- XSS sanitization on all Cesium + Leaflet HTML descriptions (escapeHtml)
- Removed hardcoded Cesium Ion token + legacy Supabase anon key from source
- Password reset minimum 8→12 chars to match registration
- HTML sanitizer for training slide viewer (dangerouslySetInnerHTML)
- Scoped window auth store to userId only (no PII)
- Global window function cleanup on unmount
- Deleted dangerous SQL files (DISABLE_ALL_RLS, ADMIN_RLS_FIX)
- Private applicant documents with signed URLs
- Checkr webhook HMAC-SHA256 signature verification

#### Bug Fixes (6)
- Timeclock company switch (missing useCallback dep)
- Patrols delete race conditions (await before reload)
- Checkpoint delete → patrol route validation with warning
- Leave cancel warning for approved requests
- Landing page year 2025→2026
- Training viewer keyboard listener stale closure

#### Performance (7)
- N+1 → batch for chat unread counts
- N+1 → upsert for reorder operations (slides, folders, tasks)
- N+1 → bulk for time-off shift cleanup
- Analytics company_id filter
- Satellite overlay throttled to ~10fps
- CSS variable caching in mobile-hero-radar
- Dead code removal (~120 lines) in crime-incidents.ts

### TACTICAL MAP FIXES (~15 commits)
- **Root cause found: infinite ScreenSpaceEventHandler destroy/create loop** caused by `losEntityIds` useState in useEffect deps. Fixed by converting to useRef.
- **Sidebar navigation fix**: Changed sidebar from Next.js `<Link>` to native `<a>` tags with `/overwatch` basePath (CesiumJS blocks React router)
- **OSM tile CORS fix**: Switched from OpenStreetMapImageryProvider to UrlTemplateImageryProvider
- **Time Machine debounce**: 2-second debounce on replayTime prevents Supabase auth lock flood
- **Entity popup dismiss**: 300ms arming delay on camera moveStart listener
- **Operation pin doc buttons**: Clickable doc badges (Intake, WARNO, OPORD, etc.) open DocViewerModal
- **Inline DM modal**: Staff pin "Message" button opens DM modal on map instead of navigating
- **Component decomposition**: Extracted EntityPopup, MapControlButtons, GeofenceAlertTicker, pin-canvas.ts

### NEW FEATURES — V2 UPGRADE CYCLE

#### 1. Staff Badge Generator + QR Scanner
- **Badge Generator** (components/badge-generator.tsx + badge-download.ts)
  - Generates QR-coded ID badges per staff member
  - White professional access card design with profile photo, company logo, "AGENT" label
  - Badge records persisted in `staff_badges` DB table
  - Integrated directly into Roster tab (QR icon per member card)
- **QR Scanner / Mass Clock** (app/scan/page.tsx)
  - Camera-based QR badge scanner using jsQR library
  - Auto clock-in/out based on current status
  - Lives as "Mass Clock" sub-tab in Watch Log (manager+ only)
  - Visual feedback: green for clock-in, amber for clock-out, red for errors
  - `clock_method: "qr_scan"` recorded for audit trail

#### 2. Client Intake Share Link
- **Share button** in intake panel header opens modal
- Generate unique token-based links for clients
- **Public intake page** (`/intake?t={token}`) — no auth required
- Company-branded form with client-relevant fields only
- Submits to `operation_documents` as draft with `source: "client"`
- Manager gets notification, can review and augment
- Links tracked in `intake_shares` DB table

#### 3. Job Postings & Careers Page
- **Postings tab** in Personnel page — full CRUD with modal editor
- Status workflow: Draft → Publish → Close
- **Public careers page** (`/careers?company={slug}`)
- Company-branded with expandable job listings
- JSON-LD structured data for automatic Google Jobs indexing
- "Apply Now" links to existing `/apply` page with `posting_id`
- Applicant counts per posting
- XML job feed generator ready (db-postings.ts)

#### 4. Site Assessment DB Module (ready, UI not yet updated)
- `db-assessments.ts` with full CRUD
- `site_assessments` DB table created
- Ready for integration with intake panel

### POST-SESSION AUDIT FIXES

#### Security Fixes (5)
- **PUBLIC_ROUTES expanded** — Added `/careers`, `/intake`, `/auth/reset`, `/auth/update-password` so public pages are no longer blocked by AuthGuard
- **XSS fix: instructor page** — Added `sanitizeSlideHtml()` to `admin/instructor/page.tsx` slide preview (was rendering raw `dangerouslySetInnerHTML`)
- **XSS fix: entity popup** — Applied `escapeHtml()` to fallback `entity.name` in tactical map entity popup
- **RLS role scoping** — New `sql/v2_fix_rls_policies.sql` replaces permissive `FOR ALL` policies with role-based access (manager+ for writes, any member for reads) on all 4 v2 tables. Adds `is_company_manager()` helper function. **APPLIED TO DB.**
- **intake_shares public read scoped** — Replaced `USING (true)` with token-based lookup only, preventing unauthenticated enumeration of all client intake records

#### Code Quality Fixes (7)
- **Tests now import from source** — All 3 test files (`sanitize.test.ts`, `permissions.test.ts`, `brand-theme.test.ts`) now import actual source functions instead of copy-pasted duplicates. Tests increased from 51 to 58.
- **Extracted `lib/brand-utils.ts`** — Shared `hexToRgb`, `adjustBrightness`, `getLuminance` used by brand-theme-provider, admin/settings, and tests
- **Removed dead dependencies** — Uninstalled `@prisma/client`, `prisma`, `stripe`, `@stripe/stripe-js`, `dotenv` (75 packages, ~15MB)
- **Removed dead files** — Deleted `stripe.ts` (never imported), `server.ts` (incompatible with static export), `error-alerter.ts` (never imported), `prisma.config.ts` (referenced uninstalled prisma)
- **Removed dead feed/page.tsx error-alerter import** — Replaced with TODO for server-side implementation
- **Documented service stubs** — Added clarifying comment to `lib/services/index.ts` explaining these are scaffolding for future server-side integration
- **Removed dead `NEXT_PUBLIC_APP_URL`** from deploy.yml (never referenced in source)

#### CI/CD Fixes (3)
- **CodeQL path filters expanded** — Added `js/**` and `supabase/functions/**` to push-triggered scan paths
- **Next.js build cache** — Added `actions/cache@v4` for `.next/cache` in deploy workflow
- **Dependabot expanded** — Added npm scan config for `google-meet-addon/`

### OTHER IMPROVEMENTS
- Realtime subscriptions added to notifications, updates, and directory pages
- Messages tab added to Briefing page
- Chat page handles `?tab=messages` and `?dm=` URL params
- Avatar images added to DM component (was showing initials only)
- Events settings 400 errors silenced (localStorage-first approach)
- Personnel tabs reordered: Roster, Timesheets, Corrections, Leave, Reports, Postings, Applicants, Onboarding
- Public Application Form + External Integrations cards moved to Applicants tab
- Personnel page header icon updates with selected sub-tab
- Watch Log header stays "WATCH LOG" with dynamic icon per sub-tab
- Stale chunk auto-reload handler (added then removed — caused issues with Cesium)

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
- **Stale chunk 404s after deploy** — Service worker (`sw.js`) has `CACHE_NAME = "overwatch-v10"` that requires manual bumping. No build-time hash injection. Users still need Ctrl+Shift+R after deploys.
- **Backup workflow failing** — `SUPABASE_DB_URL` needs Session Mode pooler URL (IPv4).
- **God components** — `admin/staff/page.tsx` (2,092 lines), `tactical-map.tsx` (1,943 lines, 37 useState, 30+ useEffect). 8 more files exceed 800 lines.

### Medium
- **Site assessment still localStorage** — DB module (`db-assessments.ts`) is ready but the page UI hasn't been updated to use it yet. Need to add save/load from DB + "Create Operation" flow.
- **Assessment ↔ Intake integration** — Both directions (assessment-first and operation-first) planned but not built.
- **Zero component tests** — No `.test.tsx` files exist. Critical data layer (db-helpers.ts, db-operations.ts, db-users.ts ~2000 lines) has no tests. V2 features (badges, intake shares, postings) have no tests.
- **Silent error swallowing in read queries** — `db-operations.ts`, `db-analytics.ts`, `db-content.ts` return empty arrays on error with no user feedback.
- **Sentinel-1 SAR rate limiting** — Free tier has request limits.

### Low
- **XML job feed endpoint** — Generator function exists in `db-postings.ts` but no API route to serve it.
- **LinkedIn/ZipRecruiter API** — Integration scaffolding not yet built. Requires partner approvals.
- **Whisper WASM dictation** — 75MB model download on first use.
- **Drone Planner** — Camera footprint cones and no-fly zones not implemented.
- **Duplicate QR libraries** — `html5-qrcode` (fallback in qr-scanner.tsx) + `jsqr` (primary in scan/page.tsx). Could consolidate.

---

## Architecture Notes

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

### New Dependencies Added
- `qrcode` + `@types/qrcode` — QR code generation for badges
- `jsqr` — QR code scanning from camera feed

### Dependencies Removed (audit cleanup)
- `@prisma/client`, `prisma` — Entire data layer uses Supabase client; Prisma was never imported
- `stripe`, `@stripe/stripe-js` — Incompatible with static export; never imported in source
- `dotenv` — Unnecessary; Next.js handles env vars natively

### Key Patterns
- **Badge download**: Shared `badge-download.ts` used by both roster inline buttons and standalone badge-generator
- **Public pages**: `/intake?t={token}`, `/careers?company={slug}`, `/apply?c={id}` — all use query params (not path segments) due to `output: "export"` static hosting
- **Sidebar navigation**: All links use native `<a>` tags with `/overwatch` basePath prefix
- **Tactical map click handler**: Entity picking runs FIRST (before globe.pick) to ensure billboard clicks work. `losEntityIds` is a ref, not state, to prevent infinite handler recreation.
- **Brand utilities**: `lib/brand-utils.ts` is the single source of truth for `hexToRgb`, `adjustBrightness`, `getLuminance` — used by brand-theme-provider, admin/settings, and tests
- **Service layer stubs**: `lib/services/*.ts` are scaffolding for server-side integrations (Twilio, DocuSign, etc.) — cannot run in static export

### Git Identity
- Name: `denalifox`
- Email: `denalifox@users.noreply.github.com`

### Push Authentication
- `$token = gh auth token; git push "https://x-access-token:${token}@github.com/EvenfallAdvantage/evenfalladvantage.github.io.git" main`

---

## Recommended Next Steps

1. **Component decomposition Phase 2** — Extract `admin/staff/page.tsx` (2,092 lines) and `tactical-map.tsx` (1,943 lines) into sub-components and custom hooks
2. **Update site assessment page to use DB** — Replace localStorage with `db-assessments.ts`, add "Create Operation from Assessment" button
3. **Assessment ↔ Intake bidirectional linking** — Import assessment data into intake, link assessment to operation
4. **Add component and integration tests** — At minimum: auth flow, timeclock, admin role checks, v2 DB modules
5. **Service worker build-time versioning** — Inject build hash into `CACHE_NAME` to eliminate stale chunk 404s
6. **XML job feed route** — Supabase Edge Function serving XML for Indeed auto-indexing
7. **Add error feedback for silent read failures** — Toast or inline error states instead of empty UIs
8. **Investigate React router + CesiumJS** — Find root cause of why `<Link>` navigation stalls when map is mounted
