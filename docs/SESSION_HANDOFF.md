# Session Handoff — April 11, 2026 (Updated)

**Project:** Evenfall Advantage — Overwatch Platform
**Repo:** https://github.com/EvenfallAdvantage/evenfalladvantage.github.io
**Working Directory:** `C:\Users\54MUR41\projects\evenfalladvantage.github.io`
**Latest commit:** `ccf4a608a` on `main` (admin/staff modal extraction)
**Commits this session:** ~86 (original ~80 + 6 audit/feature commits)
**CI/CD:** Build & Deploy passing. Backup workflow needs Supabase pooler URL fix.

### Latest Session (Audit + Feature Sprint)
6 commits pushed:
1. `55ff356` — Comprehensive security audit (27 fixes: XSS, credentials, N+1 queries, bugs)
2. `3416534` — Wire Time Machine to staff history + Line of Sight / Elevation Profile tools
3. `17b0058` — OpenSky proxy Edge Function + DM from map pins + send location in chat
4. `d5f4377` — Decompose tactical-map.tsx Phase 1 (1915→1629 lines)
5. `6ed1e33` — Private applicant docs (signed URLs) + Checkr webhook HMAC verification
6. `ccf4a60` — Extract admin/staff modals (2105→1854 lines)

---

## What Was Done This Session

### 1. COMPREHENSIVE SECURITY AUDIT & CLEANUP
- Fixed 6 critical security vulnerabilities (backup to artifacts, scoped deployment, XSS fixes, CORS hardening, admin auth on Edge Functions)
- Removed 30+ dead/orphaned files (abandoned projects, unused JS/CSS, dev tools)
- Fixed 23 TypeScript strict-mode errors blocking CI
- Resolved npm audit vulnerabilities (jspdf critical, lodash, hono, etc.)

### 2. BUG FIXES
- **Field reports company isolation** — `getUserFormSubmissions()` was missing company_id filter, causing cross-company data bleedover
- **Join company modal** — converted from /join page navigation to inline modal flow
- **Dictation/Speech-to-text** — identified Brave Browser blocks Web Speech API; built Whisper WASM fallback for all unsupported browsers (loads ~150MB model client-side)
- **Dynamic header icons** — all tabbed pages now change their title icon based on active sub-tab
- **Incident pin cleanup** — deleting an incident now removes its storyboard pin automatically
- **Various popup/UI fixes** — positioning, formatting, redundant headers

### 3. 3D TACTICAL MAP (Major Feature — Operations Page)
Built a full CesiumJS 3D tactical map at `/overwatch/schedule/` (Map tab, now default):

