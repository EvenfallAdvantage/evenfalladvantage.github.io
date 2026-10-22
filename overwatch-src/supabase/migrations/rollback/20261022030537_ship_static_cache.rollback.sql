-- Rollback for 20261022030537_ship_static_cache: restores ships_static_upsert from 20261019155428.
BEGIN;
SELECT cron.unschedule('ship-static-ttl') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ship-static-ttl');
DROP TRIGGER IF EXISTS ships_fill_static ON public.ships;
DROP FUNCTION IF EXISTS public.ships_fill_static();
CREATE OR REPLACE FUNCTION public.ships_static_upsert(p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE n integer;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 20000 THEN
    RAISE EXCEPTION 'p_rows must be an array of at most 20000 rows';
  END IF;
  UPDATE public.ships s SET
    name = coalesce(left(nullif(btrim(r.name), ''), 40), s.name),
    callsign = coalesce(left(nullif(btrim(r.callsign), ''), 12), s.callsign),
    ship_type = coalesce(r.ship_type, s.ship_type),
    length_m = coalesce(CASE WHEN r.length_m BETWEEN 1 AND 600 THEN r.length_m END, s.length_m),
    destination = coalesce(left(nullif(btrim(r.destination), ''), 40), s.destination)
  FROM (SELECT DISTINCT ON (mmsi) * FROM jsonb_to_recordset(p_rows) AS x(
          mmsi bigint, name text, callsign text, ship_type smallint, length_m smallint, destination text)) r
  WHERE s.mmsi = r.mmsi;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$fn$;
REVOKE ALL ON FUNCTION public.ships_static_upsert(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ships_static_upsert(jsonb) TO service_role;
DROP TABLE IF EXISTS public.ship_static;
COMMIT;
