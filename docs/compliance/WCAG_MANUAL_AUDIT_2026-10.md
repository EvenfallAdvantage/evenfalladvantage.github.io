# WCAG 2.2 AA manual audit — October 2026

**Scope:** Overwatch web app (`/overwatch`) on desktop Chrome with Playwright. Tested as the ZZTEST Field QA account. Write requests were stubbed, so no data changed.
**Routes:** landing `/`, login `/?auth=login`, `/feed/`, `/timeclock/`, `/incidents/`, Shift Notes `/dictate/`, ops map `/schedule/`, `/profile/`, timesheets `/admin/staff/?tab=timesheets`.
**Checks:** keyboard order (first Tab and skip link), visible focus, focus trap and Escape in dialogs, accessible names, target size (2.5.8), reflow at 320 px (1.4.10), 200% zoom (1.4.4), reduced motion (2.3.3), `lang` and headings.

> **Still needs a human:** a real screen-reader pass with NVDA + Firefox/Chrome on Windows and VoiceOver on macOS/iOS. Automated ARIA checks cannot confirm announcement order, live-region verbosity or how the map and Cesium views are perceived. Mobile (Capacitor) TalkBack/VoiceOver is also untested.

## Findings and fixes (this PR)

| # | Issue | WCAG | Fix |
|---|---|---|---|
| 1 | Activating "Skip to main content" left focus on `<body>` because `<main>` wasn't focusable | 2.4.1 | `main#main-content` gets `tabIndex={-1}` (`dashboard-shell.tsx`) |
| 2 | On timeclock, incidents, Shift Notes, ops map and timesheets, the first Tab skipped the skip link and nav. `scrollIntoView` in sub-tabs moved the sequential-focus start point | 2.4.3 | `sub-tabs.tsx` now scrolls the tab strip horizontally by itself instead of calling `scrollIntoView` |
| 3 | Landing and login had no `<main>` landmark and no skip link | 1.3.1, 2.4.1 | Skip link plus `<main id="main-content">` added in `app/page.tsx` |
| 4 | Login and register modals had no dialog role and no focus trap | 4.1.2, 2.4.3 | `role="dialog"`, `aria-modal`, an accessible name and `useFocusTrap` |
| 5 | Quick incident report: focus escaped the dialog (8 of 20 Tabs stayed inside), and Escape didn't close it | 2.1.2, 2.4.3 | New `hooks/use-focus-trap.ts`, applied to quick-incident, statement, tag-scan confirm, roster bulk email, client intake share and CCTV ack dialogs |
| 6 | Inputs named only by their placeholder: feed search, incidents search, Shift Notes person name and transcript | 1.3.1, 4.1.2 | `aria-label`s added |

**After re-run (local build of this branch):** on every route the first Tab lands on the skip link, and activating it moves focus to `main-content`. On login, focus starts inside the dialog. In the Quick incident dialog, 20 of 20 Tabs stay inside, and Escape closes it and returns focus to the trigger.

## Passing
- No horizontal scroll at 320 px or at 200% zoom (640 px CSS width) on any tested route.
- No infinite animations under `prefers-reduced-motion: reduce`.
- Focus indicator visible on every focusable element tested. `lang="en"`. One `h1` per page.
- Field-mode switch: drawn at 32×18, but its `after:` hit area is about 56×34, so it passes 2.5.8.

## Accepted / remaining
- Ops map: Cesium and OpenStreetMap attribution links and map controls are below 24×24 (third-party widgets, so this falls under the 2.5.8 exception). One unnamed Cesium control is also third-party.
- Profile: 2 small inline targets have enough spacing to pass under the 2.5.8 spacing exception.
- Base-UI dialogs (shadcn) already trap focus. Only the custom overlays listed above needed the hook.
- Colour contrast was covered by the automated axe pass and was not re-measured by hand.

Scripts: `a11y-manual.mjs` and `a11y-probe2.mjs` (Playwright, kept outside the repo).
