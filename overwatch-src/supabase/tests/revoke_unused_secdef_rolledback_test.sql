-- Rolled-back check for 20261022005147 (statements inlined; nothing is committed).
BEGIN;
REVOKE EXECUTE ON FUNCTION public.get_vapid_public_key() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_incident_number(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_belongs_to_company(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vapid_public_key() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_incident_number(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_company(uuid) TO service_role;
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_x,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_x,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc_x
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('get_vapid_public_key','is_team_member','next_incident_number','user_belongs_to_company');
-- expect anon_x=f, auth_x=f, svc_x=t for all four
ROLLBACK;
