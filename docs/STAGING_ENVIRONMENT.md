# Staging Environment Setup

**Overwatch — Local Supabase Staging**
**Last Updated:** April 6, 2026

---

## Overview

The staging environment uses **Supabase Local Development** (Docker-based) to provide a fully isolated database, auth, and storage instance for testing changes before deploying to production.

## Prerequisites

- **Docker Desktop** installed and running
- **Node.js 20+**
- **Supabase CLI** (`npx supabase` — auto-installed)

## Quick Start

```bash
cd overwatch-src

# 1. Start local Supabase (first time takes ~2 min to pull images)
npm run staging:start

# 2. Copy staging env vars
cp .env.staging .env.local

# 3. Run migrations (open Supabase Studio and paste each prisma/*.sql file)
npm run staging:studio
# → Opens http://localhost:54323 (Studio SQL Editor)

# 4. Start the dev server
npm run dev

# 5. Open http://localhost:3000/overwatch
```

## Architecture

```
┌─────────────────────────────────────────┐
│           Your Machine (Docker)          │
│                                          │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │  PostgreSQL   │  │  Supabase Studio │ │
│  │  :54322       │  │  :54323          │ │
│  └──────────────┘  └──────────────────┘ │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │  Auth (GoTrue)│  │  Storage         │ │
│  │  :54321/auth  │  │  :54321/storage  │ │
│  └──────────────┘  └──────────────────┘ │
│  ┌──────────────┐                        │
│  │  PostgREST    │                        │
│  │  :54321/rest  │                        │
│  └──────────────┘                        │
└─────────────────────────────────────────┘
         ↑
    Next.js Dev Server (:3000)
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run staging:start` | Start local Supabase (Docker containers) |
| `npm run staging:stop` | Stop local Supabase |
| `npm run staging:reset` | Reset DB to clean state + re-run seed |
| `npm run staging:status` | Show local Supabase URLs and keys |
| `npm run staging:studio` | Open Supabase Studio (SQL editor, table viewer) |

## Running Migrations

The production schema lives in `prisma/*.sql`. To set up the staging DB:

1. Start local Supabase: `npm run staging:start`
2. Open Studio: http://localhost:54323
3. Go to **SQL Editor**
4. Run each migration file in order:

```
1.  prisma/supabase-setup.sql              (core tables)
2.  prisma/add-incidents-patrols.sql        (incidents, checkpoints)
3.  prisma/add-lms-tables.sql               (training)
4.  prisma/add-question-bank.sql            (assessments)
5.  prisma/add-phase4-payments-certs.sql    (payments, certs)
6.  prisma/add-onboarding-system.sql        (applicants)
7.  prisma/add-time-change-requests.sql     (corrections)
8.  prisma/add-security-audit.sql           (audit logs)
9.  prisma/add-join-rate-limit.sql          (rate limiting)
10. prisma/fix-rls-linter-warnings.sql      (RLS fixes)
11. prisma/add-applicant-enhancements.sql   (education, work history)
12. prisma/add-storyboard-system.sql        (storyboards)
13. prisma/fix-storyboard-rls.sql           (RLS fix)
14. prisma/fix-storyboard-function-search-path.sql
15. prisma/fix-timesheet-company-isolation.sql
16. prisma/fix-add-dietary-restrictions.sql
17. prisma/add-accent-color.sql
18. prisma/add-error-logs.sql
```

5. The seed data (`supabase/seed.sql`) runs automatically on `supabase db reset`

## Test Accounts

After seeding, the following users exist in the application database:

| Email | Role | Name |
|-------|------|------|
| admin@staging.local | Owner | Admin User |
| manager@staging.local | Manager | Manager User |
| staff1@staging.local | Staff | Staff Alpha |
| staff2@staging.local | Staff | Staff Bravo |

**Note:** To log in, you need to create matching Supabase Auth users via Studio:
1. Open http://localhost:54323 → Authentication → Users
2. Click "Add user" → enter email + password
3. The `supabase_id` in the `users` table must match the Auth user's UUID

## Differences from Production

| Feature | Production | Staging |
|---------|-----------|---------|
| Database | Supabase Cloud (OverwatchDB) | Local Docker PostgreSQL |
| Auth | Supabase Cloud Auth | Local GoTrue |
| Storage | Supabase Cloud Storage | Local MinIO |
| URL | evenfalladvantage.com/overwatch | localhost:3000/overwatch |
| Email | Resend API | Local Inbucket (http://localhost:54324) |
| Stripe | Live/test keys | Disabled (no keys) |
| Legacy Bridge | Connected to EADB | Disabled |

## Resetting

To completely reset the staging environment:

```bash
npm run staging:reset    # Drops all tables, re-runs migrations + seed
```

To start fresh (remove Docker volumes):

```bash
npx supabase stop --no-backup
npm run staging:start
```

## Troubleshooting

### Docker not running
```
Error: Cannot connect to the Docker daemon
```
→ Start Docker Desktop first.

### Port conflicts
```
Error: port 54321 already in use
```
→ Edit `supabase/config.toml` to change the port, or stop the conflicting service.

### Migrations fail
→ Check for syntax errors in the SQL file. Run each migration individually to isolate the issue.
