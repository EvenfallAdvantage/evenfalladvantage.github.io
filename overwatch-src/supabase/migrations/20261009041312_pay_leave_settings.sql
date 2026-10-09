-- =============================================================================
-- 20261009041312_pay_leave_settings.sql
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY.
-- Status: APPLIED to OverwatchDB 2026-10-08 9:13 PM PT (version 20261009041312, PR #61).
--         Applied via apply_migration "pay_leave_settings" (same statements, no explicit BEGIN/COMMIT).
-- Rollback: supabase/migrations/rollback/20261009041312_pay_leave_settings.rollback.sql
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
--   4. Pay & overtime settings for MANAGERS and above (user decision
--      2026-10-07; owners > admins > managers, instructor ranks above manager).
--      companies UPDATE stays owner/admin (it covers name, branding, join
--      code...), so managers get two narrow SECURITY DEFINER RPCs instead:
--        set_company_default_rates(company, pay, bill)
--        set_company_overtime_config(company, config jsonb)
--      Both require role_rank(my_company_role(company)) >= 40, validate
--      input, and only touch default_pay_rate / default_bill_rate /
--      settings.overtime_config. Depends on 20261006175319_rls_hardening
--      (role_rank, my_company_role).
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.time_off_policies') IS NULL
     OR to_regprocedure('public.is_company_admin(uuid)') IS NULL
     OR to_regprocedure('public.is_company_member(uuid)') IS NULL
     OR to_regprocedure('public.my_company_role(uuid)') IS NULL
     OR to_regprocedure('public.role_rank(text)') IS NULL THEN
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

-- ── 4. Pay & overtime settings RPCs (manager+) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.set_company_default_rates(
  p_company_id uuid,
  p_pay_rate numeric,
  p_bill_rate numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF public.role_rank(public.my_company_role(p_company_id)) < 40 THEN
    RAISE EXCEPTION 'Only managers and above can change pay settings' USING ERRCODE = '42501';
  END IF;
  IF (p_pay_rate IS NOT NULL AND (p_pay_rate < 0 OR p_pay_rate > 99999.99))
     OR (p_bill_rate IS NOT NULL AND (p_bill_rate < 0 OR p_bill_rate > 99999.99)) THEN
    RAISE EXCEPTION 'Rates must be between 0 and 99999.99' USING ERRCODE = '22023';
  END IF;
  UPDATE public.companies
     SET default_pay_rate = round(p_pay_rate, 2),
         default_bill_rate = round(p_bill_rate, 2)
   WHERE id = p_company_id;
END
$fn$;

CREATE OR REPLACE FUNCTION public.set_company_overtime_config(
  p_company_id uuid,
  p_config jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_weekly numeric;
  v_daily numeric;
  v_dt numeric;
  v_start int;
  v_seventh boolean;
  v_clean jsonb;
BEGIN
  IF public.role_rank(public.my_company_role(p_company_id)) < 40 THEN
    RAISE EXCEPTION 'Only managers and above can change overtime rules' USING ERRCODE = '42501';
  END IF;
  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'Overtime config must be an object' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_weekly  := coalesce((p_config->>'weeklyThreshold')::numeric, 40);
    v_daily   := coalesce((p_config->>'dailyThreshold')::numeric, 0);
    v_dt      := coalesce((p_config->>'doubletimeThreshold')::numeric, 0);
    v_start   := coalesce((p_config->>'weekStartDay')::int, 0);
    v_seventh := coalesce((p_config->>'seventhDayRule')::boolean, false);
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Overtime config has invalid values' USING ERRCODE = '22023';
  END;

  IF v_weekly < 0 OR v_weekly > 168 OR v_daily < 0 OR v_daily > 24 OR v_dt < 0 OR v_dt > 24
     OR v_start < 0 OR v_start > 6
     OR (v_dt > 0 AND v_daily > 0 AND v_dt <= v_daily) THEN
    RAISE EXCEPTION 'Overtime config is out of range' USING ERRCODE = '22023';
  END IF;

  -- Store only the known keys (nothing else can be smuggled into settings).
  v_clean := jsonb_build_object(
    'weeklyThreshold', v_weekly,
    'dailyThreshold', v_daily,
    'doubletimeThreshold', v_dt,
    'weekStartDay', v_start,
    'seventhDayRule', v_seventh
  );

  UPDATE public.companies
     SET settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('overtime_config', v_clean)
   WHERE id = p_company_id;
  RETURN v_clean;
END
$fn$;

REVOKE ALL ON FUNCTION public.set_company_default_rates(uuid, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_company_overtime_config(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_company_default_rates(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_overtime_config(uuid, jsonb) TO authenticated;

COMMIT;

-- Verify after apply:
--   select policyname, cmd, qual, with_check from pg_policies where tablename = 'time_off_policies';
--   select column_name, data_type, column_default from information_schema.columns
--     where table_name = 'time_off_policies' and column_name = 'is_paid';
--   In a rolled-back transaction, as a manager / a lead of a test company:
--     select public.set_company_overtime_config('<company>', '{"weeklyThreshold":40,"dailyThreshold":8,"doubletimeThreshold":12,"weekStartDay":0,"seventhDayRule":true}');
--       manager -> returns the cleaned config; lead -> 42501
--     select public.set_company_default_rates('<company>', 22.5, 35);   manager ok, lead 42501
--     select public.set_company_overtime_config('<company>', '{"dailyThreshold":10,"doubletimeThreshold":8}');  -> 22023
