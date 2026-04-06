# Changelog

## [2026-04-05] — Comprehensive Audit, Security Hardening, Features, and SOC 2 Readiness

### Security
- Removed hardcoded Gemini API key; replaced with multi-provider AI question generator (8 providers + custom)
- Fixed Stripe webhook signature bypass (rejects unsigned payloads)
- Added admin role verification to create-student, delete-student, send-email Edge Functions
- Fixed administrators INSERT policy (prevents self-promotion)
- Enabled JWT verification on send-email Edge Function
- Restricted CORS from wildcard to origin allowlist on all 6 Edge Functions
- Applied XSS sanitization (escapeHTML/escapeAttr) across 52 innerHTML vectors in 18 JS files
- Enabled GitHub Dependabot for weekly dependency vulnerability scanning
- Enabled GitHub CodeQL for weekly static analysis (SAST)
- Added npm audit step to CI/CD pipeline
- Enforced branch protection on main (require PR review)
- Added .github/SECURITY.md responsible disclosure policy

### Features — Applicant Pipeline
- Enhanced public application form: 6 sections with repeatable education, work history, cert uploads
- New applicant detail modal in Personnel page
- Enhanced admin "Add Applicant" modal with all fields
- Convert-to-member carries over education, work history, migrates cert files
- New Education and Work History sections on member profile page

### Features — Storyboard System
- New StoryboardEditor component: pin-based site map annotation (90+ icons, 12 categories)
- Searchable icon picker with category grouping and tag search
- Site map upload in operation wizard and IntakePanel
- Storyboard section on operation detail with auto-save
- Optional storyboard pin on incident reports
- Incident pins filtered from planning Site Map view
- Fixed: pin positioning, save persistence, RLS policies, popover clipping

### Features — Operations
- Editable Intake with cascade updates (auto-updates OPORD/GOTWA, auto-creates draft FRAGO)
- Editable incidents after creation (admin/manager)
- Storyboard pin editing on incident detail view
- Re-editable OPORD and GOTWA after issuance (edit/lock toggle)
- Address autocomplete (Nominatim) on planning form and application form
- Fixed operations page shift grouping (all shifts under their event)
- Fixed Intake auto-issue on creation + DocHub click handler

### Features — Brand Theming
- Dynamic brand theming: dual color picker (primary + accent) in HQ Config
- BrandThemeProvider injects CSS variables from company brand colors
- Luminance guardrails with live preview card
- Sidebar, buttons, badges, focus rings, charts all auto-theme
- Light/dark mode interaction with brand colors

### Features — Profile & Data Isolation
- Personal profile syncs across all company memberships (fill once, everywhere)
- Merged Personal Details + Personal Profile into single card
- Cross-company data isolation on timesheets, analytics, Watch Log, Dashboard
- Added company_id to timesheets table with backfill migration
- Added dietary_restrictions column to company_memberships
- Added accent_color column to companies

### UI/UX
- Page titles moved to topbar header (26 pages)
- Action buttons in topbar on desktop, inline above content on mobile
- Unified subtab system: icons on active tab only, consistent spacing (12+ pages)
- All tab bars scrollable on mobile (overflow-x-auto)
- Mobile overflow fixes across 7 pages
- Dashboard clock-in modal with shift detection (matches Watch Log)
- Briefing page pre-loads reactions/comments on initial page load
- Instructor HQ hidden for non-training-provider companies
- Service worker cache bumped (v7 → v8 → v9) to clear stale chunks
- Removed Recent Briefing section from dashboard (pinned briefings sufficient)
- Window title cleaned up ("Overwatch" instead of redundant triple branding)
- Confirm password field + eye toggles on login/register modals

### Landing Page
- Mobile hero: animated radar sweep particle grid (2D canvas, 180 dots, 60fps)
- Feature cards: horizontal scroll carousel on mobile with active dot indicators
- Footer redesign: 3-column layout with Platform/Legal/Powered By sections
- Join Company: now a modal instead of full page
- Privacy Policy: new modal (same format as ToS)
- Terms of Service: fixed oversized "I Understand" button

### Infrastructure
- CI/CD: Next.js built in GitHub Actions (removed 603 committed build artifacts)
- Deploy workflow concurrency group (prevents deployment collisions)
- Stripe client lazy-initialized (prevents build crash without secret key)
- Cookie consent banner on all public pages
- Accessibility: ARIA roles, skip-nav, semantic nav, lazy loading, OG meta tags

### Compliance (SOC 2 Readiness)
- SOC 2 Type I Readiness Checklist (76 controls, 51% complete)
- Information Security Policy (11 sections)
- Incident Response Plan (6-phase IRP)
- Data Retention Policy (16 data categories with retention schedules)
- Vendor Risk Assessment (7 vendors assessed)
- GitHub SECURITY.md (responsible disclosure)
- Dependabot + CodeQL automated scanning
- Branch protection enforced on main

### Bug Fixes
- Fixed build errors: ringColor CSS property, Stripe lazy init, IntakePanel TS cast
- Fixed storyboard: RLS policies (is_company_member), created_by FK, save persistence, drag position, popover clipping
- Fixed cross-company data bleed: timesheets, analytics, pending approvals, Weekly Hours
- Fixed privacy policy undefined CSS variable
- Fixed Terms of Service placeholder "State of [Your State]" → Arizona
- Removed duplicate files (admin/css/course-editor.js, case-studies/astroworldtragedy.html)

### Documentation
- Complete rewrite of root README.md
- Updated overwatch-src/README.md with all new features and conventions
- Updated INTEGRATION_PLAN.md with data isolation and theming architecture
- Updated EDGE_FUNCTIONS_DEPLOYMENT.md with security hardening details
- Updated AI question generator docs for multi-provider system
