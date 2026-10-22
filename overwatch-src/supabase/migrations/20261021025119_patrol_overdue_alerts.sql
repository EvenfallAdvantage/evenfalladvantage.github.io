-- NEXT_TEN #2: missed / overdue patrol alerts (in-app notifications).
-- NOT APPLIED. Needs owner approval to go live.
--
-- Every 10 minutes, for each active patrol route with frequency_min > 0 in a
-- company that has someone clocked in:
--   overdue = no scan on the route for frequency_min + 10 min grace, and the
--             earliest open clock-in is older than that (they had a chance).
-- Who is told: the officers on duty in that company, plus owners/admins/
-- managers/leads. At most one alert per route per person per frequency window.
-- The body lists how many of the route's checkpoints were not scanned in
-- the last window.

CREATE OR REPLACE FUNCTION public.patrol_overdue_alerts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer := 0;
  v_n integer;
  r record;
  v_window interval;
  v_last timestamptz;
  v_first_in timestamptz;
  v_missed integer;
  v_title text;
  v_body text;
BEGIN
  FOR r IN
    SELECT pr.id, pr.company_id, pr.name, pr.frequency_min, pr.checkpoint_ids
    FROM patrol_routes pr
    WHERE pr.is_active IS TRUE AND coalesce(pr.frequency_min, 0) > 0
  LOOP
    v_window := make_interval(mins => r.frequency_min + 10);

    SELECT min(t.clock_in AT TIME ZONE 'UTC') INTO v_first_in
    FROM timesheets t
    WHERE t.company_id = r.company_id AND t.clock_out IS NULL
      AND t.clock_in > (now() AT TIME ZONE 'UTC') - interval '16 hours';
    CONTINUE WHEN v_first_in IS NULL OR v_first_in > now() - v_window;

    SELECT max(pl.scanned_at) INTO v_last FROM patrol_logs pl WHERE pl.route_id = r.id;
    CONTINUE WHEN v_last IS NOT NULL AND v_last > now() - v_window;

    SELECT count(*) INTO v_missed
    FROM unnest(coalesce(r.checkpoint_ids, '{}'::uuid[])) AS cp(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM patrol_logs pl
      WHERE pl.route_id = r.id AND pl.checkpoint_id = cp.id
        AND pl.scanned_at > now() - make_interval(mins => r.frequency_min)
    );

    v_title := format('Patrol overdue: %s', left(coalesce(r.name, 'Route'), 120));
    v_body := CASE WHEN v_last IS NULL THEN 'No rounds logged this shift.'
                   ELSE format('Last scan %s min ago (every %s min expected).',
                               floor(extract(epoch FROM now() - v_last) / 60)::int, r.frequency_min) END
              || CASE WHEN v_missed > 0 THEN format(' %s checkpoint%s missed.', v_missed, CASE WHEN v_missed = 1 THEN '' ELSE 's' END) ELSE '' END;

    INSERT INTO notifications (id, user_id, company_id, title, body, type, read, action_url, created_at)
    SELECT gen_random_uuid(), x.user_id, r.company_id, v_title, v_body, 'patrol_overdue', false, '/patrols', now() AT TIME ZONE 'UTC'
    FROM (
      SELECT DISTINCT t.user_id FROM timesheets t
      WHERE t.company_id = r.company_id AND t.clock_out IS NULL
        AND t.clock_in > (now() AT TIME ZONE 'UTC') - interval '16 hours'
      UNION
      SELECT cm.user_id FROM company_memberships cm
      WHERE cm.company_id = r.company_id AND cm.status = 'active'
        AND cm.role::text IN ('owner', 'admin', 'manager', 'lead')
    ) x
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = x.user_id AND n.company_id = r.company_id
        AND n.type = 'patrol_overdue' AND n.title = v_title
        AND n.created_at > (now() AT TIME ZONE 'UTC') - make_interval(mins => r.frequency_min)
    );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.patrol_overdue_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patrol_overdue_alerts() TO service_role;

SELECT cron.schedule(
  'patrol-overdue-alerts',
  '*/10 * * * *',
  $job$ SELECT public.patrol_overdue_alerts(); $job$
);
