-- Measured uptime for the 99.5% target (docs/compliance/SLA_DEFINITION.md).
-- Every 5 minutes pg_cron asks pg_net to GET the public `health` Edge Function and
-- records the answer. pg_net is asynchronous, so each run first settles the previous
-- request(s) from net._http_response, then fires a new one.
-- LIMIT: this probe runs inside Supabase, so it cannot see Cloudflare / GitHub Pages
-- outages or a full Supabase region outage. UptimeRobot covers those externally.

CREATE TABLE IF NOT EXISTS public.uptime_checks (
  id          bigserial PRIMARY KEY,
  ts          timestamptz NOT NULL DEFAULT now(),
  ok          boolean,                       -- NULL while the request is in flight
  latency_ms  integer,
  status_code integer,
  components  jsonb,                         -- {"database":{"ok":true,"ms":12}, ...}
  request_id  bigint UNIQUE,
  source      text NOT NULL DEFAULT 'pg_net'
);
CREATE INDEX IF NOT EXISTS uptime_checks_ts_idx ON public.uptime_checks (ts DESC);

ALTER TABLE public.uptime_checks ENABLE ROW LEVEL SECURITY;
-- No policies: raw rows are readable only by service_role. The public reads the
-- aggregate through get_uptime_summary() below.
REVOKE ALL ON TABLE public.uptime_checks FROM anon, authenticated;
GRANT SELECT ON TABLE public.uptime_checks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.uptime_checks TO authenticated, service_role;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.uptime_checks FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.uptime_checks_id_seq FROM anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.uptime_checks_id_seq TO service_role;

-- Probe: settle finished requests, time out stale ones, prune, fire the next one.
CREATE OR REPLACE FUNCTION public.uptime_probe()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.uptime_checks u
     SET status_code = r.status_code,
         ok = (coalesce(r.timed_out, false) = false AND r.status_code = 200
               AND (r.content::jsonb ->> 'status') = 'ok'),
         latency_ms = greatest(0, (extract(epoch FROM (r.created - u.ts)) * 1000)::int),
         components = CASE WHEN r.content IS NOT NULL AND left(ltrim(r.content), 1) = '{'
                           THEN r.content::jsonb -> 'checks' END
    FROM net._http_response r
   WHERE u.ok IS NULL AND r.id = u.request_id;

  -- No answer after 2 minutes counts as down.
  UPDATE public.uptime_checks SET ok = false
   WHERE ok IS NULL AND ts < now() - interval '2 minutes';

  DELETE FROM public.uptime_checks WHERE ts < now() - interval '100 days';

  INSERT INTO public.uptime_checks (request_id)
  VALUES (net.http_get(
    url := 'https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/health',
    timeout_milliseconds := 30000
  ));
EXCEPTION WHEN OTHERS THEN
  -- Never let a probe error break the cron job; record it as a failed check.
  INSERT INTO public.uptime_checks (ok, source) VALUES (false, 'probe_error');
  RAISE WARNING 'uptime_probe failed: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.uptime_probe() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.uptime_probe() TO service_role;

-- Public aggregate: uptime % for 7/30/90 days plus a 90-day daily series.
-- Each settled check stands for one 5-minute slice; in-flight checks are ignored.
CREATE OR REPLACE FUNCTION public.get_uptime_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH c AS (SELECT ts, ok FROM public.uptime_checks
              WHERE ok IS NOT NULL AND ts >= now() - interval '90 days'),
  pct AS (
    SELECT d, count(*) FILTER (WHERE ts >= now() - make_interval(days => d)) AS n,
           round(100.0 * count(*) FILTER (WHERE ok AND ts >= now() - make_interval(days => d))
                 / nullif(count(*) FILTER (WHERE ts >= now() - make_interval(days => d)), 0), 3) AS p
      FROM c, unnest(ARRAY[7, 30, 90]) d GROUP BY d
  ),
  days AS (
    SELECT g::date AS day,
           count(c.ts) AS checks,
           round(100.0 * count(c.ts) FILTER (WHERE c.ok) / nullif(count(c.ts), 0), 2) AS pct
      FROM generate_series((now() AT TIME ZONE 'UTC')::date - 89, (now() AT TIME ZONE 'UTC')::date, interval '1 day') g
      LEFT JOIN c ON (c.ts AT TIME ZONE 'UTC')::date = g::date
     GROUP BY g ORDER BY g
  )
  SELECT jsonb_build_object(
    'target', 99.5,
    'interval_minutes', 5,
    'uptime_7d',  (SELECT p FROM pct WHERE d = 7),
    'uptime_30d', (SELECT p FROM pct WHERE d = 30),
    'uptime_90d', (SELECT p FROM pct WHERE d = 90),
    'checks_30d', coalesce((SELECT n FROM pct WHERE d = 30), 0),
    'last_check', (SELECT max(ts) FROM c),
    'last_ok',    (SELECT ok FROM c ORDER BY ts DESC LIMIT 1),
    'daily', coalesce((SELECT jsonb_agg(jsonb_build_object('day', day, 'pct', pct, 'checks', checks) ORDER BY day) FROM days), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.get_uptime_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_uptime_summary() TO anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'uptime-probe') THEN
    PERFORM cron.unschedule('uptime-probe');
  END IF;
END $$;
SELECT cron.schedule('uptime-probe', '*/5 * * * *', $job$ SELECT public.uptime_probe(); $job$);
