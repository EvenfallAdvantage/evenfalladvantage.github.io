# Overwatch — Workforce Management Platform

Military-grade workforce management platform for security companies.  
Powered by **Evenfall Advantage LLC**.

## Tech Stack

- **Framework:** Next.js 16 (App Router, static export)
- **Auth & DB:** Supabase (Auth, PostgREST, Storage, RLS)
- **Payments:** Stripe (Checkout + Webhooks)
- **Styling:** TailwindCSS + shadcn/ui
- **State:** Zustand + React Query
- **PWA:** Service Worker with offline fallback

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
| `STRIPE_SECRET_KEY` | Stripe secret key (server only) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_LEGACY_SUPABASE_URL` | Legacy Supabase URL (courses) |
| `NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY` | Legacy Supabase anon key |

## Build & Deploy (GitHub Pages)

```bash
npx next build                 # static export to out/
node scripts/flatten-rsc.js    # flatten RSC payloads
# Copy to repo root:
Remove-Item -Path "../overwatch/*" -Recurse -Force
Copy-Item -Path "out/*" -Destination "../overwatch/" -Recurse -Force
git add . && git commit -m "deploy" && git push
```

## Database Migrations

SQL migrations live in `prisma/`. Run them in the **Supabase Dashboard > SQL Editor**.

**Core schema:** `supabase-setup.sql` (tables, RLS, indexes)

**Incremental migrations (run in order if setting up fresh):**

1. `supabase-setup.sql` — Core tables (users, companies, memberships, events, shifts, timesheets, forms, chat, KB, notifications, audit)
2. `add-incidents-patrols.sql` — Incidents, checkpoints, patrol logs
3. `add-lms-tables.sql` — Training modules, slides, progress
4. `add-question-bank.sql` — Assessment questions
5. `add-phase4-payments-certs.sql` — Payments, certifications, course enrollments
6. `add-onboarding-system.sql` — Onboarding tasks, applicant pipeline
7. `add-time-change-requests.sql` — Time correction requests
8. `add-security-audit.sql` — Audit logs with 90-day retention
9. `add-join-rate-limit.sql` — Rate limiting for join code RPC
10. `fix-rls-linter-warnings.sql` — RLS policy fixes

## Project Structure

```
src/
  app/                    # Next.js App Router pages (53 pages)
    admin/                # Admin pages (staff, settings, events, etc.)
    feed/                 # Main dashboard
    timeclock/            # Clock in/out
    schedule/             # Shift calendar
    ...
  components/
    layout/               # Sidebar, nav, bottom bar
    ui/                   # shadcn/ui components
    theme-toggle.tsx      # Dark/Light/System theme
    security-provider.tsx # Session lock, inactivity timeout
  lib/
    supabase/             # DB layer (9 domain modules)
    security/             # Encryption, audit, brute-force
    csv-export.ts         # CSV export utility
    csv-import.ts         # CSV import + validation
    permissions.ts        # Role hierarchy (staff < manager < admin < owner)
  stores/
    auth-store.ts         # Zustand auth + company state
  types/
    index.ts              # 25+ typed DB row interfaces
```

## Features

- **Dashboard** with real-time clock, metrics, posts, and intel
- **Timeclock** with geofencing, QR, kiosk PIN, break tracking
- **Schedule** with shift calendar, drag assignment, conflict detection
- **Incidents & Patrols** with severity tracking, checkpoint scanning
- **Chat** with channels, file attachments, unread counts
- **Knowledge Base** with folders, documents, required reading
- **Training LMS** with modules, slides, quizzes, question bank
- **Courses** with Stripe checkout and auto-enrollment
- **Applicant Pipeline** with CSV import, background checks (Checkr), hire orchestration
- **Certifications** with file upload, expiry tracking
- **Reports** with analytics dashboard, CSV exports
- **12+ Integrations** (WhatsApp, Twilio, Gusto, DocuSign, Fillout, etc.)
- **Security** with AES-256-GCM encryption, session lock, audit logs, brute-force protection
- **PWA** with offline fallback, app shortcuts, installable
