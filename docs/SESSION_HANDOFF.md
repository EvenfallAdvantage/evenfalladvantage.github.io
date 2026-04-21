# Session Handoff — April 15, 2026

**Project:** Evenfall Advantage — Overwatch Platform
**Repo:** https://github.com/EvenfallAdvantage/evenfalladvantage.github.io
**Working Directory:** `C:\Users\54MUR41\projects\evenfalladvantage.github.io`
**CI/CD:** Build & Deploy passing on GitHub Pages. Next.js 16.2.4, Node 22.
**Tests:** 519/519 passing (28 test files), 0 TypeScript errors.
**ESLint:** 0 errors, 0 warnings. Lint is blocking in CI (--max-warnings 0).
**npm audit:** 0 vulnerabilities (all patched April 15).
**Navigation:** Client-side via Next.js `<Link>`.

---

## What Was Done This Session (April 13-15, 2026)

### DEPENDENCY MANAGEMENT & CI/CD (April 13)
- Merged 15 Dependabot PRs, closed 2 (ESLint 10 incompatible, @types/qrcode.react stub)
- TypeScript 6.0 compat: `noUncheckedSideEffectImports: false`
- Service worker build-time versioning via GITHUB_SHA injection
- CI: Node 22, actions/cache v5, upload-pages-artifact v5, lint blocking (--max-warnings 0)
- npm audit: patched protobufjs (critical), next 16.1.6→16.2.4 (high), dompurify + hono (moderate)

### COMPONENT DECOMPOSITION (April 13)
17 pages decomposed, total reduction from 13,382 → 1,942 lines (−85%):
- tactical-map.tsx: 1,943 → 410 (8 hooks + types + DM modal)
- admin/staff/page.tsx: 2,173 → 202 (8 tab components + 2 modals)
- admin/events/page.tsx: 1,674 → 217 (wizard + operation detail)
- feed/page.tsx: 1,121 → 69 (11 components)
- incidents/page.tsx: 981 → 131 (6 components)
- operation-detail.tsx: 940 → 272 (5 focused components)
- Plus 11 more pages (geo-risk, profile, instructor, training, schedule, chat, site-assessment, academy, settings, timeclock, apply, updates)

### TEST COVERAGE: 58 → 519 Tests (April 13-14)
- security-full (43), db-helpers (22), db-postings (30), db-badges (25)
- db-intake-shares (15), db-assessments (19), db-operations across 6 files (118)
- db-users (82), component tests (15), auth-guard (4), timeclock-utils (20)
- incident-constants (24), assessment-types (22), db-error (6), export-csv (18)

### FEATURES SHIPPED (April 13-15)

#### Mass Clock System (scan/page.tsx — rewritten)
- Event selector (dropdown, persists to localStorage, warns if no event)
- Live "Currently Clocked In" panel (auto-refresh 10s, shows names + elapsed time)
- Mass Clock Out button (one-click, event-filtered, confirmation dialog)
- Per-badge 30s cooldown (prevents accidental double-scan toggle)
- 1.5s result display (reduced from 3s for faster throughput)
- Audio feedback (ascending=in, descending=out, buzz=error, vibration on mobile)
- Offline queue (queues when actually offline, retries on reconnect, stores eventId)
- Better error messages (shows actual DB error instead of fake "Queued" for RLS issues)
- Cross-company badge validation (rejects badges from other companies)
- `crypto.randomUUID()` fallback for older Safari

#### Badge Management
- Bulk "Generate All Badges" + "Download All" buttons on roster
- Badge preview modal (QR card preview + download button) instead of auto-download
- Staff can view/download their own badge from Profile page
- `getMyBadge()` read-only self-lookup function

#### CSV Staff Import with Column Mapper
- Visual column mapping UI (fuzzy auto-match headers like "Legal Name" → first_name)
- SKIP_HEADERS prevents "Full Name" from matching individual name fields
- New importable fields: nickname, city, shirt_size, region, status
- Status normalization: "Active" → hired, "Approved for Hire" → offered, etc.
- Bulk applicant import with status constraint validation

