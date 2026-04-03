# Evenfall Advantage — Security Training & Workforce Management Platform

**Last Updated:** April 3, 2026

A comprehensive security training and workforce management platform by Evenfall Advantage LLC, a veteran-led security consulting, professional training, and emergency planning firm. The platform combines a public marketing site, legacy training portals, and the **Overwatch** workforce management platform.

## Platform Overview

| System | Tech | Path | Purpose |
|--------|------|------|---------|
| **Marketing Site** | Static HTML/CSS/JS | `/` | Public website, case studies, service information |
| **Student Portal** | Vanilla JS + Supabase | `/student-portal/` | Training modules, assessments, certifications |
| **Instructor Portal** | Vanilla JS + Supabase | `/instructor-portal/` | Class management, enrollment, certificates |
| **Admin Dashboard** | Vanilla JS + Supabase | `/admin/` | Course editor, user management, AI question generation |
| **Overwatch** | Next.js 16 + Supabase | `/overwatch/` | Full workforce management platform (see below) |

## Architecture

The platform runs on **two Supabase instances**:

- **Legacy DB** (`vaagvairvwmgyzsmymhs`) — Training content, courses, student progress, assessments, certificates
- **Overwatch DB** (`nneueuvyeohwnspbwfub`) — Workforce management, companies, memberships, operations, incidents, storyboards

The **Legacy Bridge** (`overwatch-src/src/lib/legacy-bridge.ts`) connects the two systems, allowing Overwatch users to access training content from the legacy database without maintaining separate accounts.

## Project Structure

```
/                           # GitHub Pages root
├── index.html              # Marketing landing page
├── about.html, blog.html   # Public pages
├── privacy-policy.html     # CCPA-compliant privacy policy
├── terms-of-service.html   # Terms of service (Arizona law)
├── case-studies/            # Incident case study pages
├── forms/                   # Service estimate request forms
├── includes/                # Shared header/footer (client-side SSI)
├── css/                     # Global styles
├── js/                      # Shared JS (sanitize.js, include-html.js)
├── images/                  # Site imagery
│
├── student-portal/          # Legacy student training portal
│   ├── login.html, index.html, courses.html
│   ├── js/                  # student-portal.js (~6000 lines), profile.js, courses.js, etc.
│   └── css/                 # Portal styles
│
├── instructor-portal/       # Legacy instructor portal
│   ├── login.html, index.html
│   └── js/                  # instructor-portal.js, instructor-enrollment.js
│
├── admin/                   # Legacy admin dashboard
│   ├── login.html, index.html, assessments.html
│   └── js/                  # admin-dashboard.js, ai-question-generator-free.js, etc.
│
├── overwatch-src/           # Overwatch Next.js source (see overwatch-src/README.md)
│   ├── src/app/             # 50+ pages (App Router)
│   ├── src/components/      # Reusable components (StoryboardEditor, AddressAutocomplete, etc.)
│   ├── src/lib/             # DB layer, security, utilities
│   ├── prisma/              # SQL migrations for Overwatch DB
│   └── public/              # Static assets, service worker
│
├── overwatch/               # Built Next.js output (generated in CI, gitignored)
│
├── supabase/                # Legacy Supabase Edge Functions
│   ├── functions/           # send-email, create-student, delete-student, etc.
│   └── config.toml          # Function configuration (JWT, CORS)
│
├── sql/                     # Legacy DB SQL scripts (100+ migration files)
│
├── .github/workflows/       # CI/CD
│   └── deploy.yml           # Builds Next.js in CI, deploys to GitHub Pages
│
├── google-meet-addon/       # Google Meet integration addon
├── google-meet-bot/         # Google Meet bot (Puppeteer)
└── google-meet-webrtc-bot/  # Google Meet WebRTC bot (in development)
```

## Overwatch Platform

The Overwatch platform is the primary workforce management system. See [`overwatch-src/README.md`](overwatch-src/README.md) for full details.

