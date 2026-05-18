-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SUPABASE LINTER WARNINGS — CLEANUP — May 16, 2026                ║
-- ║  Updated May 16, 2026 to actually revoke PUBLIC grants.           ║
-- ║                                                                   ║
-- ║  History: the first version of this migration only ran            ║
-- ║  `REVOKE EXECUTE ... FROM anon` (and `authenticated`). Those      ║
-- ║  revokes succeeded but had NO EFFECT, because Postgres grants     ║
-- ║  `EXECUTE` on new functions to `PUBLIC` by default. `anon` and    ║
-- ║  `authenticated` were inheriting EXECUTE through PUBLIC, not via  ║
-- ║  any direct grant — so revoking the direct grant changed nothing  ║
-- ║  and the linter warnings persisted.                               ║
-- ║                                                                   ║
-- ║  The correct pattern is:                                          ║
-- ║    REVOKE EXECUTE ON FUNCTION x() FROM PUBLIC;                    ║
-- ║    REVOKE EXECUTE ON FUNCTION x() FROM anon;          -- belt+susp║
-- ║    GRANT  EXECUTE ON FUNCTION x() TO authenticated;   -- if needed║
-- ║                                                                   ║
-- ║  Idempotent — safe to re-run.                                     ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── 1. Pin search_path on operation_maps_company_for_object ──────
CREATE OR REPLACE FUNCTION public.operation_maps_company_for_object(object_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT NULLIF(split_part(object_name, '/', 1), '')::uuid
$$;

-- ─── 2. Drop the file-enumeration policies on public buckets ──────
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
DROP POLICY IF EXISTS "Public company logo access" ON storage.objects;

-- ─── 3. Cron / trigger functions — no client should call them ────
-- api_request_log_cleanup: pg_cron only
-- cleanup_old_audit_logs: pg_cron only
-- site_map_bounds_touch_updated_at: trigger only
-- ensure_chat_member: defined but no app caller; presumed trigger use
--
-- REVOKE from PUBLIC kills the inherited grant; REVOKE from anon +
-- authenticated kills any explicit grants too. We do NOT grant back
-- to anyone — these functions only run from the table/cron context
-- where SECURITY DEFINER bypasses the EXECUTE check anyway.
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.api_request_log_cleanup()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.cleanup_old_audit_logs()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.site_map_bounds_touch_updated_at()
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.ensure_chat_member(uuid, uuid)
    FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ─── 4. Signup / join flow RPCs — authenticated only ─────────────
-- Called from app code AFTER supabase.auth.signUp() returns a session.
-- Verified by grepping every supabase.rpc() call site.
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.create_company_with_owner(
    text, text, text, text, text, text
  ) FROM PUBLIC, anon;
  GRANT  EXECUTE ON FUNCTION public.create_company_with_owner(
    text, text, text, text, text, text
  ) TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.join_company_by_code(
    text, text, text, text, text, text
  ) FROM PUBLIC, anon;
  GRANT  EXECUTE ON FUNCTION public.join_company_by_code(
    text, text, text, text, text, text
  ) TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ─── 5. Admin RPCs — authenticated only ──────────────────────────
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.convert_applicant_to_roster(uuid, uuid)
    FROM PUBLIC, anon;
  GRANT  EXECUTE ON FUNCTION public.convert_applicant_to_roster(uuid, uuid)
    TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.update_member_role(uuid, text)
    FROM PUBLIC, anon;
  GRANT  EXECUTE ON FUNCTION public.update_member_role(uuid, text)
    TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.remove_company_member(uuid)
    FROM PUBLIC, anon;
  GRANT  EXECUTE ON FUNCTION public.remove_company_member(uuid)
    TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ─── 6. RLS helper functions — authenticated only ────────────────
-- Called from inside RLS policy USING/CHECK clauses in authenticated
-- role context. Never needed by anon (anon has no rows visible
-- anyway, but explicit revocation is cleaner).
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.get_my_user_id()
    FROM PUBLIC, anon;
  GRANT  EXECUTE ON FUNCTION public.get_my_user_id()
    TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.is_company_admin(uuid)
    FROM PUBLIC, anon;
  GRANT  EXECUTE ON FUNCTION public.is_company_admin(uuid)
    TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid)
    FROM PUBLIC, anon;
  GRANT  EXECUTE ON FUNCTION public.is_company_member(uuid)
    TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.is_company_manager(uuid)
    FROM PUBLIC, anon;
  GRANT  EXECUTE ON FUNCTION public.is_company_manager(uuid)
    TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.user_belongs_to_company(uuid)
    FROM PUBLIC, anon;
  GRANT  EXECUTE ON FUNCTION public.user_belongs_to_company(uuid)
    TO authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ─── 7. Intentionally KEPT for anon: get_partner_companies ───────
-- The public landing page (src/app/page.tsx) renders partner logos
-- for unauthenticated visitors. Function returns only public marketing
-- data (company name, logo url, website url). We explicitly RE-GRANT
-- here to make the public access intentional (rather than inherited
-- via PUBLIC default) and document the audit decision.
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.get_partner_companies()
    FROM PUBLIC;
  GRANT  EXECUTE ON FUNCTION public.get_partner_companies()
    TO anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ─── 8. Verify ───────────────────────────────────────────────────
-- Expected linter state after this runs:
--   - All `anon_security_definer_function_executable` warnings: GONE
--     except for get_partner_companies (intentional, documented).
--   - `authenticated_security_definer_function_executable`: REDUCED
--     to ~10 — the RLS helpers, signup RPCs, and admin RPCs that
--     legitimately need authenticated EXECUTE. These are "review me"
--     prompts, not bugs.
--
-- To inspect the actual grants after running:
--   SELECT proname, proacl FROM pg_proc
--   WHERE pronamespace = 'public'::regnamespace
--     AND proname IN ('is_company_admin', 'get_my_user_id', /* ... */);
--
-- Manual dashboard step (not SQL):
--   Authentication → Policies → "Prevent use of leaked passwords"
--   Toggle ON to clear the auth_leaked_password_protection warning.
