-- Rollback for 20261021195742_alert_delivery_mutes_escalation.
-- Restores the guard-card / patrol functions exactly as in 20261021024711 and
-- 20261021025119 (in-app only, patrol cron every 10 min), then drops the new objects.
-- Rows already written with type guard_card / patrol_overdue_escalation stay (harmless history).

CREATE OR REPLACE FUNCTION public.guard_card_expiry_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer := 0;
  r record;
  v_days integer;
  v_title text;
BEGIN
  FOR r IN
    SELECT cm.user_id, cm.company_id, cm.guard_card_expiry::date AS exp
    FROM company_memberships cm
    WHERE cm.guard_card_expiry IS NOT NULL
      AND cm.status = 'active'
      AND cm.role::text <> 'client'
      AND cm.guard_card_expiry::date - current_date IN (30, 7, 1, 0)
  LOOP
    v_days := r.exp - current_date;
    v_title := CASE WHEN v_days = 0 THEN 'Your guard card expires today'
                    ELSE format('Your guard card expires in %s day%s', v_days, CASE WHEN v_days = 1 THEN '' ELSE 's' END) END;
    IF NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = r.user_id AND n.company_id = r.company_id AND n.title = v_title
        AND n.created_at::date = current_date
    ) THEN
      INSERT INTO notifications (id, user_id, company_id, title, body, type, read, action_url, created_at)
      VALUES (gen_random_uuid(), r.user_id, r.company_id, v_title,
              'Renew it before it lapses. You can''t be scheduled on post with an expired card.',
              'compliance', false, '/profile', now());
      v_count := v_count + 1;
    END IF;

    IF v_days = 0 THEN
      INSERT INTO notifications (id, user_id, company_id, title, body, type, read, action_url, created_at)
      SELECT gen_random_uuid(), sup.user_id, r.company_id, 'A guard card expires today',
             'One of your officers has a guard card expiring today. Check Personnel before scheduling them.',
             'compliance', false, '/admin/staff', now()
      FROM company_memberships sup
      WHERE sup.company_id = r.company_id AND sup.status = 'active'
        AND sup.role::text IN ('owner', 'admin', 'manager')
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.user_id = sup.user_id AND n.company_id = r.company_id
            AND n.title = 'A guard card expires today' AND n.created_at::date = current_date
        );
      GET DIAGNOSTICS v_days = ROW_COUNT;
      v_count := v_count + v_days;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_card_expiry_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_card_expiry_reminders() TO service_role;

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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'patrol-overdue-alerts') THEN
    PERFORM cron.unschedule('patrol-overdue-alerts');
  END IF;
END $$;
SELECT cron.schedule('patrol-overdue-alerts', '*/10 * * * *', $job$ SELECT public.patrol_overdue_alerts(); $job$);

DROP FUNCTION IF EXISTS public.kick_notify_system();
DROP FUNCTION IF EXISTS public.claim_system_notifications(integer);
DROP INDEX IF EXISTS public.notifications_system_undelivered_idx;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS delivered_at;
DROP TABLE IF EXISTS public.notification_mutes;