#### Applicants → Roster Conversion
- "Convert Hired to Roster" bulk button on Applicants tab
- Uses `convert_applicant_to_roster` RPC (SECURITY DEFINER) to bypass RLS
- Creates users + company_memberships (status='active', role='staff')
- Doesn't downgrade existing roles (ON CONFLICT preserves owner/admin/manager)
- Select all / bulk delete for applicants tab

#### Pay Rates
- Event-based pay rates with member override (cascade: member → event → company default)
- Pay rate editor on roster member cards (inline edit, green if override)
- Event pay rate field in creation wizard + operation detail
- Timesheets tab shows Rate × Hours = Pay columns with totals
- Staff profile Pay Stub card (rate, total hours, total pay, recent timesheets)
- SQL: `default_pay_rate` on companies, `pay_rate` on events, `pay_rate_override` on memberships

#### Timezone Support
- Events have timezone field (IANA format, e.g., 'America/Los_Angeles')
- Company default timezone as fallback
- `localToUTC()` / `formatInTimezone()` / `utcToLocalInput()` utilities
- Shift creation converts times through event timezone
- Shift display uses event timezone (schedule, timeclock, operation detail)
- Timezone selector dropdown in event creation wizard
- Backwards compatible: existing events without timezone use browser-local

#### Shift CSV Upload
- "Import Shifts" button in shift management
- 3-step flow: upload → column map → preview + import
- Auto-suggests mapping for Date, Start/End Time, Role, Staff Email
- Converts to UTC using event timezone
- Resolves staff_email to user IDs from company members

#### Post Orders
- Event-level post orders (rich text area, collapsible section in operation detail)
- Per-shift override (optional textarea in custom shift form)
- Staff can view post orders in schedule tab (ScrollText icon per shift)
- Resolution: shift post_orders → event post_orders → null

#### Site Assessment → Database
- Multi-assessment DB persistence (save/load/delete, list panel)
- Assessment ↔ Intake bidirectional linking ("Create Op from Assessment" + "Link Assessment" picker)

#### Error Feedback
- `logDbReadError()` toast + console for all DB read failures (13 modules, ~65 functions)
- Scan page shows actual DB errors instead of generic messages

#### Mobile Responsiveness
- All 22 modals audited — `p-4` padding, `w-full max-w-*`, `max-h-[90vh] overflow-y-auto`
- `overflow-x-hidden` on html+body+page root to fix modal centering
- Shadcn DialogContent base component fixed

#### Timesheets Admin
- Delete unapproved timesheets (trash icon per entry)
- Unapprove approved timesheets (revert to pending)
- Delete any entry including approved (stricter confirmation)
- Timesheet limit increased from 50 → 1000

#### Profile & Dashboard
- Clock status auto-refresh every 15s + on tab focus (timeclock + dashboard)
- Activity feed filtered by active company
- Badge card on profile (view + download own badge)

### RLS / SQL FIXES APPLIED
- `v2_fix_rls_auth_uid.sql` — Fixed `is_company_manager()` to JOIN through `users.supabase_id`
- `rpc_convert_applicant.sql` — SECURITY DEFINER RPC for applicant→roster conversion
- `fix_onboarding_to_active.sql` — Updated converted memberships to status='active'
- `managers_insert_timesheets` — RLS INSERT policy for manager+ to create timesheets for others
- `managers_delete_timesheets` — RLS DELETE policy for manager+ company-wide
- Dropped 5 broad SELECT policies on public storage buckets (avatars, certs, logos, field-manual, operation-maps)
- `add_pay_rates.sql` — pay rate columns on companies, events, memberships
- `add_timezones.sql` — timezone columns on events, companies
- `add_post_orders.sql` — post_orders columns on events, shifts

---

## SQL Migrations To Run (if not already done)

| File | Purpose |
|------|---------|
| `sql/add_pay_rates.sql` | `default_pay_rate` on companies, `pay_rate` on events, `pay_rate_override` on memberships |
| `sql/add_timezones.sql` | `timezone` on events, `timezone` on companies |
| `sql/add_post_orders.sql` | `post_orders` on events, `post_orders` on shifts |

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
- **Instructor role lacks scan permissions** — Instructors can't mass clock (RLS blocks). Workaround: promote to manager. Fix: add 'instructor' to `is_company_manager()`.

