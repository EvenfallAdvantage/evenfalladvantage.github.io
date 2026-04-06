# Overwatch — Workforce Management Platform

Military-grade workforce management platform for security companies.
Powered by **Evenfall Advantage LLC**.

**Last Updated:** April 3, 2026

## Tech Stack

- **Framework:** Next.js 16 (App Router, static export)
- **Auth & DB:** Supabase (Auth, PostgREST, Storage, RLS)
- **Payments:** Stripe (Checkout + Webhooks)
- **Styling:** TailwindCSS + shadcn/ui
- **State:** Zustand + React Query
- **PWA:** Service Worker with offline fallback
- **Geocoding:** Nominatim (OpenStreetMap)

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Stripe keys
npm run dev                   # http://localhost:3000/overwatch
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Overwatch Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Stripe secret key (server only, lazy-initialized) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_LEGACY_SUPABASE_URL` | Legacy Supabase URL (courses) |
| `NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY` | Legacy Supabase anon key |

## Build & Deploy

### CI/CD (GitHub Actions)

Pushing to `main` triggers `.github/workflows/deploy.yml`:

1. `npm ci` in `overwatch-src/`
2. `npm run build` (Next.js static export to `out/`)
3. Copies `out/` to `overwatch/` in the repo root
4. Deploys the entire site to GitHub Pages

**Required GitHub Secrets:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Note:** The `overwatch/` directory is in `.gitignore` — build artifacts are generated in CI, not committed.

### Manual Build (fallback)

```bash
npm run build
# Copy output to repo root:
Remove-Item -Path "../overwatch/*" -Recurse -Force
Copy-Item -Path "out/*" -Destination "../overwatch/" -Recurse -Force
git add ../overwatch && git commit -m "deploy" && git push
```

## Database Migrations

SQL migrations live in `prisma/`. Run them in **Supabase Dashboard > SQL Editor**.

**Core schema:** `supabase-setup.sql` (tables, RLS, indexes)

**Incremental migrations (run in order):**

| # | File | Description |
|---|------|-------------|
| 1 | `supabase-setup.sql` | Core tables: users, companies, memberships, events, shifts, timesheets, forms, chat, KB, notifications, audit |
| 2 | `add-incidents-patrols.sql` | Incidents, checkpoints, patrol logs |
| 3 | `add-lms-tables.sql` | Training modules, slides, progress |
| 4 | `add-question-bank.sql` | Assessment questions |
| 5 | `add-phase4-payments-certs.sql` | Payments, certifications, course enrollments |
| 6 | `add-onboarding-system.sql` | Onboarding tasks, applicant pipeline |
| 7 | `add-time-change-requests.sql` | Time correction requests |
| 8 | `add-security-audit.sql` | Audit logs with 90-day retention |
| 9 | `add-join-rate-limit.sql` | Rate limiting for join code RPC |
| 10 | `fix-rls-linter-warnings.sql` | RLS policy fixes |
| 11 | `add-applicant-enhancements.sql` | Education, work_history, documents on applicants + company_memberships; applicant-documents storage bucket |
| 12 | `add-storyboard-system.sql` | Storyboards table, site_map_url on events, storyboard_id/pin on incidents; operation-maps storage bucket |
| 13 | `fix-storyboard-rls.sql` | Fix RLS policies to use is_company_member() |
| 14 | `fix-storyboard-function-search-path.sql` | Set search_path on trigger function |
| 15 | `fix-timesheet-company-isolation.sql` | Add company_id to timesheets + backfill |
| 16 | `fix-add-dietary-restrictions.sql` | Add dietary_restrictions to company_memberships |
| 17 | `add-accent-color.sql` | Add accent_color to companies for brand theming |

## Project Structure

```
src/
  app/                    # Next.js App Router pages (53+ pages)
    feed/                 # Main dashboard (smart clock-in modal)
    timeclock/            # Clock in/out (Watch Log)
    patrols/              # Checkpoint scanning & routes
    incidents/            # Incident reports + storyboard pin
    forms/                # Field reports
    chat/                 # Comms (Briefing + Channels + External)
    updates/              # Briefing (posts, alerts, announcements)
    schedule/             # Shift calendar + Armory
    courses/              # Course catalog + Conference
    academy/              # Academy Hub (modules, drills, certs)
    knowledge-base/       # Field Manual (SOPs, documents)
    certifications/       # Certification tracker
    profile/              # Member profile (education, work history)
    directory/            # Company roster
    time-off/             # Leave requests
    apply/                # Public job application form
    admin/
      staff/              # Personnel (roster, applicants, onboarding, timesheets, leave)
      events/             # Planning (operations, site maps, storyboards)
      training/           # Training Admin (modules, question bank, progress)
      instructor/         # Instructor HQ (courses, classes, students)
      settings/           # Company settings
      ...
  components/
    layout/               # Sidebar (app-sidebar.tsx), nav-items, mobile-nav
    ui/                   # shadcn/ui components
    storyboard-editor.tsx # Pin-based site map annotation component
    address-autocomplete.tsx # Nominatim geocoding typeahead
    theme-toggle.tsx      # Dark/Light/System theme
    security-provider.tsx # Session lock, inactivity timeout
    pwa-install-prompt.tsx
    brand-theme-provider.tsx  # Dynamic CSS variable injection from company brand colors
    mobile-hero-radar.tsx     # Animated radar sweep canvas for mobile landing page
    mobile-page-action.tsx    # Renders page actions on mobile (above subtabs)
    privacy-policy-modal.tsx  # Privacy policy modal for landing page
    join-company-modal.tsx    # Join company modal for landing page
  lib/
    supabase/             # DB layer (9 domain modules)
      db.ts               # Main exports
      db-onboarding.ts    # Applicants, hiring, member conversion
      db-operations.ts    # Events, storyboards, shifts
      db-timesheets.ts    # Timesheets, clock in/out, shift detection
      ...
    security/             # Encryption, audit, brute-force
    legacy-bridge.ts      # Cross-database bridge to legacy Supabase
    stripe.ts             # Lazy-initialized Stripe client
    permissions.ts        # Role hierarchy (staff < manager < admin < owner)
    geo-risk-data.ts      # Crime data aggregation + geocoding
  stores/
    auth-store.ts         # Zustand auth + company state
    page-header-store.ts      # Zustand store for topbar page title/subtitle/actions
  types/
    index.ts              # 30+ typed DB row interfaces
