-- Field decisions (#143 / #144 / #145). NOT APPLIED: needs owner approval.
-- OverwatchDB nneueuvyeohwnspbwfub ONLY. Rollback: rollback/20261021195742_alert_delivery_mutes_escalation.rollback.sql
--
-- 1. notification_mutes: per-officer list of muted alert categories
--    (dm, swap, task, schedule, guard_card). Mutes only stop phone push /
--    email / SMS; the in-app notification is still created. Safety alerts
--    (SOS, patrol overdue) are not mutable: enforced here AND in notify-send.
-- 2. notifications.delivered_at + claim_system_notifications(): the
--    notify-system Edge Function claims undelivered cron alerts atomically
--    and delivers them by push (+ email for guard cards).
-- 3. kick_notify_system(): pg_net call to notify-system using the existing
--    Vault secret 'integrations_cron_secret' (header x-integrations-cron-secret).
-- 4. guard_card_expiry_reminders(): type 'guard_card' (was 'compliance'), then kick.
-- 5. patrol_overdue_alerts(): 10-min grace; officers on duty first; if still
--    overdue 5 min after the officer alert, escalate to owners/admins/managers/leads.
--    Cron moves from every 10 min to every 5 min so escalation lands on time.

-- 1. Mutes ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_mutes (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  muted_types text[] NOT NULL DEFAULT '{}'
    CHECK (muted_types <@ ARRAY['dm','swap','task','schedule','guard_card']::text[]),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_mutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_mutes_own_select ON public.notification_mutes;
DROP POLICY IF EXISTS notification_mutes_own_insert ON public.notification_mutes;
DROP POLICY IF EXISTS notification_mutes_own_update ON public.notification_mutes;
DROP POLICY IF EXISTS notification_mutes_own_delete ON public.notification_mutes;
CREATE POLICY notification_mutes_own_select ON public.notification_mutes FOR SELECT TO authenticated
  USING (user_id = public.get_my_user_id());
CREATE POLICY notification_mutes_own_insert ON public.notification_mutes FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_my_user_id());
CREATE POLICY notification_mutes_own_update ON public.notification_mutes FOR UPDATE TO authenticated
  USING (user_id = public.get_my_user_id()) WITH CHECK (user_id = public.get_my_user_id());
CREATE POLICY notification_mutes_own_delete ON public.notification_mutes FOR DELETE TO authenticated
  USING (user_id = public.get_my_user_id());

-- Grant rule (house): SELECT to anon; S/I/U/D to authenticated + service_role;
-- never TRUNCATE/REFERENCES/TRIGGER for anon/authenticated. RLS on (anon sees nothing).
REVOKE ALL ON TABLE public.notification_mutes FROM anon, authenticated;
GRANT SELECT ON TABLE public.notification_mutes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notification_mutes TO authenticated, service_role;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.notification_mutes FROM anon, authenticated;

-- 2. Delivery tracking ---------------------------------------------------
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
CREATE INDEX IF NOT EXISTS notifications_system_undelivered_idx
  ON public.notifications (created_at)
  WHERE delivered_at IS NULL AND type IN ('guard_card', 'patrol_overdue', 'patrol_overdue_escalation');

CREATE OR REPLACE FUNCTION public.claim_system_notifications(p_limit integer DEFAULT 500)
RETURNS SETOF public.notifications
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.notifications n
  SET delivered_at = now()
  WHERE n.id IN (
    SELECT id FROM public.notifications
    WHERE delivered_at IS NULL
      AND type IN ('guard_card', 'patrol_overdue', 'patrol_overdue_escalation')
      AND created_at > (now() AT TIME ZONE 'UTC') - interval '2 hours'
    ORDER BY created_at
    LIMIT least(greatest(p_limit, 1), 1000)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING n.*;
$$;
REVOKE ALL ON FUNCTION public.claim_system_notifications(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_system_notifications(integer) TO service_role;

-- 3. Kick notify-system --------------------------------------------------
CREATE OR REPLACE FUNCTION public.kick_notify_system()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_secret text;
BEGIN
  SELECT btrim(decrypted_secret, E' \n\r\t') INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'integrations_cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/notify-system',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-integrations-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'kick_notify_system failed: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.kick_notify_system() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kick_notify_system() TO service_role;

-- 4. Guard card reminders: same schedule/logic, type guard_card, then deliver.
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
              'guard_card', false, '/profile', now());
      v_count := v_count + 1;
    END IF;

    IF v_days = 0 THEN
      INSERT INTO notifications (id, user_id, company_id, title, body, type, read, action_url, created_at)
      SELECT gen_random_uuid(), sup.user_id, r.company_id, 'A guard card expires today',
             'One of your officers has a guard card expiring today. Check Personnel before scheduling them.',
             'guard_card', false, '/admin/staff', now()
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
  IF v_count > 0 THEN PERFORM public.kick_notify_system(); END IF;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_card_expiry_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_card_expiry_reminders() TO service_role;

-- 5. Overdue patrols: officer first, then supervisors after 5 more minutes.
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
  v_officer_alert timestamp;
  v_now_utc timestamp := now() AT TIME ZONE 'UTC';
BEGIN
  FOR r IN
    SELECT pr.id, pr.company_id, pr.name, pr.frequency_min, pr.checkpoint_ids
    FROM patrol_routes pr
    WHERE pr.is_active IS TRUE AND coalesce(pr.frequency_min, 0) > 0
  LOOP
    v_window := make_interval(mins => r.frequency_min + 10);   -- 10-minute grace

    SELECT min(t.clock_in AT TIME ZONE 'UTC') INTO v_first_in
    FROM timesheets t
    WHERE t.company_id = r.company_id AND t.clock_out IS NULL
      AND t.clock_in > v_now_utc - interval '16 hours';
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

    -- Step 1: officers on duty (once per frequency window).
    INSERT INTO notifications (id, user_id, company_id, title, body, type, read, action_url, created_at)
    SELECT gen_random_uuid(), x.user_id, r.company_id, v_title, v_body, 'patrol_overdue', false, '/patrols', v_now_utc
    FROM (
      SELECT DISTINCT t.user_id FROM timesheets t
      WHERE t.company_id = r.company_id AND t.clock_out IS NULL
        AND t.clock_in > v_now_utc - interval '16 hours'
    ) x
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = x.user_id AND n.company_id = r.company_id
        AND n.type = 'patrol_overdue' AND n.title = v_title
        AND n.created_at > v_now_utc - make_interval(mins => r.frequency_min)
    );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;

    -- Step 2: still overdue 5+ min after the first officer alert of this
    -- episode (no scan since) -> supervisors, once per frequency window.
    SELECT min(n.created_at) INTO v_officer_alert
    FROM notifications n
    WHERE n.company_id = r.company_id AND n.type = 'patrol_overdue' AND n.title = v_title
      AND n.created_at > coalesce(v_last AT TIME ZONE 'UTC', v_first_in AT TIME ZONE 'UTC');
    CONTINUE WHEN v_officer_alert IS NULL OR v_officer_alert > v_now_utc - interval '5 minutes';

    INSERT INTO notifications (id, user_id, company_id, title, body, type, read, action_url, created_at)
    SELECT gen_random_uuid(), cm.user_id, r.company_id, 'Escalated: ' || v_title,
           v_body || ' The officer on duty was alerted and it is still overdue.',
           'patrol_overdue_escalation', false, '/patrols', v_now_utc
    FROM company_memberships cm
    WHERE cm.company_id = r.company_id AND cm.status = 'active'
      AND cm.role::text IN ('owner', 'admin', 'manager', 'lead')
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = cm.user_id AND n.company_id = r.company_id
          AND n.type = 'patrol_overdue_escalation' AND n.title = 'Escalated: ' || v_title
          AND n.created_at > v_now_utc - make_interval(mins => r.frequency_min)
      );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;
  END LOOP;
  IF v_count > 0 THEN PERFORM public.kick_notify_system(); END IF;
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
SELECT cron.schedule('patrol-overdue-alerts', '*/5 * * * *', $job$ SELECT public.patrol_overdue_alerts(); $job$);
