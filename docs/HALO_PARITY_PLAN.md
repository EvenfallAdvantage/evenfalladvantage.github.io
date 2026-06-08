# Overwatch → Halo Feature Parity (Option A) — Comprehensive Implementation Plan

## How to use this plan (READ FIRST — applies to every task)

**Golden rules for the executing LLM:**

1. **Never invent patterns. Copy existing ones.** Every new file must mirror a named reference file in this plan. Open the reference, copy its structure, change only the domain specifics.
2. **Fit the existing layout.** New pages use `<PageShell>`. New nav items go in `nav-items.ts` + `ICON_MAP` in `app-sidebar.tsx`. New modals copy `roster-bulk-email-modal.tsx`. New tiles copy `integrations-section.tsx`. Use semantic Tailwind classes only (`bg-card`, `text-muted-foreground`, `border-border/40`), never raw hex.
3. **Multi-tenancy is mandatory.** Every table has `company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE`. Every RLS policy uses `public.is_company_member(company_id)` (read/write) and `public.is_company_admin(company_id)` (delete). SECURITY DEFINER RPCs use `SET search_path = ''` + fully-qualified names + `REVOKE EXECUTE ... FROM PUBLIC` then `GRANT ... TO authenticated|service_role`.
4. **Casting rule:** `users.supabase_id` is TEXT; always compare `auth.uid()::text`. `company_memberships.role` is the `CompanyRole` enum; cast `p_role::public."CompanyRole"`.
5. **DB client modules:** one `db-<domain>.ts` in `overwatch-src/src/lib/supabase/`, re-exported from `db.ts`. Import `createClient`, `ts`, `ensureInternalUser`, `logDbReadError`. Spread `...ts()` on inserts. Generate ids with `crypto.randomUUID()`. Map snake_case→camelCase. Return `[]`/`null` on read error.
6. **Edge Functions:** copy `roster-invite` (user JWT), `email-send` (service-role), or `intel-earthquakes` (public). Use `getCorsHeaders`, `{ error }` envelope, `logAudit`. Add a `[functions.<name>]` block to `supabase/config.toml` with a comment if `verify_jwt=false`.
7. **SQL is applied manually** in the Supabase SQL Editor (project `nneueuvyeohwnspbwfub`). Files go in repo-root `sql/` for cross-cutting infra OR `overwatch-src/prisma/add-<feature>.sql` for app-domain tables. Every file: box-header comment, `CREATE TABLE IF NOT EXISTS`, indexes, `ENABLE ROW LEVEL SECURITY`, `DROP POLICY IF EXISTS`/`CREATE POLICY`, `COMMENT ON TABLE`.
8. **React Compiler purity:** no `setState` inside `useEffect` render path. Use the `useCallback`-wrapped loader + `useEffect(() => { void load(); }, [load])` pattern.
9. **Verify after every phase (from `overwatch-src/`):** `npx tsc --noEmit` → `npm run lint` (0 warnings) → `npm test` (must stay green; baseline 569) → `npm run build`. Add new tests for new `db-*` modules and RPC-call helpers.
10. **Permissions:** gate UI with `hasMinRole(role as CompanyRole, "manager"|"admin")` from `@/lib/permissions`.
11. **Commit per task** using conventional commits, single-line `-m`, no em-dashes / no single quotes (PowerShell). Push with the `gh auth token` pattern.

**Reference files to keep open the whole time:**
- Edge fn (user): `supabase/functions/roster-invite/index.ts`
- Edge fn (service): `supabase/functions/email-send/index.ts`
- Edge fn (public): `supabase/functions/intel-earthquakes/index.ts`
- SQL table+RLS: `sql/add_roster_invitations.sql`, `sql/add_email_send_log.sql`
- SQL RPC: `sql/add_accept_roster_invitation_rpc.sql`
- DB module: `overwatch-src/src/lib/supabase/db-invoices.ts`, `db-incidents.ts`
- Modal: `overwatch-src/src/components/roster/roster-bulk-email-modal.tsx`
- Page shell + tiles: `overwatch-src/src/app/admin/settings/page.tsx`, `components/integrations-section.tsx`
- Nav: `overwatch-src/src/components/layout/nav-items.ts`, `app-sidebar.tsx`
- Charts: `overwatch-src/src/app/feed/components/shared.tsx`
- Map layer: `overwatch-src/src/components/tactical-map/hooks/use-incidents-layer.ts`, `map-layers-panel.tsx`, `use-cesium-layers.ts`

