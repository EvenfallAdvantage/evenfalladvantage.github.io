SELECT cron.unschedule('patrol-overdue-alerts');
DROP FUNCTION IF EXISTS public.patrol_overdue_alerts();
