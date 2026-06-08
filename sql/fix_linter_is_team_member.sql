-- ============================================================================
-- OVERWATCH - Follow-up: revoke anon execute on is_team_member
--
-- The first remediation pass (fix_linter_security_definer_findings.sql) left
-- public.is_team_member callable by anon because its original creation in
-- add-teams-system.sql used REVOKE ... FROM PUBLIC instead of explicit
-- per-role revokes, and Postgres had auto-granted EXECUTE to anon at CREATE
-- time.
--
-- Reviewed call sites: is_team_member is only referenced inside RLS
-- policies that gate authenticated tables. No anonymous code path needs it.
-- Locking it down to authenticated + service_role.
--
-- Idempotent.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_team_member(uuid) TO service_role;

-- Self-check
SELECT
  p.proname  AS function,
  CASE WHEN has_function_privilege('anon',         p.oid, 'EXECUTE') THEN 'YES' ELSE 'no' END AS anon_can_exec,
  CASE WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'YES' ELSE 'no' END AS auth_can_exec,
  CASE WHEN has_function_privilege('service_role',  p.oid, 'EXECUTE') THEN 'YES' ELSE 'no' END AS srv_can_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'is_team_member';