**Key features:**
- Dashboard with real-time clock, metrics, briefings, and intel
- Smart clock-in with shift detection, admin/off-shift work, and geofencing
- Operations planning with site map upload and storyboard annotations
- Incident reporting with optional storyboard pin placement
- Patrol checkpoint scanning and route tracking
- Team communications (briefing, channels, external groups)
- Applicant pipeline with education, experience, cert uploads, and hire-to-member conversion
- Academy hub with training modules, courses, drills, and certifications
- Address autocomplete (Nominatim/OSM) on planning and application forms
- Multi-provider AI question generator (Gemini, OpenAI, Anthropic, Groq, OpenRouter, Mistral, Together, Ollama)

## Technologies

| Layer | Tech |
|-------|------|
| **Overwatch Frontend** | Next.js 16, React 19, TailwindCSS, shadcn/ui, Zustand, Lucide icons |
| **Legacy Portals** | Vanilla JavaScript, HTML5, CSS3 |
| **Backend** | Supabase (Auth, PostgREST, Storage, RLS, Edge Functions) |
| **Payments** | Stripe (Checkout + Webhooks) |
| **Email** | Resend API |
| **Geocoding** | Nominatim (OpenStreetMap) |
| **CI/CD** | GitHub Actions (Next.js build + GitHub Pages deploy) |
| **PWA** | Service Worker with offline fallback |

## Deployment

### CI/CD Pipeline (GitHub Actions)

Pushing to `main` triggers `.github/workflows/deploy.yml`:

1. Checks out the repository
2. Installs Node.js 20 and npm dependencies
3. Builds the Next.js app (`npm run build` in `overwatch-src/`)
4. Copies the static export to `overwatch/`
5. Deploys everything to GitHub Pages via `actions/deploy-pages`

**Required GitHub Secrets:**
- `NEXT_PUBLIC_SUPABASE_URL` — Overwatch Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Overwatch Supabase anon/public key

### Edge Function Deployment

Edge Functions are deployed separately via the Supabase CLI:

```bash
npx supabase link --project-ref vaagvairvwmgyzsmymhs
npx supabase functions deploy send-email
npx supabase functions deploy send-welcome-email
npx supabase functions deploy create-student
npx supabase functions deploy delete-student
npx supabase functions deploy create-checkout-session
npx supabase functions deploy process-course-payment
```

### Local Development

```bash
# Marketing site / legacy portals
python -m http.server 8000

# Overwatch
cd overwatch-src
cp .env.example .env.local   # fill in Supabase + Stripe keys
npm install
npm run dev                   # http://localhost:3000/overwatch
```

## Security

The platform includes comprehensive security hardening (April 2026 audit):

- **XSS Prevention** — `escapeHTML()` and `escapeAttr()` applied to all 52 innerHTML vectors across 18 JS files
- **CORS Hardening** — All 6 Edge Functions restrict origins to `evenfalladvantage.com` and `evenfalladvantage.github.io`
- **JWT Enforcement** — `send-email` function requires authenticated JWT (previously unauthenticated)
- **Admin Role Verification** — `create-student`, `delete-student`, `send-email` verify caller is admin/instructor
- **Admin Policy Fix** — `administrators` INSERT policy prevents self-promotion
- **Stripe Webhook Fix** — Rejects unsigned webhook payloads (no fallback to unverified JSON)
- **Multi-Provider AI** — Gemini API key removed from client-side JS; replaced with localStorage-based provider config
- **Cookie Consent** — Banner on all public pages with accept/decline
- **Accessibility** — ARIA roles, skip-nav, semantic nav, lazy loading, explicit image dimensions

## Documentation

| Document | Location | Description |
|----------|----------|-------------|
| Overwatch README | `overwatch-src/README.md` | Full Overwatch platform documentation |
| Edge Functions Guide | `supabase/functions/EDGE_FUNCTIONS_DEPLOYMENT.md` | Stripe payment functions deployment |
| Integration Plan | `docs/INTEGRATION_PLAN.md` | Legacy Bridge architecture |
| Legacy Merge Plan | `docs/LEGACY_MERGE_PLAN.md` | Data migration strategy |
| SQL Deployment | `sql/DEPLOYMENT_INSTRUCTIONS.md` | Course content SQL deployment |
| Crime Data Migration | `sql/CRIME_DATA_MIGRATION_README.md` | Geo-risk data setup |
| Legacy Docs | `docs/legacy/` | 29 archived legacy portal documents |

## License

Proprietary — Evenfall Advantage LLC. All rights reserved.
