-- Local test for 20261020032000_verified_clock (scratch Postgres + stub only).
DO $$ BEGIN
  IF NOT public.point_in_geojson('{"type":"Polygon","coordinates":[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[6,4],[6,6],[4,6],[4,4]]]}', 2, 2) THEN RAISE EXCEPTION 'pip inside'; END IF;
  IF public.point_in_geojson('{"type":"Polygon","coordinates":[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[6,4],[6,6],[4,6],[4,4]]]}', 5, 5) THEN RAISE EXCEPTION 'pip hole'; END IF;
  IF public.point_in_geojson('{"type":"Polygon","coordinates":[[[0,0],[10,0],[10,10],[0,10],[0,0]]]}', 11, 5) THEN RAISE EXCEPTION 'pip outside'; END IF;
  IF NOT public.point_in_geojson('{"type":"MultiPolygon","coordinates":[[[[20,20],[21,20],[21,21],[20,21],[20,20]]],[[[0,0],[1,0],[1,1],[0,1],[0,0]]]]}', 0.5, 0.5) THEN RAISE EXCEPTION 'pip multi'; END IF;
  IF abs(public.haversine_m(34.0522,-118.2437,34.0531,-118.2437) - 100) > 2 THEN RAISE EXCEPTION 'haversine'; END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
-- inside the 100 m post radius (~50 m away)
DO $$ DECLARE r public.timesheets; BEGIN
  r := public.timesheet_clock_in('c0000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001',NULL,'shift',NULL,34.05265,-118.2437,8,'7a000000-0000-0000-0000-000000000001',NULL);
  IF r.clock_in_geofence <> 'inside' OR r.clock_in_distance_m NOT BETWEEN 45 AND 55 OR r.clock_method <> 'app' OR r.event_id IS NULL THEN RAISE EXCEPTION 'inside clock-in wrong: % % %', r.clock_in_geofence, r.clock_in_distance_m, r.clock_method; END IF;
  IF abs(extract(epoch FROM (r.clock_in - (now() AT TIME ZONE 'utc')))) > 5 THEN RAISE EXCEPTION 'not server time'; END IF;
  -- idempotent replay returns the same row
  r := public.timesheet_clock_in('c0000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001',NULL,'shift',NULL,0,0,8,'7a000000-0000-0000-0000-000000000001',NULL);
  IF r.clock_in_geofence <> 'inside' THEN RAISE EXCEPTION 'replay changed row'; END IF;
  -- second open clock-in refused
  BEGIN PERFORM public.timesheet_clock_in('c0000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'double clock-in allowed';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  -- offline clock-out 30 min ago... must be after clock-in -> out of range
  BEGIN PERFORM public.timesheet_clock_out('7a000000-0000-0000-0000-000000000001',34.07,-118.2437,10, now() - interval '30 minutes'); RAISE EXCEPTION 'clock-out before clock-in allowed';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  r := public.timesheet_clock_out('7a000000-0000-0000-0000-000000000001',34.07,-118.2437,10,NULL);
  IF r.clock_out IS NULL OR r.clock_out_geofence <> 'outside' OR r.clock_out_distance_m < 1900 THEN RAISE EXCEPTION 'clock-out verdict wrong: %', r.clock_out_geofence; END IF;
END $$;
-- offline replay with a tap time 2 h ago, no GPS, operation without fence
DO $$ DECLARE r public.timesheets; BEGIN
  r := public.timesheet_clock_in('c0000000-0000-0000-0000-000000000001',NULL,'e1000000-0000-0000-0000-000000000002','manual',NULL,NULL,NULL,NULL,NULL, now() - interval '2 hours');
  IF r.clock_method <> 'app_offline' OR r.clock_in_geofence <> 'no_gps' OR abs(extract(epoch FROM (r.clock_in - ((now() - interval '2 hours') AT TIME ZONE 'utc')))) > 5 THEN RAISE EXCEPTION 'offline replay wrong'; END IF;
  PERFORM public.timesheet_clock_out(r.id);
  BEGIN PERFORM public.timesheet_clock_in('c0000000-0000-0000-0000-000000000001',NULL,NULL,'manual',NULL,NULL,NULL,NULL,NULL, now() - interval '2 days'); RAISE EXCEPTION 'stale offline time allowed';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
-- someone else's shift / company refused
SELECT set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
DO $$ BEGIN
  BEGIN PERFORM public.timesheet_clock_in('c0000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'non-member clock-in allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.timesheet_clock_out('7a000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'foreign clock-out allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- polygon fallback: company geofence, no post radius
INSERT INTO public.geofences(company_id,name,geometry) VALUES ('c0000000-0000-0000-0000-000000000001','Yard','{"type":"Polygon","coordinates":[[[-118.25,34.05],[-118.24,34.05],[-118.24,34.06],[-118.25,34.06],[-118.25,34.05]]]}');
DO $$ DECLARE f record; BEGIN
  SELECT * INTO f FROM public.clock_fence_check('a0000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000002',34.055,-118.245);
  IF f.verdict <> 'inside' THEN RAISE EXCEPTION 'polygon inside: %', f.verdict; END IF;
  SELECT * INTO f FROM public.clock_fence_check('a0000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000002',34.2,-118.245);
  IF f.verdict <> 'outside' THEN RAISE EXCEPTION 'polygon outside: %', f.verdict; END IF;
END $$;
DELETE FROM public.timesheets; DELETE FROM public.geofences;