---

## PHASE 0 — Foundations: Teams + Shared Infra (do this FIRST)

Everything else assigns to teams and references shared enums, so this lands first.

### 0.1 — Teams schema
**File:** `overwatch-src/prisma/add-teams-system.sql` (new)
- `teams`: `id`, `company_id` (FK CASCADE), `name` NOT NULL, `description`, `color TEXT DEFAULT '#6366f1'`, `icon TEXT`, `is_archived BOOLEAN DEFAULT false`, `created_by` (FK users SET NULL), `...timestamps`.
- `team_members`: `id`, `team_id` (FK CASCADE), `user_id` (FK users CASCADE), `role TEXT DEFAULT 'member' CHECK (role IN ('lead','member'))`, `created_at`, `UNIQUE(team_id, user_id)`.
- Indexes: `idx_teams_company`, `idx_team_members_team`, `idx_team_members_user`.
- RLS: SELECT/INSERT/UPDATE `is_company_member(company_id)`; DELETE `is_company_admin(company_id)`. For `team_members`, scope through a join to `teams` (copy the `incident_media` join-through-parent pattern in `sql/add_broadcasts_breaks_media.sql:121-145`).
- `COMMENT ON TABLE`.

### 0.2 — Teams service layer
**File:** `overwatch-src/src/lib/supabase/db-teams.ts` (new) — copy `db-invoices.ts` shape.
- Types: `Team`, `TeamMember` (camelCase).
- Functions: `getTeams(companyId)`, `getTeam(teamId)`, `createTeam(companyId, input)`, `updateTeam(teamId, updates)`, `archiveTeam(teamId)`, `deleteTeam(teamId)`, `getTeamMembers(teamId)`, `addTeamMember(teamId, userId, role)`, `removeTeamMember(teamId, userId)`, `getUserTeams(companyId, userId)`.
- Re-export from `overwatch-src/src/lib/supabase/db.ts`.

### 0.3 — Teams admin UI
- **New tab** in the existing Staff admin area (`overwatch-src/src/app/admin/staff/page.tsx`): add a `Teams` tab alongside Roster. Component `overwatch-src/src/app/admin/staff/components/teams-tab.tsx` (copy structure/toolbar/table from `roster-tab.tsx`).
- Team create/edit modal copying `roster-bulk-email-modal.tsx` overlay pattern.
- Member-assignment picker reuses roster member list.
- Gate with `hasMinRole(role, "manager")`.

### 0.4 — Shared status/priority constants (single source of truth)
**File:** `overwatch-src/src/lib/work-constants.ts` (new) — centralize so incidents AND tasks share vocabulary. Mirror the array-of-`{value,label,color,icon}` style from `incidents/components/constants.ts`. Export `PRIORITY` (critical/high/medium/low), `WORK_STATUS` base set, helper `byValue()`. Incidents keep their existing `STATUS`/`SEVERITY` but import `PRIORITY` from here.

### 0.5 — Tests + verify
Add `db-teams.test.ts` using `createMockSupabase()`. Run full verify gate. **Commit:** `feat(teams): add teams within company (schema, service, admin UI)`.

---

## PHASE 1 — HaloControl parity: Incident lifecycle (EXTEND existing)

We extend the existing `incidents` system. **Do not create a parallel module.**

### 1.1 — Schema extensions
**File:** `overwatch-src/prisma/add-incident-enhancements.sql` (new)
- `ALTER TABLE incidents ADD COLUMN IF NOT EXISTS`: `team_id UUID REFERENCES teams(id) ON DELETE SET NULL`, `incident_number TEXT` (human ref, e.g. `INC-2026-0001`), `due_at TIMESTAMPTZ`, `closed_at TIMESTAMPTZ`, `source TEXT DEFAULT 'internal' CHECK (source IN ('internal','public','api'))`, `custom_fields JSONB DEFAULT '{}'::jsonb`.
- **Custom incident types/statuses per company** — new tables:
  - `incident_type_defs`: `id`, `company_id`, `key`, `label`, `color`, `icon`, `sort_order`, `is_active`. Seed defaults from the existing `TYPES` array via an INSERT loop.
  - `incident_status_defs`: `id`, `company_id`, `key`, `label`, `color`, `sort_order`, `is_terminal BOOLEAN`. Seed from existing `STATUS`.
  - `incident_field_defs` (custom form fields): `id`, `company_id`, `incident_type_key` (nullable = applies to all), `field_key`, `label`, `field_type CHECK IN ('text','number','select','multiselect','date','checkbox','textarea')`, `options JSONB`, `required BOOLEAN`, `sort_order`, `conditional_on JSONB` (for conditional questions).
