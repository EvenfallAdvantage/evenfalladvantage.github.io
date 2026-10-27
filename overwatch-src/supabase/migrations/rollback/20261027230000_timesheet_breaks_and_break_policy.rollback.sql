-- Rollback for 20261027230000_timesheet_breaks_and_break_policy
BEGIN;

DROP TRIGGER IF EXISTS trg_timesheet_breaks_sync_minutes ON public.timesheet_breaks;
DROP FUNCTION IF EXISTS public.sync_timesheet_break_minutes();

DROP TRIGGER IF EXISTS trg_timesheets_close_open_breaks ON public.timesheets;
DROP FUNCTION IF EXISTS public.close_open_breaks_on_clock_out();

DROP FUNCTION IF EXISTS public.set_company_break_policy(uuid, jsonb);

DROP POLICY IF EXISTS breaks_delete ON public.timesheet_breaks;

DROP POLICY IF EXISTS breaks_update ON public.timesheet_breaks;
CREATE POLICY breaks_update ON public.timesheet_breaks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.timesheets t
      JOIN public.users u ON u.id = t.user_id
      WHERE t.id = timesheet_breaks.timesheet_id
        AND u.supabase_id = ((SELECT (SELECT auth.uid() AS uid) AS uid))::text
    )
  );

DROP POLICY IF EXISTS breaks_insert ON public.timesheet_breaks;
CREATE POLICY breaks_insert ON public.timesheet_breaks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.timesheets t
      JOIN public.users u ON u.id = t.user_id
      WHERE t.id = timesheet_breaks.timesheet_id
        AND u.supabase_id = ((SELECT (SELECT auth.uid() AS uid) AS uid))::text
    )
  );

DROP POLICY IF EXISTS breaks_select ON public.timesheet_breaks;
CREATE POLICY breaks_select ON public.timesheet_breaks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.timesheets t
      JOIN public.users u ON u.id = t.user_id
      WHERE t.id = timesheet_breaks.timesheet_id
        AND u.supabase_id = ((SELECT (SELECT auth.uid() AS uid) AS uid))::text
    )
  );

COMMIT;
