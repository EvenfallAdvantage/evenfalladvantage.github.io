# Component Decomposition Plan

**Created:** April 8, 2026
**Purpose:** Break down 15 monolithic files (>700 lines) into maintainable sub-components.

---

## Priority 1: `admin/staff/page.tsx` (2,012 lines -> ~100 lines)

### Target Structure
```
app/admin/staff/
  page.tsx                    (~100 lines - orchestrator)
  staff-constants.ts          (types, status colors, document types)
  use-staff-data.ts           (all 40 useState + load callback + computed values)
  use-staff-actions.ts        (15 async mutation handlers)
  tabs/
    roster-tab.tsx            (search, CSV import, member list)
    timesheets-tab.tsx        (grouped timesheets, Gusto sync)
    corrections-tab.tsx       (time change requests)
    leave-tab.tsx             (leave requests with filter)
    forms-tab.tsx             (incident reports + field reports)
    applicants-tab.tsx        (applicant pipeline + add form)
    onboarding-tab.tsx        (task checklist, integrations)
  modals/
    applicant-detail-modal.tsx (full applicant profile view)
    member-profile-modal.tsx   (member profile overlay)
    readiness-modal.tsx        (readiness checklist)
```

### Extraction Order
1. Extract `useStaffData` hook (state + loading)
2. Extract `useStaffActions` hook (all handlers)
3. Extract 3 modals (self-contained, clear boundaries)
4. Extract 7 tab components one at a time
5. Clean up parent to orchestrator-only

---

## Priority 2: `admin/events/page.tsx` (1,664 lines -> ~250 lines)

### Target Structure
```
app/admin/events/
  page.tsx                    (~250 lines - event list + expanded toggle)
  event-helpers.ts            (fmtTime, fmtDateShort, getDaysInRange, etc.)
  components/
    create-operation-wizard.tsx  (~500 lines - 5-step wizard with 30+ state vars)
    operation-card.tsx           (collapsed event header)
    stats-bar.tsx                (shift fill rate stats)
    action-toolbar.tsx           (Quick Fill / Custom / Calendar toggle buttons)
    quick-fill-panel.tsx         (shift generation)
    custom-shift-form.tsx        (manual shift creation)
    shift-row.tsx                (shared: role + time + assignment dropdown)
    shift-list-view.tsx          (day-grouped shift list)
    shift-calendar-view.tsx      (calendar grid with day cells)
    activity-feed.tsx            (collapsible activity log)
    site-map-storyboard.tsx      (storyboard editor wrapper)
    conflict-warning-modal.tsx   (shift conflict modal)
```

### Extraction Order
1. Extract `event-helpers.ts` (pure functions, zero risk)
2. Extract `CreateOperationWizard` (largest self-contained section)
3. Extract `ShiftRow` + `MemberAssignSelect` (eliminate 3x duplication)
4. Extract calendar and list views
5. Extract remaining panels

---

## Priority 3: `feed/page.tsx` (1,127 lines -> ~550 lines)

### Target Structure
```
app/feed/
  page.tsx                    (~550 lines - data loading + layout)
  components/
    duty-status-card.tsx       (clock in/out hero widget)
    clock-in-modal.tsx         (shift selection modal)
    upcoming-shift-card.tsx    (next shift preview)
    action-required-banner.tsx (pending approvals)
    kpi-cards.tsx              (6 KPI metric cards)
    quick-actions-grid.tsx     (6 action links)
    pinned-briefings.tsx       (pinned posts with reactions)
    intel-center.tsx           (~298 lines - intelligence dashboard)
    create-company-modal.tsx   (new company form)
    professional-tools-grid.tsx (tool links)
```

### Extraction Order
1. Extract `IntelCenter` (298 lines, biggest win)
2. Extract `ClockInModal` (130 lines, self-contained)
3. Extract `PinnedBriefings` (110 lines, has own state)
4. Extract remaining cards (small, low risk)

---

## Other Files Over 700 Lines

| File | Lines | Recommended Action |
|------|-------|-------------------|
| `storyboard-editor.tsx` | 1,052 | Extract PinList, Toolbar, MapCanvas |
| `site-assessment/page.tsx` | 1,029 | Extract 7 AssessmentSections + PDFGenerator |
| `geo-risk/page.tsx` | 1,023 | Extract CrimeDataFetcher, RiskMap, ReportGenerator |
| `legacy-bridge.ts` | 1,006 | Split by domain: users, training, messages, enrollment |
| `incidents/page.tsx` | 976 | Extract IncidentDetail, IncidentForm, StoryboardPanel |
| `profile/page.tsx` | 925 | Extract ProfileTabs, EducationHistory, WorkHistory |
| `admin/training/page.tsx` | 898 | Extract ModuleEditor, SlideEditor |
| `admin/instructor/page.tsx` | 897 | Extract SlidesPanel, StudentList |
| `schedule/page.tsx` | 789 | Extract EventsTab, ShiftsTab, AssetsTab |
| `chat/page.tsx` | 781 | Extract ChannelList, MessageView, SettingsPanel |
| `landing page.tsx` | 766 | Extract LoginModal, RegisterModal |
| `academy/page.tsx` | 765 | Extract CourseCard, ModuleViewer |
| `admin/settings/page.tsx` | 755 | Extract IntegrationConfig, BrandSettings |

---

## Rules for Decomposition

1. **One component per file.** No file should define multiple exported components.
2. **Props over context.** Pass data explicitly via props. Don't add new React contexts.
3. **Hooks for shared state.** When a parent component has 20+ useState calls, extract a custom hook.
4. **Test after each extraction.** Run `npm test` after every component extraction.
5. **Preserve git blame.** Use `git mv` when possible; keep meaningful commit messages.
6. **Max 500 lines per component.** If an extracted component exceeds 500 lines, decompose it further.
