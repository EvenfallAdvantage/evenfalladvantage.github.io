-- Rolled-back test for 20261016212852_cctv_cameras.sql. Run AFTER pasting the
-- migration body in the same request; the final RAISE aborts everything.
DO $t$
DECLARE r_pts jsonb; r_dl jsonb; r_cl jsonb; r_auth text; r_anon text; r_write text; stale int;
  member_sid text := '3de4a849-3427-4c81-8ff6-ee49d330ec4d';
BEGIN
  INSERT INTO public.cctv_cameras(id, source, lat, lng, name, attribution, last_seen_at) VALUES
    ('t-sf', 'Caltrans', 37.77, -122.42, 'SF', 'Caltrans', now()),
    ('t-la', 'Caltrans', 34.05, -118.24, 'LA', 'Caltrans', now()),
    ('t-nyc', 'NYC DOT', 40.78, -73.97, 'NYC', 'NYC DOT', now()),
    ('t-fiji', 'Test', -17.7, 179.5, 'E of dateline-ish', 't', now()),
    ('t-samoa', 'Test', -13.8, -172.0, 'W of dateline', 't', now()),
    ('t-old', 'Caltrans', 36.0, -120.0, 'stale', 'Caltrans', now() - interval '2 days');

  stale := public.cctv_mark_stale('Caltrans', now() - interval '24 hours');
  r_pts := public.cctv_cameras_bbox(-125, 32, -114, 42, 10);
  r_dl  := public.cctv_cameras_bbox(170, -25, -165, -5, 8);   -- crosses antimeridian
  r_cl  := public.cctv_cameras_bbox(-180, -90, 180, 90, 3);   -- clusters

  PERFORM set_config('request.jwt.claims', json_build_object('sub', member_sid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*)::text INTO r_auth FROM public.cctv_cameras WHERE id LIKE 't-%';
  BEGIN INSERT INTO public.cctv_cameras(id, source, lat, lng) VALUES ('t-x','x',1,1); r_write := 'ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN r_write := 'denied'; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  BEGIN SELECT count(*)::text INTO r_anon FROM public.cctv_cameras; EXCEPTION WHEN insufficient_privilege THEN r_anon := 'denied'; END;
  RESET ROLE;

  RAISE EXCEPTION 'ROLLED BACK OK | stale=% | pts mode=% total=% ids=% | dateline total=% ids=% | clusters mode=% n=% total=% | auth_read=% auth_write=% anon=%',
    stale, r_pts->>'mode', r_pts->>'total', (SELECT string_agg(e->>'id', ',' ORDER BY e->>'id') FROM jsonb_array_elements(r_pts->'cameras') e),
    r_dl->>'total', (SELECT string_agg(e->>'id', ',' ORDER BY e->>'id') FROM jsonb_array_elements(r_dl->'cameras') e),
    r_cl->>'mode', jsonb_array_length(r_cl->'clusters'), r_cl->>'total', r_auth, r_write, r_anon;
END $t$;
