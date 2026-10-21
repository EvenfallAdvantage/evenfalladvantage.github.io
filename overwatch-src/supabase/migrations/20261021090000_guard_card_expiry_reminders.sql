-- NEXT_TEN #1: daily guard-card expiry reminders (in-app notifications).
-- NOT APPLIED. Needs owner approval to go live.
--
-- Once a day (14:00 UTC = 7 AM PT) for every active, non-client member with a
-- guard_card_expiry:
--   * the officer gets a notification at 30, 7 and 1 day(s) before expiry and on the day;
--   * owners/admins/managers of that company get one on the day it expires.
-- Idempotent per day: a reminder with the same title for the same user on the
-- same UTC day is never inserted twice.

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

SELECT cron.schedule(
  'guard-card-expiry-reminders',
  '0 14 * * *',
  $job$ SELECT public.guard_card_expiry_reminders(); $job$
);
