# Evenfall Advantage — Mobile Layout / UX Review

**Date:** 2026-10-06 (PT)  
**Repo:** EvenfallAdvantage/evenfalladvantage.github.io  
**Scope:** Public static site (HTML/CSS/JS) + Overwatch PWA (`overwatch-src`)  
**Screenshots:** `/workspace/evenfall/mobile-review/` was empty at review time — findings are from code. Live device screenshots would still help validate P0s.

Breakpoints in use today:

| Surface | Breakpoints |
|---|---|
| Public `css/styles.css` | 992px, 768px, 480px |
| Public forms | 900px, 768px |
| Overwatch (Tailwind) | default / `sm` 640 / `md` 768 / `lg` 1024; bottom nav `md:hidden` |

Almost every public HTML page has `width=device-width, initial-scale=1.0`. Good.

---

## P0 — Fix now (high impact, visible breakage)

### 1. Public header: no hamburger; nav stays a horizontal row
- **Pages:** every public page (header is loaded from `includes/header.html`).
- **Evidence:** `includes/header.html` has four links + a “COMING SOON!” badge and **no menu button**. At `@media (max-width: 768px)` in `css/styles.css`, `.nav-links` stayed `flex-direction: row` with `gap: 2rem`, so Home / Blog / About / Log In fight for width on phones.
- **Fix (this PR):** add a 44×44 menu button, collapse `#primary-nav` under 768px, open/close via `body.nav-open` (wired in `js/include-html.js`). Shrink logo and wrap footer/CTA links.

### 2. Case studies: no mobile CSS at all
- **Pages:** all 12 under `case-studies/*.html` (linked from `blog.html`).
- **Evidence:** each page inlined ~3KB of styles with a **400px-tall** hero banner, **3rem** title, and **no `@media` rules**. On a 375px-wide phone the banner ate most of the viewport and long titles overflowed.
- **Fix (this PR):** shared `css/case-study.css` with 768/480 rules (banner ~180–220px, smaller type, tighter padding). Inline `<style>` blocks removed.

### 3. Blog / case-study index grid can force horizontal scroll
- **Page:** `blog.html`.
- **Evidence:** `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))` — on a 320px screen with container padding, 300px min tracks overflow.
- **Fix (this PR):** `minmax(min(100%, 280px), 1fr)` + single-column under 480px.

### 4. Estimate forms: iOS input zoom + cramped padding
- **Pages:** `forms/security-consulting.html`, `festival-venue-safety.html`, `training-certification.html`, `emergency-response-planning.html`.
- **Evidence:** inputs used `font-size: 1.4rem` (~14px once the root is scaled). iOS Safari zooms any focused field under 16px. Sidebar already stacks at 900px (good).
- **Fix (this PR):** force `font-size: 16px` on form controls under 768px; full-width submit; slightly tighter container padding.

---

## P1 — Should fix soon

### 5. Founder quote decorative marks
- **Page:** `index.html` (`.founder-quote`).
- **Evidence:** `blockquote:before/after` at `font-size: 6rem`, absolutely positioned — easy to clip or collide with text on narrow screens.
- **Fix (this PR):** shrink to 4rem and tighten padding under 768px.

### 6. Footer hashtags + legal links
- **Pages:** all (via `includes/footer.html`).
- **Evidence:** many hashtag chips + legal links with large horizontal margins; wraps but feels noisy and easy to mis-tap.
- **Fix (this PR):** smaller chips, tighter legal margins, wrap CTA nav.

### 7. Overwatch: a few raw `<table>`s without horizontal scroll
- Shared `components/ui/table.tsx` already wraps in `overflow-x-auto` (good).
- **Gaps:** pay-stub recent rows, analytics drill-down, invoice preview, CSV mapper — used bare `<table>` inside vertical-only scrollers.
- **Fix (this PR):** `overflow-auto` / `overflow-x-auto` wrappers + `min-w-[…]` so columns scroll instead of crushing the layout.

### 8. Overwatch mobile bottom nav density
- **Evidence:** up to 5 tabs + SOS (`mobile-nav.tsx`), each `min-w-[56px]`. On ~360px phones labels truncate / crowd.
- **Fix (this PR):** under 380px, reduce min-width/padding via `globals.css`. A fuller “More” sheet redesign is later work.

---

## P2 — Later / needs design or product input

| Issue | Where | Notes |
|---|---|---|
| Root `html { font-size: 58%/55% }` on mobile | `styles.css` | Intentional rem scaling; don’t change without a full type pass. |
| “COMING SOON!” badge in the header | `includes/header.html` | Still shown next to the new menu button; consider removing when portals go live. |
| Login / register / dashboard (legacy static) | `login.html`, `register.html`, `dashboard.html` | Already have some 768 rules; lower traffic than marketing pages. |
| Overwatch admin wide forms (Instructor HQ, staff roster filters) | `admin/**` | Many `sm:grid-cols-*` already; remaining pain is content density, not missing breakpoints. |
| Overwatch marketing feature carousel | `app/page.tsx` | Already has `sm:hidden` snap carousel vs desktop grid — looks intentional. |
| PWA safe-area | `globals.css` `.safe-area-bottom` | Present on bottom nav; top notch / landscape still worth device QA. |
| Cookie banner | `includes/footer.html` | Flex-wrap OK; this PR only bumps button min-height. |
| Live screenshot QA | `mobile-review/` | Empty at review time — capture iPhone SE / 14 and Pixel 5 for homepage, blog, one case study, one form, Overwatch login + feed. |

---

## Inventory snapshot

**Public**
- Viewport meta: present on homepage, about, blog, login, forms, case studies.
- Nav: shared header include; **was always expanded** → hamburger in this PR.
- Hero: homepage uses quote + service cards (already column on mobile). Case-study “hero” was the fixed 400px banner.
- Grids: blog cards; about division cards (stack at 992/768).
- Tables: mostly in legacy dashboard CSS (`overflow-x: auto` on tabs already).
- Forms: sidebar + main; stack at 900px.
- Footer: CTA nav + hashtags + legal.

**Overwatch**
- Tailwind + bottom `MobileNav` under `md`, desktop sidebar hidden on small screens (`dashboard-shell.tsx`).
- Login/register are modals on `/overwatch` with `max-h-[90vh] overflow-y-auto`.
- Join / apply flows use responsive grids.
- Shared `Table` primitive scrolls; this PR catches the stragglers.

---

## What this PR fixes vs later work

**This PR (safe CSS/layout only — no redesign, no DB/edge changes):**
1. Public hamburger menu + mobile nav spacing/logo.
2. Shared responsive case-study stylesheet (all 12 pages).
3. Blog grid that doesn’t overflow tiny screens.
4. Form 16px inputs / full-width submit.
5. Founder quote + footer polish.
6. Overwatch table overflow on pay stubs, analytics drill, invoices, CSV mapper; denser bottom nav under 380px.

**Needs separate approval / later PRs:**
- Removing or relocating “COMING SOON!”.
- Full Overwatch admin density pass (roster, scheduling calendars).
- Device screenshot QA and any visual redesign of the marketing homepage.
- Touching `NEXT_PUBLIC_*`, edge functions, or migrations (out of scope).
