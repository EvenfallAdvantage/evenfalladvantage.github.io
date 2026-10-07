-- =============================================================================
-- 20261007180000_time_off_policies_paid_rls.sql
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY.
-- Status: NOT APPLIED (draft, PR "HQ Config C"). Apply by hand after review.
--         Rename the file to the real apply timestamp when applied.
-- Rollback: supabase/migrations/rollback/20261007180000_time_off_policies_paid_rls.rollback.sql
--
-- Live state read 2026-10-07 (read-only):
--   columns: id, company_id, name, type, accrual_rate, accrual_period,
--            max_balance, created_at   (1 row total)
--   time_off_policies_select  SELECT TO authenticated USING (true)            <- cross-tenant read
--   time_off_policies_update  UPDATE TO authenticated USING (is_company_member(company_id))
--                                                     WITH CHECK (none)      <- any staff can edit,
--                                                                               and could move a row
--                                                                               to another company
--   time_off_policies_insert  INSERT WITH CHECK (is_company_admin(company_id))
--   time_off_policies_delete  DELETE USING (is_company_admin(company_id))
--
-- Change:
--   1. Add is_paid boolean NOT NULL DEFAULT true (existing 'unpaid' type rows -> false).
--   2. UPDATE: company admins/managers only (same as insert/delete), with WITH CHECK.
--   3. SELECT: members of the company only (staff still see their own company's
--      policies for the request form; admins see them for approvals).
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.time_off_policies') IS NULL
     OR to_regprocedure('public.is_company_admin(uuid)') IS NULL
     OR to_regprocedure('public.is_company_member(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: this migration is for OverwatchDB (nneueuvyeohwnspbwfub)';
  END IF;
END
$guard$;

ALTER TABLE public.time_off_policies
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT true;

UPDATE public.time_off_policies SET is_paid = false WHERE type = 'unpaid';

DROP POLICY IF EXISTS time_off_policies_update ON public.time_off_policies;
CREATE POLICY time_off_policies_update ON public.time_off_policies
  FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

DROP POLICY IF EXISTS time_off_policies_select ON public.time_off_policies;
CREATE POLICY time_off_policies_select ON public.time_off_policies
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

COMMIT;

-- Verify after apply:
--   select policyname, cmd, qual, with_check from pg_policies where tablename = 'time_off_policies';
--   select column_name, data_type, column_default from information_schema.columns
--     where table_name = 'time_off_policies' and column_name = 'is_paid';
