# Session Handoff — April 8, 2026

**Project:** Evenfall Advantage — Overwatch Platform
**Repo:** https://github.com/EvenfallAdvantage/evenfalladvantage.github.io
**Working Clone:** `C:\Users\54MUR41\projects\evenfalladvantage.github.io\audit-clone`
**CRITICAL:** Always use the `audit-clone` directory. The root repo is a stale copy — do NOT edit files there.
**Latest commit:** `c20f1f9ae` on `main`
**Commits this session:** 7
**CI/CD:** All green (Build, Deploy, CodeQL all passing)
**SOC 2 Readiness:** 92% (70/76 controls — unchanged)
**WCAG:** 2.2 AA (17/18 criteria met — unchanged)

---

## What Was Completed This Session

### Beta Feedback Items (6 of 7 implemented)

1. **Edit External Group Cards (Item 1)** — Already done in prior session. This session fixed a missing `loadChannels` prop that caused save to fail, and migrated `handleSaveExtEdit` from raw Supabase call to `updateChatChannel()`.

2. **Dictate / Speech-to-Text (Item 2)** — New page + component:
   - `src/components/dictation-recorder.tsx` — Web Speech API recorder with mic permission check, auto-restart on timeout, elapsed timer, browser support detection, actionable error messages
   - `src/app/dictate/page.tsx` — Full dictation page with metadata fields (person type, person name, linked incident), transcript editing, save to DB via form_submissions, expandable saved transcript cards
   - Uses a "Dictation (System)" form auto-created per company

3. **Reorder Reports Subtabs (Item 3)** — Tab order across all 3 report pages: Dictate → Field Reports → Incidents

4. **Move Join Code to HQ Config (Item 4)** — Removed join code card from `profile/page.tsx`, removed join code banner + topbar button from `admin/staff/page.tsx`. Join code already exists in `admin/settings/page.tsx`. Note: `joinCode` state is kept in staff page because the hiring orchestrator still uses it.

5. **Real-time Chat (Item 5)** — Was already implemented (Supabase Realtime at `chat/page.tsx:128-148`).

6. **Channel Role Permissions (Item 6)** — Added `permissions` JSONB support:
   - `ChannelPermissions` type: `{ can_post, can_react, can_pin }` with role arrays
   - Settings2 gear icon in channel header opens permission editor
   - Role toggle chips for all 7 roles (owner, admin, instructor, manager, lead, breaker, staff)
   - Message input disabled with notice when user's role not in `can_post`
   - `updateChatChannel` and `createChatChannel` accept `permissions` param

7. **Client Intake Portal (Item 7)** — New public form:
   - `src/app/client-intake/page.tsx` — Token-based public form at `/overwatch/client-intake/?token=xxx`
   - `src/lib/supabase/db-client-intake.ts` — CRUD for `client_intake_tokens` table
   - Company branded (logo + colors), 4-section tabbed form, revisitable, validates required fields
   - Sections: Site Information, Coverage Requirements, Access & Infrastructure, Security Concerns

### Bug Fixes
- Service worker cache bumped v9 → v10 (fixes stale chunk 404s after deploys)
- CSP `connect-src` updated with `https://*.google.com https://*.googleapis.com` for Web Speech API
- Dictation recorder requests mic permission explicitly via `getUserMedia()` before starting recognition
- External group edit now uses `updateChatChannel()` instead of raw Supabase call
- `loadChannels` prop passed to `ExternalTab` component

### Subtab Icon Consistency
- All report subtabs (Dictate, Field Reports, Incidents) now follow convention: icon only on active tab
- Fixed `forms/page.tsx` header icon: was `AlertTriangle`, now `ClipboardList` (matches its active subtab)
- Fixed `academy/page.tsx` subtab icons: were showing on all tabs, now conditional with `text-primary`
- Audited all 16 subtab navigations across 15 pages — all now consistent

---

## Known Issues — NOT YET RESOLVED

### Dictation "network" Error
The Web Speech API still fails with "Could not connect to the speech recognition service" for the beta tester. Root cause is likely:
- **Ad blocker** blocking Google speech endpoints (the console shows `ERR_BLOCKED_BY_CLIENT`)
- **Corporate network/firewall** blocking `*.google.com` speech API traffic
- Chrome's speech recognition sends audio to Google servers — this is a hard dependency

