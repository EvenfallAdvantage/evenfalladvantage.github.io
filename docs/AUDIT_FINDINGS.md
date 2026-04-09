# Overwatch Codebase Deep Audit - Updated April 8, 2026

> **Previous audit:** March 2026 | **Latest audit:** April 8, 2026

## 0. APRIL 8 AUDIT — COMPLETED FIXES

### Critical Security (all fixed this session)
- [x] Backup workflow: no longer commits DB dumps to public repo (now uses artifacts)
- [x] Deploy workflow: scoped to public files only (sql/, supabase/, sop/, docs/ excluded)
- [x] Wildcard CORS export removed from `_shared/cors.ts`
- [x] `send-welcome-email` Edge Function: admin role check added, API key logging removed
- [x] `admin/test.html` deleted (unauthenticated DB query page)
- [x] XSS in `js/messages.js` fixed: all innerHTML now uses escapeHTML()
- [x] XSS in `admin/js/admin-dashboard.js` fixed: profile.bio now sanitized
- [x] `send-email` Edge Function: now imports shared CORS module
- [x] `.gitignore` updated: backups/, *.dump, *.exe, audit-clone/

### Dead Code Removed (this session)
- [x] 23 files deleted: 2 abandoned google-meet projects, 5 orphaned JS/CSS, broken pages, dev tools
- [x] 6 orphaned images removed
- [x] 4 dead API routes removed (2 had Edge Function equivalents, 2 converted to new Edge Functions)

### Infrastructure (this session)
- [x] Supabase browser client refactored to singleton (258 call sites, 1 line change)
- [x] 2 new Edge Functions created: `webhook-checkr`, `webhook-fillout`
- [x] All 8 Edge Functions now declared in config.toml
- [x] `npm audit` in CI changed from soft-fail to fail-on-critical
- [x] Legal pages restructured: shared CSS, header/footer, Google Fonts, skip-nav, favicon

### Remaining from April 8 Audit (see COMPONENT_DECOMPOSITION_PLAN.md)
- [ ] Decompose 15 monolithic components (>700 lines each)
- [ ] Formal Prisma migration system (replace 102 ad-hoc SQL files)
- [ ] Legacy portal sunset (admin/, student-portal/, instructor-portal/)
- [ ] Expand test coverage (currently 51 tests for 49 pages)
- [ ] Missing Resend DPA in DPAs/ directory

---

# Original March 2026 Audit

## 1. HALLUCINATED / FAKE DATA

### Dashboard (feed/page.tsx) and Intel Center (admin/reports/page.tsx)
- Weekly hours chart: Fakes Mon-Sun breakdown with hardcoded variation array
- Weekly incidents chart: Same fake pattern
- Compliance rate: Fabricated formula (70 + hrs/(mc*2)*10), not real
- Status breakdown: Hardcoded 60% On Duty, 30% Off Duty, 10% On Leave
- Trend indicators: All hardcoded strings like +2, +1, +8.5h, +5%
- Activity summary: Patrols=ec*0.7, Training=mc*1.5, Shifts=mc*5.2 (all fake)

### db.ts getCompanyStats (line 1307)
- Missing parseUTC fix on timesheet calculations

## 2. BACKLOG / INCOMPLETE

### Pending SQL (USER must run)
- prisma/fix-join-rls.sql (join company RPC)
- prisma/fix-member-mgmt.sql (role management RPCs)

### Client-only tools (no DB persistence)
- invoices: localStorage only
- site-assessment: localStorage only
- geo-risk: static state crime data
- state-laws: static data file
- training/scenarios: static de-escalation scenarios
- instructor: Daily.co video, no session history

### Code quality
- parseUTC duplicated in 4 files (feed, timeclock, admin/staff, profile)
- ensureInternalUser() calls getUser() every time, no caching
- db.ts is 2400 lines with no domain splitting
- Pervasive type X = any patterns

## 3. EFFICIENCY / OPTIMIZATION

### Database
- getCompanyStats fetches 500 rows to sum hours (should use DB aggregate)
- getCompanyTimesheets does client-side company filtering (should use DB join)
- Two Supabase instances (Overwatch + Legacy) - merge recommended long-term
- No read replicas or failover configured

### Auth
- ensureInternalUser calls getUser each time - should cache per session

### Repo
- 30+ markdown docs cluttering repo root
- Legacy portals still independently functional

## 4. LAYOUT / UX IMPROVEMENTS

### Dashboard
- Fake charts and stats mislead users - replace with real or remove
- Intel section takes too much space with fabricated data

### General
- No loading skeletons on most pages
- Mobile sidebar flyout positioning could improve
- No per-page error boundaries

## IMPLEMENTATION PLAN

### Phase 1 - Critical (implement now)
1. Extract parseUTC to shared utility, remove duplication
2. Fix parseUTC in getCompanyStats
3. Remove ALL fake data from dashboard and intel center
4. Replace fake trends/charts with real DB queries or honest empty states
5. Cache ensureInternalUser result per page session

### Phase 2 - Important (implement now)
6. Add real weekly breakdown queries (timesheets by day-of-week)
7. Add real on-duty/off-duty counts from active timesheets
8. Optimize getCompanyTimesheets with proper DB join

### Phase 3 - Recommended (future)
9. Split db.ts into domain modules
10. Add proper TypeScript types
11. Legacy DB merge planning
12. Multi-region health check
13. Clean up repo root markdown files
