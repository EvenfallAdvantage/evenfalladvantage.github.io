-- CCTV camera cache for the Operations map (intel-cctv bbox mode).
--
-- Filled by the intel-cctv-ingest edge function (service role) on a schedule
-- (see 20261016210500_cctv_ingest_schedule.sql). intel-cctv reads it by
-- bounding box through cctv_cameras_bbox(). Core `point` + GiST, no PostGIS.
--
-- RLS: authenticated users may SELECT. No INSERT/UPDATE/DELETE policies, so
-- only the service role (which bypasses RLS) can write. anon has no access.

CREATE TABLE IF NOT EXISTS public.cctv_cameras (
  id           text PRIMARY KEY,
  source       text NOT NULL,
  lat          double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng          double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  pt           point GENERATED ALWAYS AS (point(lng, lat)) STORED,
  name         text NOT NULL DEFAULT '',
  city         text NOT NULL DEFAULT '',
  country      text NOT NULL DEFAULT '',
  feed_url     text,
  stream_url   text,
  external_url text,
  attribution  text,
  online       boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cctv_cameras_pt_gist ON public.cctv_cameras USING gist (pt);
CREATE INDEX IF NOT EXISTS cctv_cameras_source_idx ON public.cctv_cameras (source);

CREATE TABLE IF NOT EXISTS public.cctv_source_status (
  source        text PRIMARY KEY,
  last_run_at   timestamptz,
  last_ok_at    timestamptz,
  camera_count  integer NOT NULL DEFAULT 0,
  last_error    text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cctv_cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cctv_source_status ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cctv_cameras, public.cctv_source_status FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.cctv_cameras, public.cctv_source_status FROM authenticated;
GRANT SELECT ON public.cctv_cameras, public.cctv_source_status TO authenticated;
GRANT ALL ON public.cctv_cameras, public.cctv_source_status TO service_role;

DROP POLICY IF EXISTS cctv_cameras_read ON public.cctv_cameras;
CREATE POLICY cctv_cameras_read ON public.cctv_cameras FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cctv_source_status_read ON public.cctv_source_status;
CREATE POLICY cctv_source_status_read ON public.cctv_source_status FOR SELECT TO authenticated USING (true);

-- Bounding-box read. West > east means the box crosses the antimeridian and
-- is split in two. Below p_cluster_below_zoom, returns grid clusters
-- {lat,lng,count,sources} instead of points. Only online cameras.
CREATE OR REPLACE FUNCTION public.cctv_cameras_bbox(
  p_west double precision, p_south double precision,
  p_east double precision, p_north double precision,
  p_zoom integer DEFAULT 10,
  p_limit integer DEFAULT 2000,
  p_cluster_below_zoom integer DEFAULT 7
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH params AS (
    SELECT least(greatest(coalesce(p_limit, 2000), 1), 5000) AS lim,
           coalesce(p_zoom, 10) AS z,
           360.0 / (2 ^ greatest(coalesce(p_zoom, 0), 0)) / 4.0 AS cell  -- ~4 cells per 256px tile
  ),
  hits AS (
    SELECT c.* FROM public.cctv_cameras c
    WHERE c.online AND p_south <= p_north AND (
      CASE WHEN p_west <= p_east
        THEN c.pt <@ box(point(p_west, p_south), point(p_east, p_north))
        ELSE c.pt <@ box(point(p_west, p_south), point(180, p_north))     -- antimeridian:
          OR c.pt <@ box(point(-180, p_south), point(p_east, p_north))    -- split in two
      END)
  ),
  src AS (SELECT coalesce(jsonb_object_agg(source, n), '{}'::jsonb) AS j FROM (SELECT source, count(*) n FROM hits GROUP BY source) s),
  tot AS (SELECT count(*) AS n FROM hits),
  cl AS (
    SELECT floor(h.lng / p.cell)::bigint gx, floor(h.lat / p.cell)::bigint gy,
           avg(h.lat) lat_avg, avg(h.lng) lng_avg, count(*) n, min(h.id) sample_id
    FROM hits h, params p GROUP BY 1, 2 ORDER BY count(*) DESC
    LIMIT (SELECT lim FROM params)
  ),
  pts AS (SELECT * FROM hits ORDER BY id LIMIT (SELECT lim FROM params))
  SELECT CASE WHEN (SELECT z FROM params) < p_cluster_below_zoom THEN
    jsonb_build_object(
      'mode', 'clusters', 'total', (SELECT n FROM tot), 'sources', (SELECT j FROM src),
      'clusters', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', 'cl-' || gx || '_' || gy || '_' || (SELECT z FROM params),
          'lat', round(lat_avg::numeric, 5), 'lng', round(lng_avg::numeric, 5),
          'count', n, 'sample_id', sample_id)) FROM cl), '[]'::jsonb))
  ELSE
    jsonb_build_object(
      'mode', 'points', 'total', (SELECT n FROM tot), 'sources', (SELECT j FROM src),
      'truncated', (SELECT n FROM tot) > (SELECT lim FROM params),
      'cameras', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', id, 'lat', lat, 'lng', lng, 'name', name, 'city', city, 'country', country,
          'feed_url', feed_url, 'stream_url', stream_url, 'external_url', external_url,
          'source', source, 'attribution', attribution)) FROM pts), '[]'::jsonb))
  END;
$$;

REVOKE ALL ON FUNCTION public.cctv_cameras_bbox(double precision, double precision, double precision, double precision, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cctv_cameras_bbox(double precision, double precision, double precision, double precision, integer, integer, integer) TO authenticated, service_role;

-- Ingest helper: mark a source's cameras not seen since p_cutoff as offline.
CREATE OR REPLACE FUNCTION public.cctv_mark_stale(p_source text, p_cutoff timestamptz)
RETURNS integer LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  WITH u AS (
    UPDATE public.cctv_cameras SET online = false, updated_at = now()
    WHERE source = p_source AND online AND last_seen_at < p_cutoff RETURNING 1
  ) SELECT count(*)::int FROM u;
$$;
REVOKE ALL ON FUNCTION public.cctv_mark_stale(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cctv_mark_stale(text, timestamptz) TO service_role;
