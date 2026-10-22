-- Rollback for 20261020052536_sos_hardening.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'panic_alert_locations') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.panic_alert_locations;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'panic_alerts') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.panic_alerts;
  END IF;
END $$;
DROP POLICY IF EXISTS panic_update_own ON public.panic_alerts;
DROP TABLE IF EXISTS public.panic_alert_locations;
COMMIT;
