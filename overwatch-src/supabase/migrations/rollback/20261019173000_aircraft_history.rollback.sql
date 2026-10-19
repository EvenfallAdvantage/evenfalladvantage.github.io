-- Rollback for 20261019173000_aircraft_history.
BEGIN;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'aircraft-positions-ttl';
DROP FUNCTION IF EXISTS public.aircraft_track(text);
DROP FUNCTION IF EXISTS public.aircraft_positions_record(jsonb);
DROP TABLE IF EXISTS public.aircraft_positions;
COMMIT;
