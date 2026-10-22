-- Rollback for 20261022010000_uptime_checks.sql (drops collected uptime history).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'uptime-probe') THEN
    PERFORM cron.unschedule('uptime-probe');
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.get_uptime_summary();
DROP FUNCTION IF EXISTS public.uptime_probe();
DROP TABLE IF EXISTS public.uptime_checks;
