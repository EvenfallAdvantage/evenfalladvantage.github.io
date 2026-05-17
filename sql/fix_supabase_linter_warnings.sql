-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SUPABASE LINTER WARNINGS — CLEANUP — May 16, 2026                ║
-- ║                                                                   ║
-- ║  Addresses the warnings raised by the Supabase Database Linter:   ║
-- ║                                                                   ║
-- ║  1. function_search_path_mutable                                  ║
-- ║     - operation_maps_company_for_object had no SET search_path.   ║
-- ║                                                                   ║
-- ║  2. public_bucket_allows_listing                                  ║
-- ║     - avatars + company-logos had broad SELECT policies that      ║
-- ║       allowed any client to LIST every file in the bucket.        ║
-- ║       Public URLs work without these policies (bucket.public=true ║
-- ║       serves via CDN that bypasses RLS); drop them.               ║
-- ║                                                                   ║
-- ║  3/4. anon_security_definer_function_executable                   ║
-- ║       authenticated_security_definer_function_executable          ║
-- ║                                                                   ║
-- ║     Two patterns:                                                 ║
-- ║       a) trigger / cron functions that should not be callable     ║
-- ║          by any client role — revoke from anon + authenticated.   ║
-- ║       b) admin RPCs and RLS helpers that only authenticated       ║
-- ║          users should call — revoke from anon only.               ║
-- ║                                                                   ║
-- ║     Only get_partner_companies legitimately remains callable      ║
-- ║     by anon (used by the public landing page for unauthenticated  ║
-- ║     visitors).                                                    ║
-- ║                                                                   ║
-- ║  Verified (May 16, 2026) by grepping every supabase.rpc() call    ║
-- ║  in overwatch-src/src — see commit message of this migration.     ║
-- ║                                                                   ║
-- ║  Idempotent — safe to re-run.                                     ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── 1. Pin search_path on operation_maps_company_for_object ──────
-- Added in sql/add_site_map_bounds.sql; was missing the SET clause.
CREATE OR REPLACE FUNCTION public.operation_maps_company_for_object(object_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT NULLIF(split_part(object_name, '/', 1), '')::uuid
$$;

-- ─── 2. Drop the file-enumeration policies on public buckets ──────
-- Public URLs (getPublicUrl()) work via Supabase's CDN endpoint when
-- the bucket has `public = true`, which BYPASSES RLS entirely. So the
-- broad "FOR SELECT TO public" policies on storage.objects are dead
-- weight that only enables enumeration via /storage/v1/object/list.
-- Verified no .list() calls in the app codebase before removing.
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
DROP POLICY IF EXISTS "Public company logo access" ON storage.objects;

-- ─── 3. Revoke EXECUTE on cron / trigger functions ────────────────
-- These should never be callable by any client. They run from pg_cron
-- (api_request_log_cleanup, cleanup_old_audit_logs) or as a trigger
-- (site_map_bounds_touch_updated_at). Calling them via /rest/v1/rpc/
-- accomplishes nothing useful and clutters the API surface.
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.api_request_log_cleanup()
    FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.cleanup_old_audit_logs()
    FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.site_map_bounds_touch_updated_at()
    FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ensure_chat_member: defined but has no caller in the app. If it's
-- used by a trigger, the trigger continues to work because SECURITY
-- DEFINER functions run regardless of who can call them via the API.
-- Two known overloads:
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.ensure_chat_member(uuid, uuid)
    FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ─── 4. Revoke EXECUTE from anon on authenticated-only RPCs ───────
-- These are all called from the app AFTER an auth session exists
-- (signup flows go through supabase.auth.signUp() first, which
-- synchronously returns a session; the RPC fires next).

-- 4a. Signup / join flows — require authenticated.
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.create_company_with_owner(
    text, text, text, text, text, text
  ) FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.join_company_by_code(
    text, text, text, text, text, text
  ) FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 4b. Admin RPCs.
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.convert_applicant_to_roster(uuid, uuid)
    FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.update_member_role(uuid, text)
    FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.remove_company_member(uuid)
    FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- 4c. RLS helper functions — called from inside policies in the
-- authenticated role context. Anon should never reach them.
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.get_my_user_id()
    FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.is_company_admin(uuid)
    FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid)
    FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.is_company_manager(uuid)
    FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.user_belongs_to_company(uuid)
    FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- ─── 5. Intentionally NOT touched ─────────────────────────────────
-- get_partner_companies: must remain callable by anon for the public
-- landing page (src/app/page.tsx renders partner logos for visitors
-- who are not signed in).
--
-- get_partner_companies will still appear in the linter as a
-- "Public Can Execute SECURITY DEFINER Function" warning. That is
-- intentional and accurate — it IS publicly executable. The linter is
-- a "review me" prompt, not a bug indicator. We've reviewed it and
-- the function returns only public marketing data (company name,
-- logo url, website url), which is safe to expose.

-- ─── 6. Verify ───────────────────────────────────────────────────
-- After running, the linter should show a much shorter list. The
-- expected remaining warnings:
--   - get_partner_companies (intentional anon access)
--   - several functions still flagged as "Signed-In Users Can Execute
--     SECURITY DEFINER" — these are the RLS helpers + signup RPCs
--     + admin RPCs that legitimately need authenticated EXECUTE.
--
-- Manual dashboard step (not SQL):
--   Authentication → Policies → "Prevent use of leaked passwords"
--   Toggle ON to clear the auth_leaked_password_protection warning.
