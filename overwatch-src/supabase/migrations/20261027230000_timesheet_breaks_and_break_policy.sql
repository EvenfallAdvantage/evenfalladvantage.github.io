-- 20261027230000_timesheet_breaks_and_break_policy
-- 1. Expand RLS on public.timesheet_breaks so supervisors (owner/admin/manager via
--    public.can_supervise_timesheet) can read, start, end, and delete breaks for
--    supervised staff (fixes 0 breaks shown in Personnel -> Timesheets, Payroll,
--    Overtime Report, Shift Detail Modal, and Mass Clock).
-- 2. Add public.set_company_break_policy(p_company_id, p_config) RPC (manager+)
--    paralleling public.set_company_overtime_config so HQ Config -> Break & Meal
--    Policy saves cleanly into companies.settings.break_policy.
-- 3. Add AFTER UPDATE OF clock_out trigger on public.timesheets to auto-close any
--    open break when a timesheet is clocked out (app, offline replay, QR, mass clock-out).
-- 4. Add AFTER INSERT/UPDATE/DELETE trigger on public.timesheet_breaks to keep
--    public.timesheets.break_minutes synced to the company's unpaid break minutes.
-- Rollback: rollback/20261027230000_timesheet_breaks_and_break_policy.rollback.sql

BEGIN;

-- ── 1. RLS Policies on public.timesheet_breaks ──────────────────────────────
DROP POLICY IF EXISTS breaks_select ON public.timesheet_breaks;
CREATE POLICY breaks_select ON public.timesheet_breaks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.timesheets t
      LEFT JOIN public.users u ON u.id = t.user_id
      WHERE t.id = timesheet_breaks.timesheet_id
        AND (
          u.supabase_id = (SELECT auth.uid())::text
          OR public.can_supervise_timesheet(t.user_id, t.company_id)
        )
    )
  );

DROP POLICY IF EXISTS breaks_insert ON public.timesheet_breaks;
CREATE POLICY breaks_insert ON public.timesheet_breaks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.timesheets t
      LEFT JOIN public.users u ON u.id = t.user_id
      WHERE t.id = timesheet_breaks.timesheet_id
        AND (
          u.supabase_id = (SELECT auth.uid())::text
          OR public.can_supervise_timesheet(t.user_id, t.company_id)
        )
    )
  );

DROP POLICY IF EXISTS breaks_update ON public.timesheet_breaks;
CREATE POLICY breaks_update ON public.timesheet_breaks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.timesheets t
      LEFT JOIN public.users u ON u.id = t.user_id
      WHERE t.id = timesheet_breaks.timesheet_id
        AND (
          u.supabase_id = (SELECT auth.uid())::text
          OR public.can_supervise_timesheet(t.user_id, t.company_id)
        )
    )
  );

DROP POLICY IF EXISTS breaks_delete ON public.timesheet_breaks;
CREATE POLICY breaks_delete ON public.timesheet_breaks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.timesheets t
      WHERE t.id = timesheet_breaks.timesheet_id
        AND public.can_supervise_timesheet(t.user_id, t.company_id)
    )
  );

