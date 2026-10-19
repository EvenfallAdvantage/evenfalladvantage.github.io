-- =============================================================================
-- 20261019173000_aircraft_history (OverwatchDB nneueuvyeohwnspbwfub ONLY).
-- NOT APPLIED. Our own 24 h aircraft track history, replacing adsb.lol
-- trace_full files (adsb.lol: "not an api").
--   * public.aircraft_positions: positions recorded by the opensky-proxy Edge
--     function (service role) from the area responses it already fetches,
--     downsampled to at most one point per aircraft per minute (bucket).
--     Data derived from adsb.lol (ODbL 1.0). Coverage: only areas Overwatch
--     users have viewed.
--   * aircraft_positions_record(): batched insert, service_role only.
--   * aircraft_track(hex): read path for any signed-in user (map stays free).
--   * pg_cron: hourly cleanup of rows older than 24 h.
-- RLS on, no policies: no direct table access for anon/authenticated.
-- Rollback: rollback/20261019173000_aircraft_history.rollback.sql
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.aircraft_positions (
  hex      text     NOT NULL CHECK (hex ~ '^~?[0-9a-f]{6}$'),
  -- Minute bucket (epoch seconds / 60): the primary key enforces 1 point per aircraft per minute.
  bucket   integer  NOT NULL,
  ts       timestamptz NOT NULL,
  lat      real     NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon      real     NOT NULL CHECK (lon BETWEEN -180 AND 180),
  alt_m    integer  CHECK (alt_m BETWEEN -500 AND 30000),
  flags    smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (hex, bucket)
);
-- Cleanup scans by time; BRIN stays tiny for append-mostly data.
CREATE INDEX IF NOT EXISTS aircraft_positions_ts_brin ON public.aircraft_positions USING brin (ts);

ALTER TABLE public.aircraft_positions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aircraft_positions FROM PUBLIC, anon, authenticated;

-- p_rows: [{hex, ts (epoch s), lat, lon, alt_m, flags}]. Duplicates within a minute are ignored.
CREATE OR REPLACE FUNCTION public.aircraft_positions_record(p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE n integer;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 5000 THEN
    RAISE EXCEPTION 'p_rows must be an array of at most 5000 rows';
  END IF;
  INSERT INTO public.aircraft_positions (hex, bucket, ts, lat, lon, alt_m, flags)
  SELECT DISTINCT ON (lower(r.hex), floor(r.ts / 60)::integer)
         lower(r.hex), floor(r.ts / 60)::integer, to_timestamp(r.ts), r.lat, r.lon,
         CASE WHEN r.alt_m BETWEEN -500 AND 30000 THEN r.alt_m END, coalesce(r.flags, 0)
  FROM jsonb_to_recordset(p_rows) AS r(hex text, ts double precision, lat real, lon real, alt_m integer, flags smallint)
  WHERE lower(r.hex) ~ '^~?[0-9a-f]{6}$'
    AND r.lat BETWEEN -90 AND 90 AND r.lon BETWEEN -180 AND 180
    AND NOT (r.lat = 0 AND r.lon = 0)
    AND r.ts BETWEEN extract(epoch FROM now()) - 600 AND extract(epoch FROM now()) + 60
  ORDER BY lower(r.hex), floor(r.ts / 60)::integer, r.ts DESC
  ON CONFLICT (hex, bucket) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$fn$;
REVOKE ALL ON FUNCTION public.aircraft_positions_record(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aircraft_positions_record(jsonb) TO service_role;

-- Last 24 h for one aircraft, oldest first, for any signed-in user.
CREATE OR REPLACE FUNCTION public.aircraft_track(p_hex text)
RETURNS TABLE (ts timestamptz, lat real, lon real, alt_m integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT p.ts, p.lat, p.lon, p.alt_m
  FROM public.aircraft_positions p
  WHERE auth.uid() IS NOT NULL
    AND p.hex = lower(btrim(p_hex))
    AND p.bucket >= floor(extract(epoch FROM now() - interval '24 hours') / 60)::integer
  ORDER BY p.bucket
  LIMIT 1440;
$fn$;
REVOKE ALL ON FUNCTION public.aircraft_track(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aircraft_track(text) TO authenticated;

SELECT cron.schedule('aircraft-positions-ttl', '17 * * * *',
  $$DELETE FROM public.aircraft_positions WHERE ts < now() - interval '24 hours'$$);
COMMIT;
