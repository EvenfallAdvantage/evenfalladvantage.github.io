# Session Handoff — April 3-6, 2026

**Project:** Evenfall Advantage — Overwatch Platform
**Repo:** https://github.com/EvenfallAdvantage/evenfalladvantage.github.io
**Working Clone:** `C:\Users\54MUR41\projects\evenfalladvantage.github.io\audit-clone`
**Commits this session:** 80+
**SOC 2 Readiness:** 92% (70/76 controls)
**WCAG:** 2.2 AA (17/18 criteria met)

---

## What Was Completed

### Security (Session 1)
- XSS sanitization: 52 innerHTML vectors across 18 JS files
- CORS hardening on all 6 Edge Functions (origin allowlist)
- JWT enforcement on send-email function
- Admin role verification on create-student, delete-student, send-email
- Stripe webhook signature enforcement (no unsigned fallback)
- Admin INSERT policy fix (prevents self-promotion)
- Multi-provider AI question generator (8 providers, localStorage config)
- Gemini API key removed and rotated

### Features (Session 1)
- Applicant pipeline: 6-section form, detail modal, carry-over, profile sections
- Storyboard system: StoryboardEditor (90+ icons), site map upload, incident pins
- Address autocomplete (Nominatim) on planning + apply forms
- Intake edit cascade (auto-updates OPORD/GOTWA, auto-creates draft FRAGO)
- Editable incidents, re-editable OPORD/GOTWA, IntakePanel with site map

### Features (Session 2)
- Dynamic brand theming: dual color picker, CSS variable injection, BrandThemeProvider
- Page titles moved to topbar (26 pages), mobile action buttons
- Unified subtabs (12+ pages), icons on active only
- Dashboard clock-in modal with shift detection
- Landing page: mobile radar animation, feature carousel, footer redesign
- Join Company modal, Privacy Policy modal
- Confirm password + eye toggles on auth forms
- Personal profile syncs across all company memberships
- Cross-company data isolation (timesheets, analytics, Watch Log, Dashboard)
- Built-in error tracking system (error_logs + ErrorBoundary + admin viewer + alerting)
- Health check page (/overwatch/health/) for UptimeRobot
- Expanded form builder (14 field types)
- Field report submissions as expandable cards (user + admin views)
- Edit/delete field reports + incidents with audit trail (change_log)

### Infrastructure
- CI/CD: Next.js built in GitHub Actions, concurrency groups
- Removed 603 committed build artifacts
- Service worker cache versioned (v9)
- Dependabot + CodeQL + npm audit in CI
- Branch protection on main (1 required reviewer)
- Automated daily database backup via GitHub Actions (pg_dump)
- Local Supabase staging environment
- 51 automated tests (Vitest)

### Compliance (SOC 2: 92%)
- 20 compliance documents in docs/compliance/
- Information Security Policy, Incident Response Plan, Data Retention Policy
- Vendor Risk Assessment (DPAs executed with all 4 vendors)
- Risk Assessment (Q2 2026 completed), Access Review Checklist
- Business Continuity Plan, SLA, Subprocessor List
- Security Awareness Training, Org Chart, Log Review Procedures
- Threat Model (STRIDE), Shared Accounts Audit
- WCAG 2.2 AA Audit Report
- Backup drill report

### Accessibility (WCAG 2.2 AA)
- Skip-to-content link, mobile zoom re-enabled
- 52 aria-labels on icon-only buttons
- Text contrast fixes (white/15-40 → white/50-60)
- Focus indicators added
- Global CSS min 24x24px target size
- Storyboard arrow key nudging (drag alternative)

---

## In-Progress / Uncommitted Work

**NO uncommitted work.** Everything has been committed and pushed.

---

## Remaining Items — Beta Tester Feedback (NOT YET STARTED)

These 7 items were just discussed but implementation was interrupted:

### Item 1: Edit External Group Cards (LOW — 30 min)
**File:** `src/app/chat/page.tsx`
- Add edit button (Pencil) on external group cards
- Inline edit: name, URL, platform dropdown
- Save updates channel's `description` JSON metadata
- State needed: `editingExternal`, `extEditForm`

### Item 2: Dictate / Speech-to-Text (HIGH — 3-4 hrs)
**New files needed:**
- `src/components/dictation-recorder.tsx` — Recording component
- `src/app/dictate/page.tsx` — New Dictate page

**Design decisions made:**
- Primary: Web Speech API (free, real-time, Chrome/Edge/Safari)
- Fallback: Whisper.js for offline (40MB model, cached in IndexedDB)
- Store transcript only (no audio files)
- Fields: person type, person name, transcript, date/time, linked incident
- Tab order: Dictate → Field Reports → Incidents

### Item 3: Reorder Reports Subtabs (LOW — 5 min)
**Files:** `src/app/incidents/page.tsx`, `src/app/forms/page.tsx`, new `src/app/dictate/page.tsx`
- New order: Dictate (Mic icon), Field Reports, Incidents
- Add Dictate link tab to existing incidents and forms pages
- Import `Mic` from lucide-react