- Indexes + RLS (member read, admin write) + COMMENTs.
- Auto-number: a SECURITY DEFINER RPC `next_incident_number(p_company_id)` returning the formatted string (copy `SET search_path=''` pattern). Use a per-company counter table `incident_counters(company_id, year, seq)` with `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`.

### 1.2 — Service layer extensions
**File:** `overwatch-src/src/lib/supabase/db-incidents.ts` (extend)
- Extend `createIncident` to accept `teamId`, `dueAt`, `customFields`, `source`; call `next_incident_number` RPC and store `incident_number`.
- Add `assignIncidentToTeam(incidentId, teamId)`, `setIncidentStatus(incidentId, statusKey)` (writes an `incident_updates` row of `type:'status_change'` automatically), `getIncidentsByTeam`, `getIncidentsFiltered(companyId, {status,priority,teamId,type,assignedTo,from,to})`.
- **New module** `overwatch-src/src/lib/supabase/db-incident-config.ts` for the `*_defs` tables: `getIncidentTypes/Statuses/Fields(companyId)` + admin CRUD. Re-export from `db.ts`.

### 1.3 — Custom form builder (config UI)
- New admin page `overwatch-src/src/app/admin/settings/incidents/page.tsx` using `<PageShell>` — manage types, statuses, custom fields. Register a redirect tile in HQ Config (`integrations-section.tsx` style or a new "Operations" section on the settings page).
- Drag-reorder copies the existing `reorderOnboardingTasks` pattern (`db-onboarding.ts`).

### 1.4 — Incident create form upgrade
**File:** `overwatch-src/src/app/incidents/components/incident-create-form.tsx` (extend)
- Render custom fields dynamically from `incident_field_defs` (respect `conditional_on`). Keep the existing `buildDescription()` enhanced-narrative behavior; store structured answers in `custom_fields` JSONB (new) **in addition** so nothing breaks.
- Add Team selector + Priority selector + Due date.

### 1.5 — Live status board (control-room view)
- New component `overwatch-src/src/app/incidents/components/incident-board.tsx` — a filterable live dashboard (status columns / priority sort / team filter). Add as a tab on the existing `/incidents` page (which already titles itself "REPORTS").
- **Realtime:** subscribe to `incidents` table changes via `supabase.channel(...).on('postgres_changes', ...)`. Respect Micro-tier limits (one channel per company, unsubscribe on unmount). Use the `useCallback` loader + effect cleanup pattern.

### 1.6 — Live updates / activity log
- The `incident_updates` table already exists. Add a timeline component `incident-timeline.tsx` showing notes + auto status-change entries with timestamp + user attribution (defensible record). Reuse `getIncidentUpdates`.

### 1.7 — Evidence capture
- `incident_media` already exists with SHA-256 chain-of-custody. The upload component `incident-media-upload.tsx` already works. Ensure new board/detail views surface it. No schema change.

### 1.8 — 1-click report export
- Extend `overwatch-src/src/lib/csv-export.ts` `INCIDENT_COLUMNS` for new fields. Add a per-incident PDF export reusing the existing `jspdf`/`html2canvas` DAR pattern (`db-dar.ts`).

### 1.9 — Map layer (already exists)
- `use-incidents-layer.ts` already plots incidents. Extend the popup to show `incident_number`, team, priority. Add a **team filter** to the layer by reading `layers.incidents` + a new `incidentTeamFilter` value (optional; can defer).

### 1.10 — Tests + verify
`db-incidents` new-function tests, `db-incident-config.test.ts`. Verify gate. **Commits:** one per sub-area (schema / service / config UI / form / board / export).

---

## PHASE 2 — HaloTaskManager parity: General task system (NEW module)

Separate from onboarding checklists.

