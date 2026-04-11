# Session Handoff — April 11, 2026

**Project:** Evenfall Advantage — Overwatch Platform
**Repo:** https://github.com/EvenfallAdvantage/evenfalladvantage.github.io
**Working Directory:** `C:\Users\54MUR41\projects\evenfalladvantage.github.io`
**Latest commit:** `15dee4620` on `main` (double-click operation navigation)
**Commits this session:** ~80+
**CI/CD:** Build & Deploy passing. Backup workflow needs Supabase pooler URL fix.

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
| `NEXT_PUBLIC_CESIUM_TOKEN` | `eyJhbGci...T-wJKrOTvF7bn9A8Js7b19dAB4Q2GaCrF50nN0egTQ0` | Cesium Ion 3D globe |
| `NEXT_PUBLIC_SENTINEL_HUB_INSTANCE_ID` | `8f6b57a4-a080-447a-b28f-53ec694894a8` | Sentinel-1 SAR imagery |
| `NEXT_PUBLIC_SUPABASE_URL` | (existing) | Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (existing) | Supabase |

---

## Known Issues / Technical Debt

### Critical
- **Backup workflow failing** — `SUPABASE_DB_URL` needs to be changed to the Session Mode pooler URL (not the direct `db.*` URL which is IPv6-only). Get it from Supabase Dashboard → Connect → Session mode.

### High
- **OpenSky Aircraft CORS** — The flight tracking layer is blocked by CORS. Need a Supabase Edge Function proxy to relay requests.
- **Stale chunk 404s** — Users see 404 errors for old JS chunks after deploys. This is a browser caching issue — hard refresh fixes it. Could be improved with a service worker or cache-busting strategy.

### Medium
- **Sentinel-1 SAR rate limiting** — CDSE free tier has request limits. Currently mitigated with zoom level cap (10) and 6-day cache alignment, but heavy use could still trigger 429s.
- **Component decomposition** — 15 files over 700 lines (see `docs/COMPONENT_DECOMPOSITION_PLAN.md`). `tactical-map.tsx` is now ~1700 lines and should be split.
- **Legacy portal sunset** — admin/, student-portal/, instructor-portal/ still exist but are being replaced by Overwatch. See `docs/LEGACY_MERGE_PLAN.md`.

### Low
- **Whisper WASM dictation** — Works but the 150MB model download on first use is heavy. Consider server-side Whisper via Edge Function for better UX.
- **Time Machine** — Timeline slider built but staff position filtering by timestamp not yet wired up (the `onTimeChange` callback needs to filter `staff_location_history` queries by the replay timestamp).
- **Terrain Analysis** — Line-of-sight and elevation profile code is complete but not wired into a UI tool button yet. The functions are in `terrain-tools.ts` and can be called from the click handler.
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

1. **Wire Time Machine to staff history** — Filter `getLocationHistory()` calls by `replayTime` instead of `Date.now()` when Time Machine is active
2. **Wire Terrain Analysis UI** — Add "Line of Sight" and "Elevation Profile" buttons to the tools bar, connect to the click handler
3. **Build OpenSky Edge Function proxy** — Simple Supabase Edge Function that relays requests to OpenSky API (avoids CORS)
4. **Build Comms → Map integration** — "Send location" button in chat, message toasts on staff pins
5. **Add DM button to staff pin popups** on the tactical map — "Message this person" link
6. **Component decomposition sprint** — Split `tactical-map.tsx` (1700 lines) into sub-components per the decomposition plan
