# Overwatch ↔ Legacy Portal Integration Plan

## The Problem

Today there are **3 separate portals** on different pages of the same site, all using a **different Supabase instance** than Overwatch:

| Portal | URL | Auth | Supabase |
|--------|-----|------|----------|
| Student Portal | `/student-portal/` | Legacy (students table) | `vaagvairvwmgyzsmymhs` |
| Instructor Portal | `/instructor-portal/` | Legacy (instructors table) | `vaagvairvwmgyzsmymhs` |
| Admin Portal | `/admin/` | Legacy (administrators table) | `vaagvairvwmgyzsmymhs` |
| **Overwatch** | `/overwatch/` | Overwatch (users table) | `nneueuvyeohwnspbwfub` |

Users have to create separate accounts, learn separate UIs, and data doesn't flow between systems.

## The Vision: One Login, One Platform

**Overwatch becomes the single entry point.** The legacy portals become "engines" that Overwatch talks to under the hood. A user signs up for Overwatch once and gets access to everything based on their role.

## Unified Account Model

### How Roles Map

| Overwatch Role | Legacy Equivalent | Gets Access To |
|----------------|-------------------|----------------|
| `member` (default) | Student | Course catalog, training modules, slideshows, assessments, certificates, de-escalation scenarios, messages |
| `manager` / `admin` | Instructor | Everything above + class scheduling, attendance tracking, student management, certificate issuance, instructor notes |
| `owner` | Admin + Client | Everything above + admin dashboard, course editor, assessment editor, client management, slide import, AI question generator |

### The Bridge: `legacy_account_links` Table

A new table in the **Overwatch Supabase** that maps Overwatch user IDs to legacy portal accounts:

```sql
CREATE TABLE IF NOT EXISTS legacy_account_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  legacy_supabase_url TEXT NOT NULL,
  legacy_user_id UUID NOT NULL,
  legacy_role TEXT NOT NULL CHECK (legacy_role IN ('student', 'instructor', 'admin')),
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'active',
  UNIQUE(user_id, legacy_role)
);
```

## Integration Architecture

### Phase 1: Cross-Database Read Bridge (This Session)

Create a **Legacy Bridge** service in Overwatch that can read from the legacy Supabase to pull training content, progress, and certificates into the Overwatch UI.

**New file:** `src/lib/legacy-bridge.ts`

This service:
1. Creates a Supabase client pointing at the legacy instance
2. Provides typed functions to read legacy data (modules, slides, assessments, progress, certificates)
3. Is called by Overwatch pages that need legacy training content

**What this enables:**
- Overwatch's `/training` page shows the real slideshow modules from the legacy DB
- Overwatch's `/courses` page shows enrollment status from the legacy DB
- Overwatch's `/certifications` page shows certificates issued by instructors
- All without the user ever visiting the legacy portals

### Phase 2: Account Auto-Linking

When an Overwatch user first accesses a training feature:
1. Check if they have a `legacy_account_links` entry
2. If not, auto-create a student account in the legacy Supabase using their Overwatch email/name
3. Store the link in `legacy_account_links`
4. Now all legacy reads/writes go through this linked account

For owners/admins: additionally link as instructor + admin in legacy.

### Phase 3: Write-Through Bridge

Enable Overwatch to **write** to the legacy DB:
- Starting a module → creates/updates `student_module_progress` in legacy
- Completing an assessment → saves to `assessment_results` in legacy  
- Purchasing a course → creates `student_course_enrollments` in legacy
- This means the legacy portals still work independently but stay in sync

### Phase 4: Connected Dual-Path Architecture (Revised)

**The legacy portals stay alive.** Overwatch and the legacy portals serve different audiences:

| Platform | Audience | Purpose |
|----------|----------|---------|
| **Overwatch** | Security companies, managers, company employees | Workforce management, company training, scheduling, payroll, incidents |
| **Student Portal** | Individual students (no company) | Self-enrollment in training courses, assessments, certifications, de-escalation |
| **Instructor Portal** | Instructors | In-person class scheduling, attendance, student management, certificate issuance |
| **Admin Portal** | Evenfall Advantage staff | Course editor, slide management, assessment builder, client management |

**Connection model (not decommission):**
- Both systems read/write to the **same legacy Supabase** for training data
- Overwatch users get auto-linked to legacy student/instructor accounts via the bridge
- Progress, enrollments, certificates, and attendance sync bidirectionally
- A student who signs up individually can later join a company in Overwatch — their training history carries over
- An instructor who schedules a class in the legacy portal sees the same class in Overwatch Instructor HQ

**What this means:**
- Legacy portal login pages keep the "Upgrade to Overwatch" banner for company users
- Individual students continue using the Student Portal directly
- Instructors can use either the legacy Instructor Portal or Overwatch Instructor HQ
- No data migration needed — both systems share the same training database

## What Gets Built This Session

### 1. Legacy Bridge Service (`src/lib/legacy-bridge.ts`)
- Read-only client to legacy Supabase
- Functions: getLegacyModules, getLegacySlides, getLegacyProgress, getLegacyAssessments, getLegacyCertificates, getLegacyClasses

### 2. Account Linking SQL (`prisma/add-legacy-bridge.sql`)
- `legacy_account_links` table with RLS
- Auto-link function

### 3. Enhanced Training Viewer (`/training/viewer`)
- Pull real slideshow content from legacy modules
- Track progress in both legacy and Overwatch DBs

### 4. Academy Hub Page (`/academy`)
- New unified page replacing the separate training/courses experience
- Shows: enrolled courses with real module progress from legacy
- Shows: available courses with real pricing
- Shows: assessment scores from legacy
- Shows: certificates earned (both Overwatch-issued and instructor-issued)

### 5. Instructor Features (for admin/owner roles)
- Class scheduling (reads/writes to legacy `scheduled_classes`)
- Student roster with real progress data
- Certificate issuance through Overwatch UI
- Attendance marking

### 6. Legacy Portal Redirects
- Update legacy portal login pages to show "Use Overwatch instead" banner
- Keep legacy portals functional as fallback

## Data Flow Diagram

```
User logs into Overwatch
       │
       ▼
   AppShell loads
       │
       ├── Overwatch DB: user profile, company, shifts, incidents, etc.
       │
       └── Legacy Bridge: training content, progress, certificates
              │
              ├── GET /training_modules → slideshow content
              ├── GET /student_module_progress → user's progress  
              ├── GET /assessment_results → quiz scores
              ├── GET /certificates → earned certs
              ├── GET /scheduled_classes → upcoming classes
              └── POST (write-through) → progress updates
```

## Security Notes

- Legacy Supabase anon key is read-scoped via RLS
- Write operations will use the linked student's auth context
- No service role keys exposed to client
- All cross-DB calls go through the bridge service (not direct client calls)
