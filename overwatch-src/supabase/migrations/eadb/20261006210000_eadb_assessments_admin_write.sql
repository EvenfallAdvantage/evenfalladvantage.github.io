-- =============================================================================
-- 20261006210000_eadb_assessments_admin_write.sql
-- Target: LEGACY EADB (project vaagvairvwmgyzsmymhs) ONLY. Not OverwatchDB.
-- Kept in migrations/eadb/ so `supabase db push` for overwatch-src never
-- picks it up. Status: APPLIED on EADB (vaagvairvwmgyzsmymhs) as version 20261006211319 on 2026-10-06 ~14:13 PT.
-- Rollback: migrations/rollback/20261006210000_eadb_assessments_admin_write.rollback.sql
--
-- Problem: public.assessments has write policies for `anon` only
-- (anon_insert_assessments, anon_update_assessments). The static admin portal
-- signs in to EADB, so its writes run as `authenticated`, and there is no
-- authenticated INSERT/UPDATE/DELETE policy at all:
--   * admin/js/assessment-editor.js   UPDATE questions_json, total_questions,
--                                     updated_at  -> 0 rows, silently (the
--                                     editor still says "saved")
--   * admin/js/course-editor.js       INSERT a module's assessment -> 42501
--                                     UPDATE assessment_name/category/icon -> 0 rows
--   * admin/js/ai-question-generator-free.js  UPDATE total_questions -> 0 rows
--
-- Fix: let EADB admins write assessments, using the same admin test as every
-- other "Admins can ..." policy on EADB (a row in public.administrators with
-- user_id = auth.uid()). Nobody else gets write access:
--   * anon: unchanged here. Its two write policies are removed by the pending
--     20261006120500_eadb_remove_anon_writes.sql. This file doesn't touch them,
--     so the two migrations can be applied in either order.
--   * instructors / students: no write access. EADB courses and modules have no
--     owner column, so there is no "own course" to scope an instructor policy
--     to; the static instructor portal never writes assessments; Overwatch
--     Instructor HQ writes assessments through the legacy-bridge-write edge
--     function (service role, bypasses RLS) after checking the Overwatch role.
--   * service_role: unaffected (bypasses RLS).
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.module_slides') IS NULL
     OR to_regclass('public.administrators') IS NULL
     OR to_regclass('public.company_memberships') IS NOT NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for the legacy EADB (vaagvairvwmgyzsmymhs)';
  END IF;
END
$guard$;

DROP POLICY IF EXISTS "Admins can insert assessments" ON public.assessments;
DROP POLICY IF EXISTS "Admins can update assessments" ON public.assessments;
DROP POLICY IF EXISTS "Admins can delete assessments" ON public.assessments;

CREATE POLICY "Admins can insert assessments" ON public.assessments
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.administrators a WHERE a.user_id = (SELECT auth.uid())));

CREATE POLICY "Admins can update assessments" ON public.assessments
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.administrators a WHERE a.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.administrators a WHERE a.user_id = (SELECT auth.uid())));

CREATE POLICY "Admins can delete assessments" ON public.assessments
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.administrators a WHERE a.user_id = (SELECT auth.uid())));

-- authenticated already has INSERT/UPDATE/DELETE grants on the table (live,
-- 2026-10-06); RLS above is what limits them to admins. Grants are left as is.

COMMIT;
