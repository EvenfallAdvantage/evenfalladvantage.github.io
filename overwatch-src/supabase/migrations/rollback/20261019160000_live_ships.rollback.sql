-- Rollback for 20261019160000_live_ships.
BEGIN;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('ais-collector', 'ships-ttl-cleanup');
DROP FUNCTION IF EXISTS public.ships_in_bbox(double precision, double precision, double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.ships_static_upsert(jsonb);
DROP FUNCTION IF EXISTS public.ships_upsert(jsonb);
DROP TABLE IF EXISTS public.ships;
COMMIT;
