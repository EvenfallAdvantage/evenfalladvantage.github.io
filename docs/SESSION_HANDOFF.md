# Session Handoff — April 12, 2026

**Project:** Evenfall Advantage — Overwatch Platform
**Repo:** https://github.com/EvenfallAdvantage/evenfalladvantage.github.io
**Working Directory:** `C:\Users\54MUR41\projects\evenfalladvantage.github.io`
**Latest commit:** `9372c5886` on `main`
**CI/CD:** Build & Deploy passing on GitHub Pages.
**Tests:** 51/51 passing, 0 TypeScript errors.

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
| `sql/v2_upgrade_tables.sql` | **RUN** | All v2 tables (site_assessments, intake_shares, job_postings, staff_badges) |
| `sql/add_events_settings_column.sql` | Run if not done | JSONB settings column for site map bounds |

### RLS Fixes (run manually if not done)
The v2 tables need `WITH CHECK` clauses for INSERT. Run this:
```sql
-- Fix all v2 table RLS policies
DROP POLICY IF EXISTS "staff_badges_access" ON staff_badges;
CREATE POLICY "staff_badges_auth" ON staff_badges FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "intake_shares_access" ON intake_shares;
CREATE POLICY "intake_shares_manage" ON intake_shares FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "intake_shares_public_read" ON intake_shares FOR SELECT USING (true);

DROP POLICY IF EXISTS "job_postings_access" ON job_postings;
CREATE POLICY "job_postings_manage" ON job_postings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "job_postings_public_read" ON job_postings FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "site_assessments_access" ON site_assessments;
CREATE POLICY "site_assessments_manage" ON site_assessments FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
```

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
- **Stale chunk 404s after deploy** — Users need Ctrl+Shift+R after deploys. A service worker would fix this permanently.
- **Backup workflow failing** — `SUPABASE_DB_URL` needs Session Mode pooler URL.

### Medium
- **Site assessment still localStorage** — DB module (`db-assessments.ts`) is ready but the page UI hasn't been updated to use it yet. Need to add save/load from DB + "Create Operation" flow.
- **Assessment ↔ Intake integration** — Both directions (assessment-first and operation-first) planned but not built.
- **Component decomposition** — tactical-map.tsx still ~1600 lines. Phase 2 (custom hooks extraction) remaining.
- **Sentinel-1 SAR rate limiting** — Free tier has request limits.

### Low
- **XML job feed endpoint** — Generator function exists in `db-postings.ts` but no API route to serve it.
- **LinkedIn/ZipRecruiter API** — Integration scaffolding not yet built. Requires partner approvals.
- **Whisper WASM dictation** — 75MB model download on first use.
- **Drone Planner** — Camera footprint cones and no-fly zones not implemented.

---

## Architecture Notes

### New DB Tables (v2)
- `site_assessments` — Persisted security assessments
- `intake_shares` — Token-based client intake share links
- `job_postings` — Job listing management with status workflow
- `staff_badges` — QR badge records with badge numbers

### New Dependencies Added
- `qrcode` + `@types/qrcode` — QR code generation for badges
- `jsqr` — QR code scanning from camera feed

### Key Patterns
- **Badge download**: Shared `badge-download.ts` used by both roster inline buttons and standalone badge-generator
- **Public pages**: `/intake?t={token}`, `/careers?company={slug}`, `/apply?c={id}` — all use query params (not path segments) due to `output: "export"` static hosting
- **Sidebar navigation**: All links use native `<a>` tags with `/overwatch` basePath prefix
- **Tactical map click handler**: Entity picking runs FIRST (before globe.pick) to ensure billboard clicks work. `losEntityIds` is a ref, not state, to prevent infinite handler recreation.

### Git Identity
- Name: `denalifox`
- Email: `denalifox@users.noreply.github.com`

### Push Authentication
- `$token = gh auth token; git push "https://x-access-token:${token}@github.com/EvenfallAdvantage/evenfalladvantage.github.io.git" main`

---

## Recommended Next Steps

1. **Update site assessment page to use DB** — Replace localStorage with `db-assessments.ts`, add "Create Operation from Assessment" button
2. **Assessment ↔ Intake bidirectional linking** — Import assessment data into intake, link assessment to operation
3. **XML job feed route** — Supabase Edge Function or Next.js API route serving XML for Indeed auto-indexing
4. **LinkedIn/ZipRecruiter API scaffolding** — OAuth connection UI in settings, posting logic
5. **Component decomposition Phase 2** — Extract tactical-map.tsx useEffect hooks into custom hooks
6. **Tighten v2 RLS policies** — Current policies allow any authenticated user; should be scoped to company membership
7. **Service worker for cache busting** — Eliminate stale chunk 404s after deploys
8. **Investigate React router + CesiumJS** — Find root cause of why `<Link>` navigation stalls when map is mounted
