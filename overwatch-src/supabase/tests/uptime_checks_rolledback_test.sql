\set ON_ERROR_STOP 1
DO $$ DECLARE s jsonb; i int; BEGIN
  ASSERT (SELECT count(*) FROM cron.job WHERE jobname='uptime-probe' AND schedule='*/5 * * * *') = 1, 'cron job';
  -- first probe fires a request
  PERFORM public.uptime_probe();
  ASSERT (SELECT count(*) FROM public.uptime_checks WHERE ok IS NULL) = 1, 'in flight';
  ASSERT (SELECT url FROM net.calls) LIKE '%/functions/v1/health', 'url';
  -- response arrives ok
  UPDATE public.uptime_checks SET ts = now() - interval '3 seconds';
  INSERT INTO net._http_response(id,status_code,content) SELECT request_id,200,'{"status":"ok","checks":{"database":{"ok":true,"ms":9}}}' FROM public.uptime_checks;
  PERFORM public.uptime_probe();
  ASSERT (SELECT ok FROM public.uptime_checks WHERE id=1), 'settled ok';
  ASSERT (SELECT latency_ms BETWEEN 2000 AND 5000 FROM public.uptime_checks WHERE id=1), 'latency';
  ASSERT (SELECT components->'database'->>'ok' FROM public.uptime_checks WHERE id=1)='true', 'components';
  -- 503 degraded => down; stale no-answer => down
  INSERT INTO net._http_response(id,status_code,content) SELECT request_id,503,'{"status":"degraded"}' FROM public.uptime_checks WHERE id=2;
  INSERT INTO public.uptime_checks(ts,request_id) VALUES (now()-interval '10 minutes', 9999);
  PERFORM public.uptime_probe();
  ASSERT NOT (SELECT ok FROM public.uptime_checks WHERE id=2), '503 down';
  ASSERT NOT (SELECT ok FROM public.uptime_checks WHERE request_id=9999), 'timeout down';
  -- seed 30 days: 8640 checks, 40 failures => 99.537%
  DELETE FROM public.uptime_checks;
  INSERT INTO public.uptime_checks(ts,ok) SELECT now() - (g * interval '5 minutes'), g > 40 FROM generate_series(1,8640) g;
  INSERT INTO public.uptime_checks(ts,ok) VALUES (now()-interval '200 days', false);
  s := public.get_uptime_summary();
  ASSERT (s->>'uptime_30d')::numeric = 99.537, 'pct30 '||(s->>'uptime_30d');
  ASSERT (s->>'checks_30d')::int = 8640, 'n30 '||(s->>'checks_30d');
  ASSERT jsonb_array_length(s->'daily') = 90, 'daily len';
  ASSERT (s->>'uptime_90d')::numeric = (s->>'uptime_30d')::numeric, 'old row excluded';
  PERFORM public.uptime_probe();
  ASSERT NOT EXISTS (SELECT 1 FROM public.uptime_checks WHERE ts < now()-interval '100 days'), 'pruned';
END $$;
-- privileges
SET ROLE anon;
SELECT CASE WHEN count(*)=0 THEN 'anon rows hidden' ELSE 'FAIL' END FROM public.uptime_checks;
SELECT (public.get_uptime_summary()->>'uptime_30d') AS anon_rpc_30d;
DO $$ BEGIN PERFORM public.uptime_probe(); RAISE EXCEPTION 'FAIL anon probe'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'anon probe denied'; END $$;
DO $$ BEGIN INSERT INTO public.uptime_checks(ok) VALUES (true); RAISE EXCEPTION 'FAIL anon insert'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'anon insert denied'; END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN INSERT INTO public.uptime_checks(ok) VALUES (true); RAISE EXCEPTION 'FAIL auth insert'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'auth insert blocked by RLS'; END $$;
DO $$ BEGIN TRUNCATE public.uptime_checks; RAISE EXCEPTION 'FAIL truncate'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'truncate denied'; END $$;
RESET ROLE;
