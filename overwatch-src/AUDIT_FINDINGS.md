# Overwatch Codebase Deep Audit - March 2026

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
