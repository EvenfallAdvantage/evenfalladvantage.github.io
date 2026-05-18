-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SUPABASE LINTER WARNINGS — NAKED REVOKE SCRIPT                   ║
-- ║                                                                   ║
-- ║  No DO blocks, no EXCEPTION handlers. Every statement runs        ║
-- ║  unwrapped so any error surfaces immediately in the SQL editor.   ║
-- ║                                                                   ║
-- ║  Use this if fix_supabase_linter_warnings.sql claims to succeed   ║
-- ║  but the linter still shows the warnings. The bare statements     ║
-- ║  here cannot silently skip — Postgres will raise on the first     ║
-- ║  problem (missing function signature, permission, etc.) and you   ║
-- ║  can fix it directly.                                             ║
-- ║                                                                   ║
-- ║  Idempotent: REVOKE on a role that has no grant is a no-op with   ║
-- ║  a NOTICE message, not an error.                                  ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── Cron / trigger functions: REVOKE from PUBLIC only ──────────
REVOKE EXECUTE ON FUNCTION public.api_request_log_cleanup()          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_audit_logs()           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.site_map_bounds_touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_chat_member(uuid, uuid)     FROM PUBLIC;

-- ─── Signup / join flow RPCs: REVOKE PUBLIC + GRANT authenticated ─
REVOKE EXECUTE ON FUNCTION public.create_company_with_owner(
  text, text, text, text, text, text
) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_company_with_owner(
  text, text, text, text, text, text
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.join_company_by_code(
  text, text, text, text, text, text
) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.join_company_by_code(
  text, text, text, text, text, text
) TO authenticated;

-- ─── Admin RPCs: REVOKE PUBLIC + GRANT authenticated ───────────
REVOKE EXECUTE ON FUNCTION public.convert_applicant_to_roster(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.convert_applicant_to_roster(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_member_role(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_member_role(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.remove_company_member(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.remove_company_member(uuid) TO authenticated;

-- ─── RLS helper functions: REVOKE PUBLIC + GRANT authenticated ─
REVOKE EXECUTE ON FUNCTION public.get_my_user_id()             FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_user_id()             TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_company_admin(uuid)       FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_company_admin(uuid)       TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid)      FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_company_member(uuid)      TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_company_manager(uuid)     FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_company_manager(uuid)     TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_belongs_to_company(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.user_belongs_to_company(uuid) TO authenticated;

-- ─── get_partner_companies: intentional public access ──────────
REVOKE EXECUTE ON FUNCTION public.get_partner_companies() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_partner_companies() TO anon, authenticated;

-- ─── Verify ────────────────────────────────────────────────────
-- Run this after the above to confirm. None of the rows should
-- show `=X/postgres` (the leading empty role = PUBLIC).
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  array_to_string(p.proacl::text[], E', ') AS access_control_list
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'api_request_log_cleanup', 'cleanup_old_audit_logs', 
    'site_map_bounds_touch_updated_at', 'ensure_chat_member',
    'create_company_with_owner', 'join_company_by_code',
    'convert_applicant_to_roster', 'update_member_role', 
    'remove_company_member', 'get_my_user_id',
    'is_company_admin', 'is_company_member', 
    'is_company_manager', 'user_belongs_to_company',
    'get_partner_companies'
  )
ORDER BY p.proname;