-- ── 2. HQ Config RPC: public.set_company_break_policy ───────────────────────
CREATE OR REPLACE FUNCTION public.set_company_break_policy(p_company_id uuid, p_config jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_enabled boolean;
  v_meal_mins int;
  v_meal_paid boolean;
  v_first_meal numeric;
  v_second_meal numeric;
  v_rest_mins int;
  v_rest_paid boolean;
  v_max_rest int;
  v_first_rest numeric;
  v_second_rest numeric;
  v_third_rest numeric;
  v_clean jsonb;
BEGIN
  IF public.role_rank(public.my_company_role(p_company_id)) < 40 THEN
    RAISE EXCEPTION 'Only managers and above can change break policy rules' USING ERRCODE = '42501';
  END IF;
  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'Break policy config must be an object' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_enabled     := coalesce((p_config->>'breaksEnabled')::boolean, true);
    v_meal_mins   := coalesce((p_config->>'mealBreakMinutes')::int, 30);
    v_meal_paid   := coalesce((p_config->>'mealBreakPaid')::boolean, false);
    v_first_meal  := coalesce((p_config->>'firstMealAfterHours')::numeric, 5);
    v_second_meal := coalesce((p_config->>'secondMealAfterHours')::numeric, 10);
    v_rest_mins   := coalesce((p_config->>'restBreakMinutes')::int, 10);
    v_rest_paid   := coalesce((p_config->>'restBreakPaid')::boolean, true);
    v_max_rest    := coalesce((p_config->>'maxRestBreaksPerShift')::int, 3);
    v_first_rest  := coalesce((p_config->>'firstRestAfterHours')::numeric, 3.5);
    v_second_rest := coalesce((p_config->>'secondRestAfterHours')::numeric, 6);
    v_third_rest  := coalesce((p_config->>'thirdRestAfterHours')::numeric, 10);
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Break policy config has invalid values' USING ERRCODE = '22023';
  END;

  IF v_meal_mins < 5 OR v_meal_mins > 120
     OR v_rest_mins < 5 OR v_rest_mins > 60
     OR v_max_rest < 0 OR v_max_rest > 10
     OR v_first_meal < 0 OR v_first_meal > 24
     OR v_second_meal < 0 OR v_second_meal > 24
     OR v_first_rest < 0 OR v_first_rest > 24
     OR v_second_rest < 0 OR v_second_rest > 24
     OR v_third_rest < 0 OR v_third_rest > 24 THEN
    RAISE EXCEPTION 'Break policy config is out of range' USING ERRCODE = '22023';
  END IF;

  v_clean := jsonb_build_object(
    'breaksEnabled', v_enabled,
    'mealBreakMinutes', v_meal_mins,
    'mealBreakPaid', v_meal_paid,
    'firstMealAfterHours', v_first_meal,
    'secondMealAfterHours', v_second_meal,
    'restBreakMinutes', v_rest_mins,
    'restBreakPaid', v_rest_paid,
    'maxRestBreaksPerShift', v_max_rest,
    'firstRestAfterHours', v_first_rest,
    'secondRestAfterHours', v_second_rest,
    'thirdRestAfterHours', v_third_rest
  );

  UPDATE public.companies
     SET settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('break_policy', v_clean)
   WHERE id = p_company_id;

  RETURN v_clean;
END
$function$;

REVOKE ALL ON FUNCTION public.set_company_break_policy(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_company_break_policy(uuid, jsonb) TO authenticated, service_role;

-- ── 3. Auto-close open breaks on timesheet clock-out ────────────────────────
CREATE OR REPLACE FUNCTION public.close_open_breaks_on_clock_out()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_end_tz timestamptz;
BEGIN
  IF OLD.clock_out IS NULL AND NEW.clock_out IS NOT NULL THEN
    v_end_tz := (NEW.clock_out AT TIME ZONE 'UTC');
    UPDATE public.timesheet_breaks
       SET end_time = greatest(start_time, v_end_tz),
           duration_minutes = greatest(
             0,
             round(extract(epoch from (greatest(start_time, v_end_tz) - start_time)) / 60.0)::int
           ),
           updated_at = now()
     WHERE timesheet_id = NEW.id
       AND end_time IS NULL;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.close_open_breaks_on_clock_out() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_timesheets_close_open_breaks ON public.timesheets;
CREATE TRIGGER trg_timesheets_close_open_breaks
  AFTER UPDATE OF clock_out ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION public.close_open_breaks_on_clock_out();

-- ── 4. Sync timesheets.break_minutes from timesheet_breaks ──────────────────
CREATE OR REPLACE FUNCTION public.sync_timesheet_break_minutes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ts_id uuid := coalesce(NEW.timesheet_id, OLD.timesheet_id);
  v_company_id uuid;
  v_policy jsonb;
  v_meal_paid boolean := false;
  v_rest_paid boolean := true;
  v_unpaid_mins int := 0;
BEGIN
  IF v_ts_id IS NULL THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  SELECT t.company_id, c.settings->'break_policy'
    INTO v_company_id, v_policy
    FROM public.timesheets t
    LEFT JOIN public.companies c ON c.id = t.company_id
   WHERE t.id = v_ts_id;

  IF v_policy IS NOT NULL AND jsonb_typeof(v_policy) = 'object' THEN
    v_meal_paid := coalesce((v_policy->>'mealBreakPaid')::boolean, false);
    v_rest_paid := coalesce((v_policy->>'restBreakPaid')::boolean, true);
  END IF;

  SELECT coalesce(sum(coalesce(b.duration_minutes, 0)), 0)::int
    INTO v_unpaid_mins
    FROM public.timesheet_breaks b
   WHERE b.timesheet_id = v_ts_id
     AND b.end_time IS NOT NULL
     AND (
       (b.break_type = 'meal' AND NOT v_meal_paid)
       OR (b.break_type = 'rest' AND NOT v_rest_paid)
     );

  UPDATE public.timesheets
     SET break_minutes = v_unpaid_mins
   WHERE id = v_ts_id
     AND break_minutes IS DISTINCT FROM v_unpaid_mins;

  RETURN coalesce(NEW, OLD);
END
$function$;

REVOKE ALL ON FUNCTION public.sync_timesheet_break_minutes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_timesheet_breaks_sync_minutes ON public.timesheet_breaks;
CREATE TRIGGER trg_timesheet_breaks_sync_minutes
  AFTER INSERT OR UPDATE OR DELETE ON public.timesheet_breaks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_timesheet_break_minutes();

COMMIT;
