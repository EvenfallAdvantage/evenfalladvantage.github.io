-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  RBAC SELF-TEST — Phases 0-5 tables                               ║
-- ║                                                                   ║
-- ║  Read-only SQL checks that verify our RLS policies are correctly  ║
-- ║  scoped for the per-company multi-tenant model. Run this in the   ║
-- ║  Supabase SQL Editor AS AN AUTHENTICATED USER (not service_role)  ║
-- ║  to confirm RLS is filtering correctly. Service_role bypasses     ║
-- ║  RLS so it cannot be used for this test.                          ║
-- ║                                                                   ║
-- ║  Expected outcomes (when run as a user who is a member of         ║
-- ║  exactly one company):                                            ║
-- ║                                                                   ║
-- ║  - All "count rows" queries must return a count that matches the  ║
-- ║    user's own company only.                                       ║
-- ║  - All "cross-company leak" probes must return 0 rows.            ║
-- ║                                                                   ║
-- ║  If any "leak" check returns > 0 rows, RLS has a hole — file an   ║
-- ║  incident and DO NOT ship the next phase until the policy is      ║
-- ║  tightened.                                                       ║
-- ╚══════════════════════════════════════════════════════════════════╝

\echo '====================================================================';
\echo 'RBAC SELF-TEST — Phases 0-5';
\echo '====================================================================';

-- ─── Baseline: who am I? ─────────────────────────────────────
\echo '';
\echo '--- 0. Caller identity ---';
SELECT auth.uid()                              AS supabase_uid,
       (SELECT id FROM public.users WHERE supabase_id = auth.uid()::text) AS internal_user_id;

\echo '';
\echo '--- 0a. My company memberships ---';
SELECT company_id, role, status
FROM public.company_memberships
WHERE user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()::text);

-- ─── Phase 0: Teams ──────────────────────────────────────────
\echo '';
\echo '--- 1. Phase 0: teams (should only see teams from my company) ---';
SELECT COUNT(*) AS teams_visible FROM public.teams;
SELECT DISTINCT company_id FROM public.teams
  ORDER BY company_id;

\echo '';
\echo '--- 1a. Leak probe: team_members across companies (should match my teams only) ---';
SELECT COUNT(*) AS team_memberships_visible
FROM public.team_members tm
JOIN public.teams t ON t.id = tm.team_id
WHERE t.company_id NOT IN (
  SELECT company_id FROM public.company_memberships
  WHERE user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()::text)
);
-- Expected: 0

-- ─── Phase 1: Incident config + extensions ───────────────────
\echo '';
\echo '--- 2. Phase 1: incident_type_defs / status_defs / field_defs ---';
SELECT
  (SELECT COUNT(*) FROM public.incident_type_defs)   AS incident_types,
  (SELECT COUNT(*) FROM public.incident_status_defs) AS incident_statuses,
  (SELECT COUNT(*) FROM public.incident_field_defs)  AS incident_fields;

\echo '';
\echo '--- 2a. Leak probe: incident_type_defs across companies ---';
SELECT DISTINCT company_id FROM public.incident_type_defs ORDER BY company_id;

-- ─── Phase 2: Tasks ──────────────────────────────────────────
\echo '';
\echo '--- 3. Phase 2: tasks (member read) ---';
SELECT COUNT(*) AS tasks_visible FROM public.tasks;
SELECT DISTINCT company_id FROM public.tasks ORDER BY company_id;

\echo '';
\echo '--- 3a. Leak probe: task_comments scoped through parent task ---';
SELECT COUNT(*) AS task_comments_other_companies
FROM public.task_comments tc
JOIN public.tasks t ON t.id = tc.task_id
WHERE t.company_id NOT IN (
  SELECT company_id FROM public.company_memberships
  WHERE user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()::text)
);
-- Expected: 0

\echo '';
\echo '--- 3b. Leak probe: task_checklist_items scoped through parent task ---';
SELECT COUNT(*) AS checklist_items_other_companies
FROM public.task_checklist_items tci
JOIN public.tasks t ON t.id = tci.task_id
WHERE t.company_id NOT IN (
  SELECT company_id FROM public.company_memberships
  WHERE user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()::text)
);
-- Expected: 0

-- ─── Phase 4: Public reports ─────────────────────────────────
\echo '';
\echo '--- 4. Phase 4: public_report_links visible to members ---';
SELECT COUNT(*) AS links_visible FROM public.public_report_links;
SELECT DISTINCT company_id FROM public.public_report_links ORDER BY company_id;

\echo '';
\echo '--- 4a. Leak probe: public_report_submissions across companies ---';
SELECT COUNT(*) AS submissions_other_companies
FROM public.public_report_submissions
WHERE company_id NOT IN (
  SELECT company_id FROM public.company_memberships
  WHERE user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()::text)
);
-- Expected: 0

\echo '';
\echo '--- 4b. Leak probe: public_report_messages scoped through submission ---';
SELECT COUNT(*) AS messages_other_companies
FROM public.public_report_messages
WHERE company_id NOT IN (
  SELECT company_id FROM public.company_memberships
  WHERE user_id IN (SELECT id FROM public.users WHERE supabase_id = auth.uid()::text)
);
-- Expected: 0

\echo '';
\echo '--- 4c. sms_send_log visible only to admins (not members) ---';
-- The select policy is `is_company_admin` not `is_company_member`. A manager
-- without admin role should see 0 rows even for their own company.
SELECT COUNT(*) AS sms_log_visible FROM public.sms_send_log;

-- ─── Anon role checks ────────────────────────────────────────
\echo '';
\echo '--- 5. Anonymous role probes (must run as anon, not authenticated) ---';
\echo '    These checks must be run separately in an anon session. They are';
\echo '    documented here for the test harness.';
\echo '';
\echo '    Expected outcomes when anonymous:';
\echo '      SELECT COUNT(*) FROM public.public_report_links WHERE is_active = true;';
\echo '        -> may return >0 (anon can read active links — by design)';
\echo '      SELECT COUNT(*) FROM public.public_report_links WHERE is_active = false;';
\echo '        -> 0 (anon must NOT see inactive links)';
\echo '      SELECT COUNT(*) FROM public.public_report_submissions;';
\echo '        -> 0 (anon cannot read submissions — only insert via the form)';
\echo '      SELECT COUNT(*) FROM public.teams;';
\echo '        -> 0';
\echo '      SELECT COUNT(*) FROM public.tasks;';
\echo '        -> 0';
\echo '      SELECT COUNT(*) FROM public.incidents;';
\echo '        -> 0';
\echo '      SELECT COUNT(*) FROM public.audit_logs;';
\echo '        -> 0';

\echo '';
\echo '====================================================================';
\echo 'END RBAC SELF-TEST';
\echo '====================================================================';
