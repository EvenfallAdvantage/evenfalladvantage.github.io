-- Rollback for 20261021200000_revoke_unused_secdef_execute.sql: restores the
-- exact pre-migration ACLs captured 2026-10-21.
BEGIN;
GRANT EXECUTE ON FUNCTION public.get_vapid_public_key() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_incident_number(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_company(uuid) TO authenticated, service_role;
COMMIT;