### Medium
- **Offline scan retry always clocks IN** — doesn't check if person was already clocked in. Brief operators: if WiFi drops, only scan for clock-INs.
- **Cross-device race condition** — two scanners can double-clock-in same person (no DB unique constraint). Mitigated by physical badge control.
- **Sentinel-1 SAR rate limiting** — Free tier has request limits.
- **Landing page (720 lines)** — not decomposed (low churn, mostly static marketing).
- **6 suppressed ESLint directives** — storyboard-editor (3), theme-toggle (1), settings data-load (1), address-autocomplete (1).

### Low
- **XML job feed deployment** — Edge Function scaffolded at `supabase/functions/job-feed/`. Needs `supabase functions deploy job-feed --no-verify-jwt`.
- **Offline queue not persisted** — tab close/refresh loses queue (useState only, not localStorage).
- **No event filter on "Currently Clocked In" panel** — shows all company staff, not just event-specific.

---

## Architecture Notes

### Mass Clock Flow
1. Event selector → localStorage persistence
2. Camera → jsQR decode → handleScan
3. lookupBadge (staff_badges + users join via FK name) → company validation
4. isUserClockedIn → qrClockIn/qrClockOut (using activeCompanyId)
5. Per-badge 30s cooldown map → audio feedback → live panel refresh

### Pay Rate Resolution
1. `company_memberships.pay_rate_override` (per-person)
2. `events.pay_rate` (per-operation)
3. `companies.default_pay_rate` (fallback)

### Timezone Resolution
1. `events.timezone` (per-event, IANA format)
2. `companies.timezone` (company default)
3. Browser timezone (last resort for old events)

### Post Orders Resolution
1. `shifts.post_orders` (per-shift override)
2. `events.post_orders` (event default)
3. null (no post orders)

### FK Disambiguation (PostgREST)
Multiple tables have 2+ FKs to `users`. Must specify FK name:
- `timesheets` → `users!timesheets_user_id_fkey`
- `staff_badges` → `users!staff_badges_user_id_fkey`
- `company_memberships` → standard (only one FK)

### Key Patterns
- **Badge QR format**: `JSON.stringify({ uid, cid, bn })` — immutable per badge
- **RPC for privileged operations**: `convert_applicant_to_roster` (SECURITY DEFINER)
- **CSV column mapper**: `parseCSVRaw` → `suggestMapping/suggestShiftMapping` → `applyMapping/applyShiftMapping` → validate → bulk insert
- **Service worker**: `CACHE_NAME = "overwatch-__BUILD_HASH__"` injected by CI
- **Error feedback**: `db-error.ts` → toast + console for all DB read failures
- **Scan error handling**: only queues when `navigator.onLine` is false; shows actual DB error when online

### Git Identity
- Name: `denalifox`
- Email: `denalifox@users.noreply.github.com`

### Push Authentication
```powershell
$token = gh auth token; git push "https://x-access-token:${token}@github.com/EvenfallAdvantage/evenfalladvantage.github.io.git" main
```

---

## Recommended Next Steps

1. **Donnaroo smoke test this weekend** — event created, shifts assigned, badges printed, mass clock ready
2. **Auth email invites** — Supabase Edge Function calling `auth.admin.inviteUserByEmail()` for new roster members
3. **Fix instructor scan permissions** — add 'instructor' to `is_company_manager()` or create separate scan RLS
4. **Persist offline scan queue** — move from useState to localStorage/IndexedDB
5. **Add event filter to "Currently Clocked In" panel** — filter by selected eventId
6. **More component tests** — expand `.test.tsx` coverage (roster, incident form, clock-in modal)
7. **Backup workflow fix** — `SUPABASE_DB_URL` Session Mode pooler URL (IPv4)
8. **Rich text editor for post orders** — upgrade textarea to proper editor (TipTap/ProseMirror)
