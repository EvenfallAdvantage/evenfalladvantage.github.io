-- =============================================================================
-- ROLLBACK for 20261009041312_pay_leave_settings.sql
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY. Run by hand.
-- Restores the policies as read from pg_policies on 2026-10-07.
-- NOTE: re-opens cross-tenant read and member-level edits of leave policies.
-- Dropping is_paid loses any paid/unpaid choices saved since the migration.
-- The app only sends is_paid when it's set, and older code ignores it, so you
-- can leave the column in place (comment out the DROP COLUMN) to keep data.
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.time_off_policies') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: this rollback is for OverwatchDB (nneueuvyeohwnspbwfub)';
  END IF;
END
$guard$;

DROP POLICY IF EXISTS time_off_policies_update ON public.time_off_policies;
CREATE POLICY time_off_policies_update ON public.time_off_policies
  FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS time_off_policies_select ON public.time_off_policies;
CREATE POLICY time_off_policies_select ON public.time_off_policies
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.time_off_policies DROP COLUMN IF EXISTS is_paid;

-- Managers lose pay/overtime editing (the app falls back to direct updates,
-- which companies RLS limits to owner/admin). Saved values are kept.
DROP FUNCTION IF EXISTS public.set_company_default_rates(uuid, numeric, numeric);
DROP FUNCTION IF EXISTS public.set_company_overtime_config(uuid, jsonb);

COMMIT;