### 2.1 — Schema
**File:** `overwatch-src/prisma/add-tasks-system.sql` (new)
- `tasks`: `id`, `company_id` (FK CASCADE), `team_id` (FK SET NULL), `incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL` (link-to-incident), `parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE` (subtasks), `title` NOT NULL, `description`, `status TEXT DEFAULT 'todo' CHECK (status IN ('todo','in_progress','blocked','done','cancelled'))`, `priority TEXT DEFAULT 'medium'`, `created_by` (FK users), `assigned_to` (FK users SET NULL), `due_at`, `completed_at`, `sort_order INT`, `recurrence JSONB` (rule for recurring), `custom_fields JSONB`, `...timestamps`.
- `task_watchers`: `id`, `task_id` (FK CASCADE), `user_id` (FK CASCADE), `UNIQUE(task_id,user_id)`.
- `task_checklist_items`: `id`, `task_id` (FK CASCADE), `content`, `is_done BOOLEAN`, `sort_order`, `...timestamps`.
- `task_comments`: `id`, `task_id` (FK CASCADE), `user_id`, `content`, `created_at` (activity log).
- Indexes (`idx_tasks_company_status`, `idx_tasks_assigned`, `idx_tasks_incident`, `idx_tasks_parent`, watcher/checklist by task).
- RLS member read/write, admin delete; watchers/checklist/comments scoped through join to `tasks`.
- COMMENTs.

### 2.2 — Recurring task generator
- SECURITY DEFINER RPC `generate_recurring_tasks(p_company_id)` OR a scheduled Edge Function `tasks-recurrence` (public/service-role, triggered by Supabase cron / pg_cron) that reads `recurrence` rules and spawns due instances. **Decision:** prefer pg_cron calling the RPC (no extra function infra). Mark clearly in the file header.

### 2.3 — Service layer
**File:** `overwatch-src/src/lib/supabase/db-tasks.ts` (new, copy `db-invoices.ts`)
- CRUD: `getTasks(companyId, filters)`, `getTask`, `createTask`, `updateTask`, `setTaskStatus`, `deleteTask`, `getSubtasks(parentId)`, watchers add/remove, checklist CRUD + toggle, comments add/list, `linkTaskToIncident(taskId, incidentId)`, `getTasksForIncident(incidentId)`.
- Re-export from `db.ts`.

### 2.4 — UI
- New nav item **Tasks** in `nav-items.ts` (`Field Ops` or `Command` section) + `ICON_MAP` entry (lucide `ListChecks` or `CheckSquare`) + command-palette entry.
- New page `overwatch-src/src/app/tasks/page.tsx` with `<PageShell title="TASKS">`. Tabs: **My Tasks / Team / All** + a board view.
- Task detail drawer/modal copying `roster-bulk-email-modal.tsx` overlay: subtasks list, checklist, watchers, comments timeline, linked incident chip, recurrence editor.
- Cross-link: on the incident detail view (Phase 1) show linked tasks via `getTasksForIncident`; add "Create task from incident" action.

### 2.5 — Tests + verify
`db-tasks.test.ts`. Verify gate. **Commits** per sub-area.

---

## PHASE 3 — HaloFusion parity: Multi-team coordination

### 3.1 — Assignment plumbing (already laid by `team_id` in Phases 1–2)
- Add `transferIncident(incidentId, toTeamId, note)` and `transferTask(...)` to the respective db modules — each writes an `incident_updates`/`task_comments` audit row (`type:'transfer'`).

### 3.2 — Team dashboards
- New page `overwatch-src/src/app/teams/page.tsx` (or a Team view tab on `/feed`) showing per-team KPIs. Reuse `db-analytics.ts` patterns; add `getTeamMetrics(companyId, teamId)` to `db-analytics.ts` (open incidents/tasks, overdue, recent activity by team).
- Charts reuse `MiniBarChart`/`DonutChart`/`ProgressBar` from `feed/components/shared.tsx`.

### 3.3 — Multi-dashboard mode
- Add a team switcher to the feed/board pages (a dropdown filtering by `team_id`). Persist last-selected team to `localStorage` per company (copy the `tactical-map.tsx:54-69` localStorage pattern).

### 3.4 — Share-to-team & filtering
- Extend filter bars (incidents board, tasks board) with team multiselect. Add "share to team" = reassign + notify watchers (in-app notification using existing notification system referenced in `db-analytics.ts` "notifications sent").

