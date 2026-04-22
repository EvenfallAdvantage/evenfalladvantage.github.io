# Session Handoff — April 21, 2026

**Project:** Evenfall Advantage — Overwatch Platform
**Repo:** https://github.com/EvenfallAdvantage/evenfalladvantage.github.io
**Working Directory:** `C:\Users\54MUR41\projects\evenfalladvantage.github.io`
**CI/CD:** Build & Deploy passing on GitHub Pages. Next.js 16.2.4, Node 22.
**Tests:** 519/519 passing (28 test files), 0 TypeScript errors.
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

## Recommended Next Steps

1. **Deploy OAuth refresh Edge Function** — `supabase functions deploy oauth-refresh --no-verify-jwt` + set up cron trigger
2. **Fix instructor scan permissions** — add 'instructor' to `is_company_manager()` RLS function
3. **Migrate integration service calls to Edge Functions** — prevent API key exposure in browser
4. **Backup workflow fix** — `SUPABASE_DB_URL` Session Mode pooler URL (IPv4)
5. **Persist offline scan queue** — move from useState to localStorage/IndexedDB
6. **Upgrade eslint-plugin-react-hooks** — fix ~100 React Compiler lint violations (mostly setState-in-effect refactoring)
7. **Auth email invites** — Supabase Edge Function calling `auth.admin.inviteUserByEmail()`
8. **Add event filter to "Currently Clocked In" panel**
