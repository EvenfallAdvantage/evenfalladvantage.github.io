-- Least-privilege: revoke EXECUTE on SECURITY DEFINER functions that no
-- client, Edge Function, RLS policy, view, trigger, invoker function, column
-- default or cron job calls (Supabase advisor 0028/0029). NOT APPLIED: needs
-- owner approval. OverwatchDB nneueuvyeohwnspbwfub ONLY.
-- Rollback: rollback/20261022005147_revoke_unused_secdef_execute.rollback.sql
--
-- Caller map (2026-10-21, repo main 1c91fbb + live catalog):
--   get_vapid_public_key()          : no callers (push uses VAPID key from config) -> anon + authenticated revoked
--   is_team_member(uuid)            : no callers (policies use is_company_member)   -> authenticated revoked
--   next_incident_number(uuid)      : no callers                                     -> authenticated revoked
--   user_belongs_to_company(uuid)   : no callers                                     -> authenticated revoked
-- service_role keeps EXECUTE on all four. The other 50 advisor findings are
-- called by the app or RLS and are documented in docs/security/SECURITY_DEFINER_REVIEW.md.

BEGIN;
REVOKE EXECUTE ON FUNCTION public.get_vapid_public_key() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_incident_number(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_belongs_to_company(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vapid_public_key() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_incident_number(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_belongs_to_company(uuid) TO service_role;
COMMIT;