### 3.5 — Tests + verify
Verify gate. **Commit:** `feat(teams): multi-team dashboards, transfer, and filtering`.

---

## PHASE 4 — HaloEngage parity: Public reporting + SMS

### 4.1 — Public report token schema (reuse intake pattern)
**File:** `overwatch-src/prisma/add-public-incident-reports.sql` (new) — model on `client_intake_tokens` + `sql/add_intake_api_keys.sql`.
- `public_report_links`: `id`, `company_id` (FK CASCADE), `team_id` (FK SET NULL), `slug TEXT UNIQUE`, `label`, `is_active BOOLEAN`, `default_type`, `created_by`, `...timestamps`. (One per QR/link.)
- `public_report_submissions`: `id`, `link_id` (FK), `company_id`, `reporter_name`, `reporter_phone`, `reporter_email`, `body`, `location`, `location_lat/lng`, `media JSONB`, `status TEXT DEFAULT 'new' CHECK (...)`, `incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL` (promoted incident), `created_at`.
- **Anon RLS:** `public_report_submissions` gets a `FOR INSERT TO anon WITH CHECK (true)` policy (copy `applicants_public_insert` in `add-onboarding-system.sql:56-59`). `public_report_links` gets anon SELECT for active links only (`USING (is_active)`), copy storyboard anon select pattern. Member SELECT for submissions; admin manage.

### 4.2 — Public route + page
- Add `/report` to `PUBLIC_ROUTES` in `overwatch-src/src/components/app-shell.tsx:7`.
- New public page `overwatch-src/src/app/report/page.tsx` reading `?l=<slug>`: loads the link via an anon query, renders a no-login form (name/phone/description/location/photo), submits to `public_report_submissions`. Copy `/intake/page.tsx` structure.
- Media upload to a public-writable storage bucket (mirror `incident-media` bucket setup; submissions reference uploaded paths).

### 4.3 — QR + link generation (admin)
- Admin manager page `overwatch-src/src/app/admin/staff/components/public-reports-tab.tsx` (or under incidents config): create links, generate QR via the existing `(await import("qrcode")).default` pattern (copy `roster-tab.tsx:539` / `client-intake-share-modal.tsx:156`), list/triage submissions, **"Promote to incident"** action (creates an `incidents` row with `source:'public'`, links `incident_id`).

### 4.4 — SMS provider abstraction (Twilio)
Mirror the email provider abstraction exactly.
**Files (new):** `supabase/functions/_shared/sms/types.ts` (`SmsProvider` interface, `SmsMessage`, `SendResult`, `TwilioConfig`), `twilio-provider.ts` (Twilio REST via HTTPS fetch — no SDK), `platform-provider.ts` (platform fallback using env `TWILIO_*`), `vault.ts` (reuse the email `vault.ts` RPC wrappers; credentials in Supabase Vault), `factory.ts` (`resolveSmsProviderForCompany`).
- SQL: extend `integrations_config` with SMS rows (`provider='sms'`, `delivery_method='twilio'`, `vault_secret_id`, `from_number`, `verified_at`) — new file `sql/extend_integrations_config_sms.sql` copying `sql/extend_integrations_config_email.sql`.

### 4.5 — SMS Edge Functions
- `supabase/functions/sms-send/index.ts` (service-role-only, copy `email-send`): resolves provider, sends, logs to new `sms_send_log` table (copy `add_email_send_log.sql` → `sql/add_sms_send_log.sql`).
- `supabase/functions/sms-reply-to-reporter/index.ts` (user JWT, copy `roster-invite`): manager replies to a submission's `reporter_phone`; RBAC `is_company_member`; rate-limited; audited.
- `supabase/functions/sms-test-send` + `sms-save-credentials` (copy email equivalents).
- Add all to `supabase/config.toml`.

### 4.6 — SMS config page
- New page `overwatch-src/src/app/admin/settings/sms/page.tsx` copying `admin/settings/email/page.tsx` (provider picker, write-only credential form, test-send, recent-sends). Redirect tile in HQ Config integrations (Messaging & Alerts group).