**Recommended next steps:**
1. Test with ad blocker disabled for `evenfalladvantage.com`
2. Test in Chrome Incognito (no extensions)
3. If still failing, implement **Whisper.js fallback** (offline, 40MB model cached in IndexedDB) — this was the original design decision from the handoff
4. The Whisper.js fallback should be a toggle in the UI: "Use offline recognition (slower but works everywhere)"

### External Group Edit — May Still Need Testing
The `handleSaveExtEdit` was rewritten to use `updateChatChannel()`. The `description` param was added to the function signature. Needs verification that it actually saves now.

### Git Push Slowness
`git push origin main` consistently times out from this machine. Workaround: use explicit URL:
```
git push https://EvenfallAdvantage@github.com/EvenfallAdvantage/evenfalladvantage.github.io.git main
```

---

## Remaining SOC 2 Gaps (3 items — unchanged)

| # | Control | What's Needed |
|---|---------|--------------|
| 1 | Vendor SOC 2 reports reviewed | Emails sent — waiting for responses. Templates at `docs/compliance/vendor-soc2-request-emails.md` |
| 2 | Annual penetration test | $5-15K hire. Recommended firms: Cobalt, Synack, HackerOne |
| 3 | Leaked password protection | Supabase paid feature — can ignore for now |

---

## SQL Migrations Run This Session

```sql
-- Channel permissions column (run by user)
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT NULL;

-- Client intake tokens table (run by user)
CREATE TABLE IF NOT EXISTS client_intake_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  client_name TEXT,
  client_email TEXT,
  data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','submitted','expired','revoked')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE client_intake_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read by token" ON client_intake_tokens FOR SELECT USING (true);
CREATE POLICY "Public update by token" ON client_intake_tokens FOR UPDATE USING (status IN ('active','submitted'));
CREATE POLICY "Authenticated insert" ON client_intake_tokens FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete" ON client_intake_tokens FOR DELETE USING (auth.uid() IS NOT NULL);
```

---

## Dependabot PRs (New)

Dependabot created 14 PRs during this session. They should be reviewed and merged:
- GitHub Actions version bumps (checkout, configure-pages, deploy-pages, setup-node, codeql-action)
- npm dependency updates (eslint, framer-motion, lucide-react, react-hook-form, recharts, stripe-js, supabase/ssr, tailwindcss/postcss, types/node, types/qrcode.react)

---

## Key Architecture Notes (Updated)

- **CRITICAL: Working directory is `audit-clone/`** — The root `evenfalladvantage.github.io/` has a stale `overwatch-src/` from before the audit. Always `cd audit-clone` first.
- **Static export:** `output: "export"` in next.config.ts — no API routes in production
- **Two Supabase instances:** Legacy (`vaagvairvwmgyzsmymhs`) + Overwatch (`nneueuvyeohwnspbwfub`)
- **Auth pattern:** `users.id` (internal UUID) ≠ `auth.uid()` (Supabase Auth UUID). Bridge via `users.supabase_id = auth.uid()::text`
- **RLS helper:** `is_company_member(company_id)` — use this for all new RLS policies
- **Brand theming:** `BrandThemeProvider` injects CSS vars from company's `brand_color` + `accent_color`
- **Page headers:** Use `usePageHeader` store — `setHeader(title, subtitle, icon, actions)` in useEffect
- **Subtab convention:** Icons only on active tab, `overflow-x-auto` on all tab bars, `text-primary` on active icon
- **Edge Functions:** All require JWT except webhooks; CORS restricted to evenfalladvantage.com
- **Storyboard:** `created_by` must be internal user ID (not auth UUID); use `storyboardIdRef` for debounced saves
- **Cross-company isolation:** ALL timesheet/analytics queries must filter by `company_id`
- **Service worker:** Currently at v10 — bump on each deploy if chunk 404s appear
- **CSP:** Meta tag in `layout.tsx:72` — includes Google speech endpoints, Supabase, Cloudflare, many open data APIs
- **Dictation:** Stores transcripts as form_submissions under a "Dictation (System)" auto-created form per company
- **Client intake:** Token-based public form, no auth needed. Uses query param `?token=xxx` (not dynamic route, since static export)
- **Git push workaround:** If `git push origin main` hangs, use: `git push https://EvenfallAdvantage@github.com/EvenfallAdvantage/evenfalladvantage.github.io.git main`