```

## Features

### Core Platform
- **Dashboard** with real-time clock, metrics, briefings, intel, and smart clock-in modal
- **Timeclock** with shift detection, admin/off-shift work, geofencing, QR, kiosk PIN, break tracking
- **Schedule** with shift calendar, drag assignment, conflict detection, armory tracking
- **Incidents & Patrols** with severity tracking, checkpoint scanning, route tracking
- **Storyboard System** with site map upload, pin-based annotation, incident location marking
- **Comms** with briefing posts, channels, external groups (WhatsApp, Signal, Discord)
- **Knowledge Base** with folders, documents, required reading
- **Dynamic Brand Theming** with dual color picker (primary + accent), luminance guardrails, and live preview
- **Cross-Company Data Isolation** on all timesheet and analytics queries
- **Personal Profile Sync** across all company memberships (fill once, available everywhere)
- **Page Titles in Topbar** with page-specific action buttons
- **Mobile:** inline action button above subtabs, horizontal feature carousel with active dots
- **Mobile:** animated radar sweep particle grid on landing page hero

### Workforce
- **Applicant Pipeline** with enhanced application form (education, experience, cert uploads), detail modal, CSV import, hire orchestration
- **Convert-to-Member** carries over education, work history, and migrates certificate files
- **Member Profile** with editable education and work history sections
- **Personnel Admin** with roster, onboarding, timesheets, corrections, leave, forms tabs
- **Address Autocomplete** on planning form and public application form (Nominatim/OSM)

### Training
- **Academy Hub** with modules, slides, quizzes, drills, and certifications
- **Courses** with Stripe checkout and auto-enrollment
- **Training Admin** with module editor, question bank, staff progress tracking
- **Instructor HQ** with class management, student roster, certificate issuance
- **Multi-Provider AI Question Generator** (8 providers + custom, localStorage config)

### Operations
- **Planning** with multi-step operation wizard (5 steps), site map upload, storyboard annotations
- **Address Autocomplete** on Location and Site Address fields
- **Geo-Risk Assessment** with multi-tier crime data from 10+ public APIs
- **Intake Edit Cascade:** changes auto-update OPORD and GOTWA, auto-create draft FRAGO
- **Editable Incidents** after creation (admin/manager)
- **Storyboard Pin Editing** on incident detail view
- **Re-editable OPORD and GOTWA** after issuance (edit/lock toggle)
- **Searchable Icon Picker** with 90+ icons across 12 categories

### Security
- AES-256-GCM encryption, session lock, audit logs, brute-force protection
- XSS sanitization across all legacy portals (escapeHTML/escapeAttr)
- CORS origin allowlists on all Edge Functions
- JWT enforcement on email function
- Admin role verification on create/delete student functions
- Stripe webhook signature enforcement (no unsigned fallback)
- PWA with offline fallback, app shortcuts, installable

## UI Conventions

### Sub-tab bars
All in-page tab bars follow a consistent pattern:
- Icons display **only on the active tab**
- Inactive tabs show text only
- All tab bars have `overflow-x-auto` for mobile scroll support
- Consistent `space-y-4` vertical spacing between title and tabs
- 12 pages standardized: Comms, Watch Log, Reports, Operations, Courses, Leave, Training Admin, Instructor HQ, Personnel, Patrols, Field Reports, Academy

### Mobile
- All pages tested at 375px width
- Flex rows use `flex-wrap` where content could overflow
- Grids use responsive breakpoints (e.g., `grid-cols-2 sm:grid-cols-4`)
- Tab bars scroll horizontally on narrow screens

### Page Titles in Topbar
All page titles render in the topbar header via `usePageHeader` Zustand store:
- Pages call `setHeader(title, subtitle, icon, actions)` in useEffect
- Action buttons (+ New Operation, + Report Incident, etc.) render in the topbar on desktop
- On mobile, action buttons render inline above page content via `MobilePageAction`
- 26 pages use this pattern

### Brand Theming
- `BrandThemeProvider` injects company brand colors as CSS custom properties
- Primary color: sidebar background, card backgrounds (dark mode), borders
- Accent color: buttons, active states, badges, focus rings, chart colors
- Luminance guardrails in HQ Config: warns if primary too light or accent too dark
- Live preview card shows sidebar + content area with selected colors