### 4.7 — Reporter reply UI
- In the submissions triage tab, a reply box calls `sms-reply-to-reporter`. Show thread of replies (new `public_report_messages` table, or store in `sms_send_log` with a `submission_id` ref — prefer a dedicated `public_report_messages` for clean threading).

### 4.8 — SecurityEventType additions
Add to `overwatch-src/src/lib/security/index.ts` (and edge `_shared/audit.ts` usage): `public.report.submitted`, `public.report.promoted`, `admin.sms.sent`, `admin.sms.config_changed`, `admin.sms.config_verified`, `admin.sms.config_test_failed`.

### 4.9 — Tests + verify + deploy
Tests for SMS factory/providers (copy email provider tests if present), `db` helpers. Verify gate. Deploy 4 SMS functions `--project-ref nneueuvyeohwnspbwfub`; verify `HTTP 200` OPTIONS preflight. **Commits** per sub-area.

---

## PHASE 5 — HaloInsights parity: Analytics & reporting

### 5.1 — Chart primitives expansion (hand-rolled SVG)
**File:** `overwatch-src/src/app/feed/components/shared.tsx` (extend) or new `overwatch-src/src/components/charts/`.
- Add: `LineChart` (trend over time), `StackedBarChart`, `GroupedBarChart`, `Sparkline`, `HeatCalendar` — all inline SVG matching the existing `MiniBarChart`/`DonutChart` style (same props/coloring conventions, `text-muted-foreground`, theme vars).

### 5.2 — Analytics queries
**File:** `overwatch-src/src/lib/supabase/db-analytics.ts` (extend)
- `getIncidentAnalytics(companyId, {from,to,teamId,groupBy})` — counts by type/status/severity/team/time-bucket.
- `getTaskAnalytics(...)` — open/overdue/completion-rate by team/assignee.
- `getMultiLogReport(companyId, params)` — combined incident+task+patrol+clock activity (extend the existing `db-events.ts` activity mixing).
- Drill-down helpers returning row lists for a clicked segment.

### 5.3 — Analytics page
- New page `overwatch-src/src/app/admin/analytics/page.tsx` (`<PageShell title="ANALYTICS">`) — filter bar (date range, team, type, status), chart grid, drill-down table. Nav item + `ICON_MAP` (lucide `BarChart3`) + command palette. Gate `canViewReports`.
- Advanced filtering UI reused across incidents board + tasks board + analytics (shared filter component `overwatch-src/src/components/work/filter-bar.tsx`).

### 5.4 — Report exports + white-label
- "Send report to email" uses the existing `email-send` function (or a new `analytics-email-report` wrapper) attaching CSV/PDF.
- White-label: PDF header pulls company `name`, `logo_url`, `brand_color` (already on `companies`). Reuse `jspdf`/`html2canvas`.
- Extend `csv-export.ts` with `TASK_COLUMNS`, `ANALYTICS_COLUMNS`.

### 5.5 — Tests + verify
`db-analytics` new-function tests. Verify gate. **Commits** per sub-area.

---

## PHASE 6 — Enterprise security & compliance

### 6.1 — SSO (Entra ID / Azure AD / Okta via SAML/OIDC)
- Supabase Auth supports SSO. **Investigate at build time** (websearch + Supabase docs) whether the project's plan tier enables SSO; if so configure provider in Supabase dashboard (manual, document in `docs/`). App-side: handle SSO callback route (extend `/auth/callback`), map SSO identity → `users`/`company_memberships`. If tier-blocked, document as a config prerequisite and stub the UI.

### 6.2 — RBAC hardening
- Audit every new table's RLS for least-privilege. Add a SQL self-test file `sql/verify_rbac_phaseN.sql` (SELECT-only checks) per phase.

### 6.3 — Audit trail completeness
- Ensure every mutating Edge Function calls `logAudit`; every sensitive client mutation calls `logSecurityEvent`. Add a new admin **Audit Log viewer** if not already complete (`getAuditLogs` exists in `security/audit.ts`); surface it under `admin/security`.

### 6.4 — Data retention + GDPR
- Add `data-export` (per-user data bundle) and `data-delete` (right-to-be-forgotten) flows — Edge Functions (service-role) + admin UI under `admin/security`. Use existing `data.export`/`data.delete` SecurityEventTypes.

