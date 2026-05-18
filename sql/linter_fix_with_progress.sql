-- Diagnostic + remediation script.
-- Each REVOKE/GRANT is followed by a RAISE NOTICE so we can see in the
-- output exactly how far execution reached before stopping.
-- If only a subset of NOTICEs print, the failed statement is the one
-- immediately AFTER the last printed NOTICE.

DO $$
BEGIN
  -- ── Cron / trigger functions: REVOKE PUBLIC only ──
  REVOKE EXECUTE ON FUNCTION public.api_request_log_cleanup() FROM PUBLIC;
  RAISE NOTICE '1. revoked api_request_log_cleanup';

  REVOKE EXECUTE ON FUNCTION public.cleanup_old_audit_logs() FROM PUBLIC;
  RAISE NOTICE '2. revoked cleanup_old_audit_logs';

  REVOKE EXECUTE ON FUNCTION public.site_map_bounds_touch_updated_at() FROM PUBLIC;
  RAISE NOTICE '3. revoked site_map_bounds_touch_updated_at';

  REVOKE EXECUTE ON FUNCTION public.ensure_chat_member(uuid, uuid) FROM PUBLIC;
  RAISE NOTICE '4. revoked ensure_chat_member';

  -- ── Signup / join RPCs: REVOKE PUBLIC + GRANT authenticated ──
  REVOKE EXECUTE ON FUNCTION public.create_company_with_owner(
    text, text, text, text, text, text
  ) FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.create_company_with_owner(
    text, text, text, text, text, text
  ) TO authenticated;
  RAISE NOTICE '5. revoked+granted create_company_with_owner';

  REVOKE EXECUTE ON FUNCTION public.join_company_by_code(
    text, text, text, text, text, text
  ) FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.join_company_by_code(
    text, text, text, text, text, text
  ) TO authenticated;
  RAISE NOTICE '6. revoked+granted join_company_by_code';

  -- ── Admin RPCs ──
  REVOKE EXECUTE ON FUNCTION public.convert_applicant_to_roster(uuid, uuid) FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.convert_applicant_to_roster(uuid, uuid) TO authenticated;
  RAISE NOTICE '7. revoked+granted convert_applicant_to_roster';

  REVOKE EXECUTE ON FUNCTION public.update_member_role(uuid, text) FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.update_member_role(uuid, text) TO authenticated;
  RAISE NOTICE '8. revoked+granted update_member_role';

  REVOKE EXECUTE ON FUNCTION public.remove_company_member(uuid) FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.remove_company_member(uuid) TO authenticated;
  RAISE NOTICE '9. revoked+granted remove_company_member';

  -- ── RLS helpers ──
  REVOKE EXECUTE ON FUNCTION public.get_my_user_id() FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.get_my_user_id() TO authenticated;
  RAISE NOTICE '10. revoked+granted get_my_user_id';

  REVOKE EXECUTE ON FUNCTION public.is_company_admin(uuid) FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated;
  RAISE NOTICE '11. revoked+granted is_company_admin';

  REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid) FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;
  RAISE NOTICE '12. revoked+granted is_company_member';

  REVOKE EXECUTE ON FUNCTION public.is_company_manager(uuid) FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.is_company_manager(uuid) TO authenticated;
  RAISE NOTICE '13. revoked+granted is_company_manager';

  REVOKE EXECUTE ON FUNCTION public.user_belongs_to_company(uuid) FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.user_belongs_to_company(uuid) TO authenticated;
  RAISE NOTICE '14. revoked+granted user_belongs_to_company';

  -- ── Intentional public access ──
  REVOKE EXECUTE ON FUNCTION public.get_partner_companies() FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.get_partner_companies() TO anon, authenticated;
  RAISE NOTICE '15. revoked+granted get_partner_companies';

  RAISE NOTICE 'DONE — all 15 functions locked down.';
END $$;