### Item 4: Move Join Code to HQ Config (LOW — 15 min)
- Remove from `src/app/profile/page.tsx` (the "TEAM JOIN CODE" card)
- Remove from `src/app/admin/staff/page.tsx` (the amber banner + topbar button)
- Already exists in `src/app/admin/settings/page.tsx` (verify)

### Item 5: Real-time Chat (MEDIUM — 1-2 hrs)
**File:** `src/app/chat/page.tsx`
- Use Supabase Realtime: `supabase.channel('chat').on('postgres_changes', ...)`
- Subscribe on channel select, unsubscribe on unmount
- Append new messages to local state
- Also subscribe to reactions for live emoji updates

### Item 6: Channel Role Permissions (MEDIUM — 1-2 hrs)
**DB change:** Add `permissions` JSONB to `chat_channels`
```json
{ "can_post": ["owner","admin","manager","staff"], "can_react": [...], "can_pin": [...] }
```
- New Channel modal: role permission checkboxes
- Channel settings: gear icon to edit permissions
- Disable message input if user's role not in `can_post`

### Item 7: Client Intake Portal (HIGH — 3-4 hrs)
**New files needed:**
- `src/app/client-intake/[token]/page.tsx` — Public intake form
- `prisma/add-client-intake-tokens.sql` — Token table
- `src/lib/supabase/db-client-intake.ts` — DB functions

**Design decisions made:**
- Shareable link: `/overwatch/client-intake/[token]`
- No account needed for client
- Company branded (logo + colors from company settings)
- Client can revisit to iterate/update
- Admin gets Briefing notification on submission
- Token expires when operation starts or manually revoked
- Embeddable widget deferred to Phase 2

---

## Remaining SOC 2 Gaps (3 items)

| # | Control | What's Needed |
|---|---------|--------------|
| 1 | Vendor SOC 2 reports reviewed | Emails sent — waiting for responses. Templates at `docs/compliance/vendor-soc2-request-emails.md` |
| 2 | Annual penetration test | $5-15K hire. Recommended firms: Cobalt, Synack, HackerOne |
| 3 | Leaked password protection | Supabase paid feature — can ignore for now |

---

## SQL Migrations Pending

Check if these have been run in OverwatchDB:
```sql
-- Form submissions changelog (may already be done)
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS change_log JSONB DEFAULT '[]';
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Error logs RLS fix (may already be done)
-- Check: SELECT policyname FROM pg_policies WHERE tablename = 'error_logs';
```

---

## GitHub Secrets Required

| Secret | Status |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Set |
| `SUPABASE_DB_URL` | Set (for daily backup workflow) |

---

## Key Architecture Notes

- **Static export:** `output: "export"` in next.config.ts — no API routes in production
- **Two Supabase instances:** Legacy (`vaagvairvwmgyzsmymhs`) + Overwatch (`nneueuvyeohwnspbwfub`)
- **Auth pattern:** `users.id` (internal UUID) ≠ `auth.uid()` (Supabase Auth UUID). Bridge via `users.supabase_id = auth.uid()::text`
- **RLS helper:** `is_company_member(company_id)` — use this for all new RLS policies
- **Brand theming:** `BrandThemeProvider` injects CSS vars from company's `brand_color` + `accent_color`
- **Page headers:** Use `usePageHeader` store — `setHeader(title, subtitle, icon, actions)` in useEffect
- **Subtab convention:** Icons only on active tab, `overflow-x-auto` on all tab bars
- **Edge Functions:** All require JWT except webhooks; CORS restricted to evenfalladvantage.com
- **Storyboard:** `created_by` must be internal user ID (not auth UUID); use `storyboardIdRef` for debounced saves
- **Cross-company isolation:** ALL timesheet/analytics queries must filter by `company_id`

---

## Files to Know

| File | Purpose |
|------|---------|
| `src/stores/page-header-store.ts` | Zustand store for topbar title/subtitle/icon/actions |
| `src/stores/auth-store.ts` | Auth + active company state |
| `src/components/brand-theme-provider.tsx` | CSS variable injection from company colors |
| `src/components/storyboard-editor.tsx` | Pin-based map annotation (~1100 lines) |
| `src/components/address-autocomplete.tsx` | Nominatim geocoding typeahead |
| `src/components/mobile-page-action.tsx` | Renders page actions on mobile |
| `src/components/error-boundary.tsx` | React error boundary + error_logs |
| `src/lib/error-tracker.ts` | Global error handler + Supabase logging |
| `src/lib/error-alerter.ts` | Auto-posts Briefing alert for new errors |
| `src/components/layout/topbar.tsx` | Top header bar with page title + actions |
| `src/components/layout/dashboard-shell.tsx` | Main layout wrapper with skip-nav |
| `src/components/ops/intake-panel.tsx` | Editable intake with cascade logic |
| `docs/compliance/` | 20 SOC 2 compliance documents |
| `.github/workflows/deploy.yml` | CI/CD: test → audit → build → deploy |
| `.github/workflows/backup.yml` | Daily pg_dump backup |
| `.github/workflows/codeql.yml` | Weekly SAST analysis |

---

**End of handoff. Next session should start with Phase 1 quick wins (items 1, 3, 4) then proceed to Phase 2-4.**
