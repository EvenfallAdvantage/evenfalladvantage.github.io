-- =============================================================================
-- 20261019160000_live_ships (OverwatchDB nneueuvyeohwnspbwfub ONLY). NOT APPLIED.
-- Live AIS ships for the Air & Sea layer (plan: SHIPS_PLAN.md).
--   * public.ships: one row per MMSI (latest fix), written only by the
--     ais-collector Edge function (service role) through ships_upsert().
--   * ships_in_bbox(): read path for any signed-in user (map stays free).
--   * pg_cron: collector every minute (reuses integration_cron_call(), which
--     sends the Vault secret 'integrations_cron_secret'; the function checks it
--     with integration_cron_secret_matches()), TTL cleanup every 10 minutes.
-- Requires 20261018004108_integration_cron_secret_vault and 20261018004232_integration_cron.
-- Deploy the ais-collector function BEFORE applying, or the first runs 404 (harmless).
-- Rollback: rollback/20261019160000_live_ships.rollback.sql
-- =============================================================================
BEGIN;

DO $guard$
BEGIN
  IF to_regprocedure('public.integration_cron_call(text)') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261018004232_integration_cron first';
  END IF;
  IF to_regprocedure('public.integration_cron_secret_matches(text)') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261018004108_integration_cron_secret_vault first';
  END IF;
END
$guard$;

CREATE TABLE IF NOT EXISTS public.ships (
  mmsi        bigint PRIMARY KEY CHECK (mmsi BETWEEN 100000000 AND 999999999),
  lat         double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon         double precision NOT NULL CHECK (lon BETWEEN -180 AND 180),
  sog         real,
  cog         real,
  heading     smallint,
  nav_status  smallint,
  name        text CHECK (char_length(name) <= 40),
  callsign    text CHECK (char_length(callsign) <= 12),
  ship_type   smallint,
  length_m    smallint,
  destination text CHECK (char_length(destination) <= 40),
  source      text NOT NULL CHECK (source IN ('aisstream', 'digitraffic')),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ships_lat_lon_idx ON public.ships (lat, lon);
CREATE INDEX IF NOT EXISTS ships_updated_at_idx ON public.ships (updated_at);

ALTER TABLE public.ships ENABLE ROW LEVEL SECURITY;
-- No policies: no direct table access for anon/authenticated. Reads go through ships_in_bbox().
REVOKE ALL ON public.ships FROM PUBLIC, anon, authenticated;

-- Batched upsert from the collector. p_rows: [{mmsi,lat,lon,sog,cog,heading,nav_status,
-- name,callsign,ship_type,length_m,destination,source,ts}]. Static fields (name, type, ...)
-- are only overwritten when the new value is not null, so position-only messages
-- keep the names learned from static messages.
CREATE OR REPLACE FUNCTION public.ships_upsert(p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE n integer;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) > 20000 THEN
    RAISE EXCEPTION 'p_rows must be an array of at most 20000 rows';
  END IF;
  WITH src AS (
    SELECT DISTINCT ON (r.mmsi) r.*
    FROM jsonb_to_recordset(p_rows) AS r(
      mmsi bigint, lat double precision, lon double precision, sog real, cog real,
      heading smallint, nav_status smallint, name text, callsign text, ship_type smallint,
      length_m smallint, destination text, source text, ts timestamptz)
    WHERE r.mmsi BETWEEN 100000000 AND 999999999
      AND r.lat BETWEEN -90 AND 90 AND r.lon BETWEEN -180 AND 180
      AND NOT (r.lat = 0 AND r.lon = 0)
      AND r.source IN ('aisstream', 'digitraffic')
    ORDER BY r.mmsi, coalesce(r.ts, now()) DESC
  )
  INSERT INTO public.ships AS s (mmsi, lat, lon, sog, cog, heading, nav_status, name, callsign,
                                 ship_type, length_m, destination, source, updated_at)
  SELECT mmsi, lat, lon, sog, cog,
         CASE WHEN heading BETWEEN 0 AND 359 THEN heading END,
         nav_status, left(nullif(btrim(name), ''), 40), left(nullif(btrim(callsign), ''), 12),
         ship_type, CASE WHEN length_m BETWEEN 1 AND 600 THEN length_m END,
         left(nullif(btrim(destination), ''), 40), source,
         LEAST(coalesce(ts, now()), now())
  FROM src
  ON CONFLICT (mmsi) DO UPDATE SET
    lat = EXCLUDED.lat, lon = EXCLUDED.lon, sog = EXCLUDED.sog, cog = EXCLUDED.cog,
    heading = EXCLUDED.heading, nav_status = coalesce(EXCLUDED.nav_status, s.nav_status),
    name = coalesce(EXCLUDED.name, s.name), callsign = coalesce(EXCLUDED.callsign, s.callsign),
    ship_type = coalesce(EXCLUDED.ship_type, s.ship_type), length_m = coalesce(EXCLUDED.length_m, s.length_m),
    destination = coalesce(EXCLUDED.destination, s.destination),
    source = EXCLUDED.source, updated_at = EXCLUDED.updated_at
  WHERE EXCLUDED.updated_at >= s.updated_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$fn$;
REVOKE ALL ON FUNCTION public.ships_upsert(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ships_upsert(jsonb) TO service_role;

-- Static-only update (ShipStaticData): names/types for ships already known.
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

-- Read path: fresh ships in a box, for any signed-in user. west > east = crosses the antimeridian.
CREATE OR REPLACE FUNCTION public.ships_in_bbox(
  p_south double precision, p_north double precision,
  p_west double precision, p_east double precision,
  p_limit integer DEFAULT 2000)
RETURNS TABLE (mmsi bigint, lat double precision, lon double precision, sog real, cog real,
               heading smallint, nav_status smallint, name text, callsign text, ship_type smallint,
               length_m smallint, destination text, source text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT s.mmsi, s.lat, s.lon, s.sog, s.cog, s.heading, s.nav_status, s.name, s.callsign,
         s.ship_type, s.length_m, s.destination, s.source, s.updated_at
  FROM public.ships s
  WHERE auth.uid() IS NOT NULL
    AND s.updated_at > now() - interval '15 minutes'
    AND s.lat BETWEEN p_south AND p_north
    AND CASE WHEN p_west <= p_east THEN s.lon BETWEEN p_west AND p_east
             ELSE (s.lon >= p_west OR s.lon <= p_east) END
  ORDER BY s.updated_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 2000), 5000));
$fn$;
REVOKE ALL ON FUNCTION public.ships_in_bbox(double precision, double precision, double precision, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ships_in_bbox(double precision, double precision, double precision, double precision, integer) TO authenticated;

SELECT cron.schedule('ais-collector', '* * * * *', $$SELECT public.integration_cron_call('ais-collector')$$);
SELECT cron.schedule('ships-ttl-cleanup', '*/10 * * * *',
  $$DELETE FROM public.ships WHERE updated_at < now() - interval '30 minutes'$$);
COMMIT;