### 6.5 — Compliance & certification docs (no code)
- `docs/COMPLIANCE.md`: map features to Martyn's Law / Hillsborough Law / GDPR. ISO 27001 / Cyber Essentials are **external audits** — document as organizational tasks, not code. Pen-testing = external engagement.

### 6.6 — Verify
Verify gate. **Commits** per sub-area.

---

## PHASE 7 — HaloLocate parity: venue geospatial

### 7.1 — Geofences schema
**File:** `overwatch-src/prisma/add-geofences.sql`
- `geofences`: `id`, `company_id`, `team_id` (SET NULL), `name`, `geometry JSONB` (GeoJSON polygon), `color`, `is_active`, `...timestamps`. Limit enforcement (≤ configurable per company) in service layer.
- RLS member read / admin write.

### 7.2 — Service + map layer
- `db-geofences.ts` CRUD.
- New Cesium layer hook `use-geofences-layer.ts` (copy `use-incidents-layer.ts` contract: clear-group → guard `layers.geofences` → add polygon entities → push to `entityGroupsRef`). Register in `map-layers-panel.tsx` (`LayerVisibility` + `DEFAULT_LAYERS` + `LAYER_TOGGLES` under **OPERATIONS**) and `use-cesium-layers.ts`.
- Draw/edit geofences using the existing map-tools/annotations hook pattern (`use-annotations-layer.ts` / `use-map-tools.ts`).

### 7.3 — CAD overlay
- The site-map / storyboard overlay system already exists (`add-storyboard-system.sql`, site-overlay state in `use-cesium-layers.ts`). Document how to upload a CAD/floorplan image as a georeferenced overlay; extend opacity/bounds controls already present in `map-layers-panel.tsx:238-286`. Likely **no new schema** — reuse storyboards.
- Mapbox: **skip** (Cesium already provides imagery; introducing Mapbox conflicts with the existing stack). Note this divergence explicitly.

### 7.4 — Verify
Verify gate. **Commit:** `feat(map): geofences layer and venue overlays`.

---

## PHASE 8 — Full offline queue (faithful) — LAST, highest risk

User chose the full faithful implementation. Isolate it so prior phases ship independently.

### 8.0 — Add deps & verify build still works
- Add `idb` to dependencies, `fake-indexeddb` to devDependencies (`overwatch-src/package.json`).
- Run `npm install`, then full verify gate. Commit before touching any logic: `chore(offline): add idb and fake-indexeddb deps`.

### 8.1 — IndexedDB queue module (pure, testable, no UI)
- `overwatch-src/src/lib/offline/db.ts`: open DB `overwatch-offline` v1, object store `mutations` (keyPath `id`), index `by_status`.
- `overwatch-src/src/lib/offline/queue.ts`: `enqueue(mutation)`, `getPending()`, `markDone(id)`, `bumpAttempt(id)`, `clear()`. Mutation shape `{ id, kind, payload, createdAt, attempts, status: 'pending'|'done'|'error' }`.
- Unit tests with `fake-indexeddb` (`db-offline-queue.test.ts`). Commit.

### 8.2 — Online/offline detection hook
- `overwatch-src/src/hooks/use-online.ts`: subscribes to `online`/`offline` events; returns boolean. React-Compiler-safe (event listeners in effect with cleanup, no setState-in-render). Test. Commit.

### 8.3 — Sync engine (replay)
- `overwatch-src/src/lib/offline/sync.ts`: `drainQueue()` reads pending, dispatches each by `kind` to the existing `db-*` functions (incidents/tasks/updates/comments/public-report), `markDone` on success, `bumpAttempt` on failure (cap attempts, mark `error`). Last-write-wins via `updated_at`.
- Triggered on reconnect (from `use-online`) and on app focus. Test with mocked `db-*`. Commit.

### 8.4 — Optimistic write wrappers
- `overwatch-src/src/lib/offline/with-offline.ts`: helper that tries the live `db-*` call; on offline/fetch-failure, `enqueue` + return an optimistic record with `__pendingSync: true`.
- Wire into incident/task create+update+comment paths. UI shows a "pending sync" badge. Commit.

### 8.5 — Service worker (app shell cache)
- `overwatch-src/public/sw.js`: cache app shell; register at `${basePath}/sw.js` in a client effect guarded by `'serviceWorker' in navigator`. Confirm compatibility with `output:'export'` + `basePath:'/overwatch'` + `trailingSlash:true` (investigate at build time; document precisely in `docs/`). Commit.