**Core:**
- CesiumJS loaded from CDN (not bundled — Turbopack can't handle it)
- Cesium Ion token: stored as `NEXT_PUBLIC_CESIUM_TOKEN` GitHub secret
- 3D terrain with water effects, OSM 3D buildings
- Compass rose (click to reset north), fullscreen button
- Camera position + layer state persisted to localStorage per company

**Layers (organized into groups):**
- **MAP:** Satellite View, 3D Buildings, 3D Terrain
- **OPERATIONS:** Operations pins, Staff locations (real-time), Patrol Trails (breadcrumbs), Incidents, Geofences, Tactical Drawings
- **INTELLIGENCE:** Weather Radar (Iowa Mesonet NEXRAD), SAR Imagery (Sentinel-1 via CDSE), Satellite Photos (Sentinel-2 EOX cloudless), Nearby Services (Overpass API), Satellite Orbits (CelesTrak TLE), Aircraft (OpenSky — CORS blocked, needs proxy)
- **EFFECTS:** Night Mode (dark basemap + green buildings), FLIR Thermal (GLSL shader), CRT Mode (GLSL shader)
- **SITE MAPS:** Per-operation site map overlays with 3-point rubber-sheet alignment

**Tools (bottom toolbar):**
- Measure (distance + bearing between two points)
- Range Rings (¼, ½, 1, 2, 5 mile concentric circles)
- Draw tools: Line, Area, Circle, Arrow, Freehand, Text Label (admin+ only, saved to DB, real-time synced)

**Time Machine:** Timeline slider (0-48h back), play/pause with 1-16x speed
**Drone Flight Planner:** Click waypoints, set altitude, export KML
**Terrain Analysis:** Line-of-sight checker, elevation profiling (code ready, UI partially wired)

**Staff Location Tracking:**
- GPS watcher starts automatically on clock-in (based on profile preference)
- 30s push interval to `staff_locations` table
- History logged to `staff_location_history` for breadcrumb trails
- Geofence breach detection on each GPS push
- Location sharing toggle in Profile page (defaults ON)

**Site Map Alignment:**
- 3-point rubber-sheet alignment tool
- Bounds saved to localStorage + events.settings DB
- Storyboard pins from planning mode appear on globe at correct geo positions
- Incident pins cross-referenced with incidents table for enriched popups
- Opacity slider for overlays

### 4. GOD'S EYE SATELLITE INTELLIGENCE
- **Sentinel-1 SAR:** Real data via Copernicus CDSE Sentinel Hub WMS. Instance ID: `8f6b57a4-a080-447a-b28f-53ec694894a8` (stored as `NEXT_PUBLIC_SENTINEL_HUB_INSTANCE_ID`). Layer name: `SAR-VV-20-TO-0-DB`. Caching aligned to 6-day revisit cycle.
- **Sentinel-2 Optical:** EOX cloudless mosaic (static 2021 tiles, cached indefinitely)
- **FLIR Thermal shader:** Iron bow palette with targeting reticle
- **CRT Mode shader:** Green phosphor, scan lines, film grain, vignette
- **Satellite Orbits:** CelesTrak TLE + satellite.js (CDN loaded) for SGP4 propagation. 12h cache.
- **Aircraft:** OpenSky Network — CORS blocked from custom domains. Needs a Supabase Edge Function proxy for production.
- **Nearby POIs:** Overpass API with 7-day localStorage cache

### 5. DIRECT MESSAGING
- New `direct_messages` table (SQL migration: `sql/add_direct_messages.sql`)
- Messages tab in Comms page (between Channels and External Groups)
- Conversation list, staff picker, real-time delivery, read receipts
- Member names fixed (flatten nested users object from getCompanyMembers)

### 6. OTHER IMPROVEMENTS
- Editable operation address in intake document with geocoding
- AddressAutocomplete accepts lat/lng coordinates (e.g., `39.744885, -78.368760`)
- Double-click operation pin navigates to Planning page with auto-expand
- Copyright 2025→2026, dead social links fixed, favicon on all pages
- Legal pages restructured with shared CSS

---

## SQL Migrations To Run

These need to be run in Supabase SQL Editor if not already done:

| File | Status | Purpose |
|------|--------|---------|
| `sql/add_staff_locations_table.sql` | Run if not done | Staff GPS tracking |
| `sql/add_tactical_map_tables.sql` | Run if not done | Location history, annotations, geofence alerts, checkpoint lat/lng |
| `sql/add_direct_messages.sql` | **NEEDS TO BE RUN** | Direct messaging between staff |
| `sql/add_location_sharing_column.sql` | Run if not done | Profile location preference |

---

## GitHub Secrets Required

| Secret | Value | Purpose |
|--------|-------|---------|
| `NEXT_PUBLIC_CESIUM_TOKEN` | (see .env.local) | Cesium Ion 3D globe |
| `NEXT_PUBLIC_SENTINEL_HUB_INSTANCE_ID` | (see .env.local) | Sentinel-1 SAR imagery |
| `NEXT_PUBLIC_SUPABASE_URL` | (existing) | Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (existing) | Supabase |
| `NEXT_PUBLIC_LEGACY_SUPABASE_URL` | (see .env.local) | Legacy training content bridge |
| `NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY` | (see .env.local) | Legacy training content bridge |

---

## Known Issues / Technical Debt

### Critical
- **Backup workflow failing** — `SUPABASE_DB_URL` needs to be changed to the Session Mode pooler URL (not the direct `db.*` URL which is IPv6-only). Get it from Supabase Dashboard → Connect → Session mode.

### High
- **OpenSky Aircraft CORS** — FIXED. Edge Function proxy created at `supabase/functions/opensky-proxy/`. Flight tracker auto-falls back to proxy on CORS failure. **Deploy with:** `supabase functions deploy opensky-proxy`
- **Stale chunk 404s** — Users see 404 errors for old JS chunks after deploys. This is a browser caching issue — hard refresh fixes it. Could be improved with a service worker or cache-busting strategy.

### Medium
- **Sentinel-1 SAR rate limiting** — CDSE free tier has request limits. Currently mitigated with zoom level cap (10) and 6-day cache alignment, but heavy use could still trigger 429s.
- **Component decomposition** — In progress. `tactical-map.tsx` reduced from 1915→1629 lines (Phase 1). `admin/staff/page.tsx` reduced from 2105→1854 lines. See `docs/COMPONENT_DECOMPOSITION_PLAN.md` for full plan.
- **Legacy portal sunset** — admin/, student-portal/, instructor-portal/ still exist but are being replaced by Overwatch. See `docs/LEGACY_MERGE_PLAN.md`.

### Low
- **Whisper WASM dictation** — Works but the ~75MB model download on first use is heavy. Consider server-side Whisper via Edge Function for better UX.
- **Time Machine** — FIXED. Staff positions now replay from `staff_location_history` via `getStaffLocationsAt()`. Breadcrumb trails filter to replay timestamp.
- **Terrain Analysis** — FIXED. Line of Sight and Elevation Profile tool buttons added to map toolbar. Click two points to analyze.
- **Drone Planner** — Waypoints and KML export work. Camera footprint cones and no-fly zone overlay not yet implemented.

---

## Architecture Notes

### Cesium Integration
- CesiumJS loaded from CDN (`cesium.com/downloads/cesiumjs/releases/1.128/`) via script tag injection in `cesium-config.ts`
- NOT bundled via npm (Turbopack can't handle it — causes "expression is too dynamic" errors)
- `satellite.js` also loaded from CDN (`cdn.jsdelivr.net`) for the same reason
- All Cesium types declared in `src/types/cesium.d.ts` (minimal stubs)

### Map State Management
- Layer visibility: `localStorage` per company (`tactical-map-{companyId}`)
- Camera position: `localStorage` per company (`tactical-cam-{companyId}`)
- Site map bounds: `localStorage` per event (`site-map-bounds-{eventId}`) + DB fallback
- Annotations: `map_annotations` table with Supabase Realtime

### Push Authentication
- `git push origin main` may prompt for auth
- Alternative: `$token = gh auth token; git push "https://x-access-token:${token}@github.com/EvenfallAdvantage/evenfalladvantage.github.io.git" main`

### Git Identity
- Name: `denalifox`
- Email: `denalifox@users.noreply.github.com`

---

## Recommended Next Steps

1. ~~Wire Time Machine to staff history~~ DONE
2. ~~Wire Terrain Analysis UI~~ DONE
3. ~~Build OpenSky Edge Function proxy~~ DONE — needs `supabase functions deploy opensky-proxy`
4. ~~Build Comms → Map integration~~ DONE (send location button in channels + DMs)
5. ~~Add DM button to staff pin popups~~ DONE
6. ~~Component decomposition sprint~~ Phase 1 DONE — Phase 2 (custom hooks) remaining

### New Next Steps
1. **Set applicant-documents bucket to private** in Supabase Dashboard → Storage → applicant-documents → Settings. Code already generates signed URLs.
2. **Deploy opensky-proxy Edge Function** — `supabase functions deploy opensky-proxy`
3. **Add CHECKR_WEBHOOK_SECRET** to Supabase Edge Function secrets (get from Checkr Dashboard)
4. **Add NEXT_PUBLIC_LEGACY_SUPABASE_URL and _ANON_KEY** to GitHub Secrets (values in .env.local)
5. **Continue component decomposition** — Extract useEffect hooks from tactical-map.tsx into custom hooks; extract tab views from admin/staff
6. **Decompose admin/events/page.tsx** (1766 lines) — Extract CreateOperationWizard, ShiftRow components
7. **Add realtime subscriptions** to stale pages (notifications, directory, updates feed)
