-- ============================================================================
-- OVERWATCH - Database Linter Remediation (Phase 9 / Cleanup)
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
--
-- Addresses the Supabase database linter findings:
--   1. ERROR  security_definer_view: public.team_memberships
--   2. WARN   anon_security_definer_function_executable (11 functions)
--   3. WARN   authenticated_security_definer_function_executable (20 functions)
--
-- Triage decisions (carefully reviewed call sites in overwatch-src + supabase/functions):
--
--   KEEP ANON + AUTHENTICATED (intentionally public):
--     - get_partner_companies        -> public landing page lists partners
--     - is_company_admin             -> RLS policy helper; MUST be callable
--     - is_company_manager           -> RLS policy helper
--     - is_company_member            -> RLS policy helper
--     - is_team_member               -> RLS policy helper
--     - user_belongs_to_company      -> RLS policy helper
--     - get_my_user_id               -> RLS policy helper
--   (Postgres requires policy helpers to be EXECUTE-able by the role the
--   policy is being evaluated for; locking them down breaks every RLS check.)
--
--   AUTHENTICATED ONLY (revoke anon):
--     - accept_roster_invitation        -> called from /auth/update-password
--     - create_roster_member            -> called from db-users.ts (admin UI)
--     - create_company_with_owner       -> register flow (signed-in user)
--     - join_company_by_code            -> register flow
--     - convert_applicant_to_roster     -> admin onboarding flow
--     - update_member_role              -> admin roster mgmt
--     - remove_company_member           -> admin roster mgmt
--     - next_incident_number            -> incident-create RPC
--     - generate_recurring_tasks        -> admin task UI + pg_cron
--
--   SERVICE_ROLE ONLY (revoke anon AND authenticated):
--     - upsert_roster_invitation        -> called only from roster-invite edge fn
--     - vault_create_secret             -> called only from email/sms edge fns
--     - vault_read_secret               -> called only from edge fns
--     - vault_update_secret             -> called only from edge fns
--     - vault_delete_secret             -> orphan; lock down anyway
--
-- This file is idempotent - safe to re-run.
-- ============================================================================

-- =================================================================
-- 1. ERROR: drop the unused team_memberships SECURITY DEFINER view.
-- =================================================================
-- The view exposes `users.email` plus team membership joins. It was added
-- as a "convenience view" but no code path queries it (confirmed via grep
-- of overwatch-src + supabase/functions on 2026-06-08). Drop entirely.
-- If we later need the convenience, replace it with a SECURITY INVOKER
-- view AND ensure the underlying RLS policies are tight enough.

DROP VIEW IF EXISTS public.team_memberships;

-- =================================================================
-- 2. AUTHENTICATED ONLY - revoke anon execute on these
-- =================================================================

REVOKE EXECUTE ON FUNCTION public.accept_roster_invitation() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_roster_member(uuid, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_company_with_owner(text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_company_by_code(text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.convert_applicant_to_roster(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_member_role(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_company_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_incident_number(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_recurring_tasks(uuid) FROM anon;

-- Make sure authenticated DOES still have execute on these (idempotent).
GRANT EXECUTE ON FUNCTION public.accept_roster_invitation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_roster_member(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_with_owner(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_company_by_code(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_applicant_to_roster(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_incident_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_recurring_tasks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_recurring_tasks(uuid) TO service_role;

-- =================================================================
-- 3. SERVICE_ROLE ONLY - revoke anon AND authenticated on these
-- =================================================================

-- upsert_roster_invitation: called only from the roster-invite edge function
-- via service-role auth. The function bypasses RLS to write into
-- roster_invitations, so it must NOT be callable by signed-in users.
REVOKE EXECUTE ON FUNCTION public.upsert_roster_invitation(uuid, uuid, text, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_roster_invitation(uuid, uuid, text, uuid, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_roster_invitation(uuid, uuid, text, uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.upsert_roster_invitation(uuid, uuid, text, uuid, jsonb) TO service_role;

-- vault_* wrappers: previously had REVOKE FROM PUBLIC + GRANT TO service_role,
-- but the linter still reports anon/authenticated can call them. Re-apply
-- explicit role-level revokes so default-grants are stripped.
REVOKE EXECUTE ON FUNCTION public.vault_read_secret(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.vault_read_secret(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.vault_read_secret(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vault_read_secret(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.vault_create_secret(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.vault_create_secret(text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.vault_create_secret(text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vault_create_secret(text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.vault_update_secret(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.vault_update_secret(uuid, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.vault_update_secret(uuid, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vault_update_secret(uuid, text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.vault_delete_secret(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.vault_delete_secret(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.vault_delete_secret(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vault_delete_secret(uuid) TO service_role;

-- =================================================================
-- 4. INTENTIONALLY PUBLIC - no change (documented here for the record)
-- =================================================================
--
-- These functions remain executable by both anon and authenticated. They
-- are either RLS policy helpers (which Postgres needs to be able to call
-- as the relevant role) or they back a public landing page. None of them
-- expose data the caller wasn't already allowed to see.
--
--   public.is_company_admin(uuid)
--   public.is_company_manager(uuid)
--   public.is_company_member(uuid)
--   public.is_team_member(uuid)
--   public.user_belongs_to_company(uuid)
--   public.get_my_user_id()
--   public.get_partner_companies()
--
-- If the Supabase linter continues to report these after this migration,
-- consider them "accepted findings" and add them to the linter exclusion
-- list in the dashboard.

-- =================================================================
-- 5. Self-check (read-only, returns rows for sanity)
-- =================================================================

-- After running, the linter rerun should show 0 ERRORs and only the
-- intentionally-public helpers as remaining warnings.
SELECT
  n.nspname  AS schema,
  p.proname  AS function,
  pg_get_function_arguments(p.oid) AS args,
  CASE WHEN has_function_privilege('anon',         p.oid, 'EXECUTE') THEN 'YES' ELSE 'no' END AS anon_can_exec,
  CASE WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'YES' ELSE 'no' END AS auth_can_exec,
  CASE WHEN has_function_privilege('service_role',  p.oid, 'EXECUTE') THEN 'YES' ELSE 'no' END AS srv_can_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND p.proname IN (
    'accept_roster_invitation','create_roster_member','create_company_with_owner',
    'join_company_by_code','convert_applicant_to_roster','update_member_role',
    'remove_company_member','next_incident_number','generate_recurring_tasks',
    'upsert_roster_invitation',
    'vault_read_secret','vault_create_secret','vault_update_secret','vault_delete_secret',
    'is_company_admin','is_company_manager','is_company_member','is_team_member',
    'user_belongs_to_company','get_my_user_id','get_partner_companies'
  )
ORDER BY function;