### 8.6 — Conflict surfacing + manual test checklist
- Small "sync issues" toast/list for `error`-status mutations. `docs/OFFLINE_TESTING.md` manual checklist (DevTools offline toggle, queue, reconnect, verify rows). Final verify gate. Commit.

---

## Cross-cutting deliverables (every phase)

- **`docs/SESSION_HANDOFF.md`**: append each phase's SQL files (with apply order) + Edge Function deploy checklist.
- **`supabase/config.toml`**: every new function gets a block (+ comment if `verify_jwt=false`).
- **`db.ts`**: re-export every new `db-*` module.
- **`nav-items.ts` + `app-sidebar.tsx` ICON_MAP + `command-palette.tsx`**: register every new page.
- **Tests stay green** (baseline 569) and grow with each module.
- **Per-phase verify gate** is non-negotiable before commit.

---

## Suggested execution order & dependencies
0 (teams/infra) → 1 (incidents) → 2 (tasks) → 3 (fusion, needs 0–2) → 4 (public+SMS) → 5 (analytics, needs 1–2 data) → 6 (security) → 7 (geospatial) → 8 (offline, wraps 1–2 writes). Each phase is independently shippable.

---

## Known divergences from Halo (call out to user)
- **Mapbox**: skipped — Cesium is the established stack.
- **Drone streaming / in-app video calling (iOS)**: out of scope for a web static-export app; note as native-only gaps.
- **ISO 27001 / Cyber Essentials / pen-testing**: external audits, documented not coded.
- **SSO**: depends on Supabase plan tier; may be a config prerequisite.

---

## Phase 8 — expanded (finer-grained for a lesser LLM)

**8.0 — Add deps & verify build still works**
- Add `idb` to dependencies, `fake-indexeddb` to devDependencies (`overwatch-src/package.json`).
- Run `npm install`, then full verify gate. Commit before touching any logic: `chore(offline): add idb and fake-indexeddb deps`.

**8.1 — IndexedDB queue module (pure, testable, no UI)**
- `overwatch-src/src/lib/offline/db.ts`: open DB `overwatch-offline` v1, object store `mutations` (keyPath `id`), index `by_status`.
- `overwatch-src/src/lib/offline/queue.ts`: `enqueue(mutation)`, `getPending()`, `markDone(id)`, `bumpAttempt(id)`, `clear()`. Mutation shape `{ id, kind, payload, createdAt, attempts, status: 'pending'|'done'|'error' }`.
- Unit tests with `fake-indexeddb` (`db-offline-queue.test.ts`). Commit.

**8.2 — Online/offline detection hook**
- `overwatch-src/src/hooks/use-online.ts`: subscribes to `online`/`offline` events; returns boolean. React-Compiler-safe (event listeners in effect with cleanup, no setState-in-render). Test. Commit.

**8.3 — Sync engine (replay)**
- `overwatch-src/src/lib/offline/sync.ts`: `drainQueue()` reads pending, dispatches each by `kind` to the existing `db-*` functions (incidents/tasks/updates/comments/public-report), `markDone` on success, `bumpAttempt` on failure (cap attempts, mark `error`). Last-write-wins via `updated_at`.
- Triggered on reconnect (from `use-online`) and on app focus. Test with mocked `db-*`. Commit.

**8.4 — Optimistic write wrappers**
- `overwatch-src/src/lib/offline/with-offline.ts`: helper that tries the live `db-*` call; on offline/fetch-failure, `enqueue` + return an optimistic record with `__pendingSync: true`.
- Wire into incident/task create+update+comment paths. UI shows a "pending sync" badge. Commit.

**8.5 — Service worker (app shell cache)**
- `overwatch-src/public/sw.js`: cache app shell; register at `${basePath}/sw.js` in a client effect guarded by `'serviceWorker' in navigator`. Confirm compatibility with `output:'export'` + `basePath:'/overwatch'` + `trailingSlash:true` (investigate at build time; document precisely in `docs/`). Commit.

**8.6 — Conflict surfacing + manual test checklist**
- Small "sync issues" toast/list for `error`-status mutations. `docs/OFFLINE_TESTING.md` manual checklist (DevTools offline toggle, queue, reconnect, verify rows). Final verify gate. Commit.