---

## Files Changed This Session

| File | What Changed |
|------|-------------|
| `src/app/chat/page.tsx` | Channel role permissions (gear icon, permission editor panel, can_post check on input), `loadChannels` prop to ExternalTab, `Settings2` import |
| `src/app/dictate/page.tsx` | **NEW** — Full dictation page with recording, metadata, saved transcripts |
| `src/app/client-intake/page.tsx` | **NEW** — Public tokenized client intake form |
| `src/app/incidents/page.tsx` | Tab reorder (Dictate → Field Reports → Incidents), Mic import, removed icon from inactive Dictate tab |
| `src/app/forms/page.tsx` | Tab reorder, Mic import, removed icon from inactive Dictate tab, header icon → ClipboardList |
| `src/app/profile/page.tsx` | Removed join code card, removed joinCode/copied/copyCode state, removed Copy/KeyRound/getCompanyDetails imports |
| `src/app/admin/staff/page.tsx` | Removed join code banner + topbar button, removed copied state + copyCode function |
| `src/app/academy/page.tsx` | Fixed subtab icons: conditional render with text-primary |
| `src/app/layout.tsx` | Added `https://*.google.com https://*.googleapis.com` to CSP connect-src |
| `src/components/dictation-recorder.tsx` | **NEW** — Web Speech API recorder with explicit mic permission, error messages |
| `src/lib/supabase/db-content.ts` | Extended `createChatChannel` + `updateChatChannel` with `permissions` and `description` params |
| `src/lib/supabase/db-client-intake.ts` | **NEW** — CRUD for client_intake_tokens table |
| `src/lib/supabase/db.ts` | Added barrel export for db-client-intake |
| `public/sw.js` | Cache version v9 → v10 |

---

## Files to Know (Updated)

| File | Purpose |
|------|---------|
| `src/stores/page-header-store.ts` | Zustand store for topbar title/subtitle/icon/actions |
| `src/stores/auth-store.ts` | Auth + active company state |
| `src/components/brand-theme-provider.tsx` | CSS variable injection from company colors |
| `src/components/dictation-recorder.tsx` | Web Speech API recorder with mic permission + error handling |
| `src/components/storyboard-editor.tsx` | Pin-based map annotation (~1100 lines) |
| `src/components/address-autocomplete.tsx` | Nominatim geocoding typeahead |
| `src/components/mobile-page-action.tsx` | Renders page actions on mobile |
| `src/components/error-boundary.tsx` | React error boundary + error_logs |
| `src/lib/error-tracker.ts` | Global error handler + Supabase logging |
| `src/lib/error-alerter.ts` | Auto-posts Briefing alert for new errors |
| `src/lib/supabase/db-client-intake.ts` | Client intake token CRUD |
| `src/components/layout/topbar.tsx` | Top header bar with page title + actions |
| `src/components/layout/dashboard-shell.tsx` | Main layout wrapper with skip-nav |
| `src/components/ops/intake-panel.tsx` | Editable intake with cascade logic |
| `docs/compliance/` | 20 SOC 2 compliance documents |
| `.github/workflows/deploy.yml` | CI/CD: test → audit → build → deploy |
| `.github/workflows/backup.yml` | Daily pg_dump backup |
| `.github/workflows/codeql.yml` | Weekly SAST analysis |

---

## Pre-existing TypeScript Error (Not from this session)

```
src/__tests__/error-tracker.test.ts:55:19 - error TS2339: Property 'slice' does not exist on type 'never'.
```
This exists in the test file and is not a blocker for build (tests pass via Vitest, `tsc` just flags the type).

---

## Recommended Next Steps

1. **Fix dictation for ad-blocker users** — Implement Whisper.js offline fallback as originally planned
2. **Verify external group edit works** — The save function was rewritten; needs manual testing
3. **Merge Dependabot PRs** — 14 pending version bumps
4. **Admin UI for client intake tokens** — Need a way for admins to create/manage/revoke intake tokens from the admin panel (currently only DB functions exist, no UI)
5. **Continue SOC 2 gaps** — Follow up on vendor SOC 2 report requests
6. **Consider removing stale root repo overwatch-src** — Or add a README warning. It's caused confusion twice now.

---

**End of handoff. Always work in `audit-clone/` directory.**
