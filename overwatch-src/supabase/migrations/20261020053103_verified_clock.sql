-- =============================================================================
-- 20261020053103_verified_clock (OverwatchDB nneueuvyeohwnspbwfub ONLY).
-- NOT APPLIED. Rollback: rollback/20261020053103_verified_clock.rollback.sql
-- Verified clock-in/out: GPS + geofence check, server time.
--   * timesheets: clock-in/out GPS, accuracy, distance to post and a geofence
--     verdict ('inside' | 'outside' | 'no_fence' | 'no_gps'), plus the client's
--     tap time for offline replays (client_clock_in/out).
--   * point_in_geojson(): Polygon / MultiPolygon test (ray casting, holes honoured).
--   * timesheet_clock_in() / timesheet_clock_out(): SECURITY DEFINER RPCs.
--       - caller must be a member of the company; rows are always the caller's own
--       - time is server time; an offline replay may pass p_client_at, accepted only
--         if within the last 12 h (and, for clock-out, after clock-in). Such rows get
--         clock_method 'app_offline' so supervisors can review them.
--       - fence: the operation's post (events.location_lat/lng + geofence_radius_meters)
--         if set, else any active company geofence polygon (company-wide or one of the
--         caller's teams). Outside is RECORDED and FLAGGED, not blocked.
--   * The existing guard_timesheets trigger is unchanged (direct staff writes still get
--     server time); these RPCs run as the function owner, so the trigger's staff rules
--     don't apply to them and the checks above replace them.
-- =============================================================================
BEGIN;

ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS clock_in_lat        double precision,
  ADD COLUMN IF NOT EXISTS clock_in_lng        double precision,
  ADD COLUMN IF NOT EXISTS clock_in_accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS clock_in_distance_m integer,
  ADD COLUMN IF NOT EXISTS clock_in_geofence   text CHECK (clock_in_geofence IN ('inside','outside','no_fence','no_gps')),
  ADD COLUMN IF NOT EXISTS client_clock_in     timestamp,
  ADD COLUMN IF NOT EXISTS clock_out_lat        double precision,
  ADD COLUMN IF NOT EXISTS clock_out_lng        double precision,
  ADD COLUMN IF NOT EXISTS clock_out_accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS clock_out_distance_m integer,
  ADD COLUMN IF NOT EXISTS clock_out_geofence   text CHECK (clock_out_geofence IN ('inside','outside','no_fence','no_gps')),
  ADD COLUMN IF NOT EXISTS client_clock_out     timestamp;

CREATE OR REPLACE FUNCTION public.haversine_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO '' AS $$
  SELECT 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- Ray casting on one ring of [lng, lat] pairs.
CREATE OR REPLACE FUNCTION public.point_in_ring(ring jsonb, lat double precision, lng double precision)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path TO '' AS $$
DECLARE
  n int := jsonb_array_length(ring);
  i int; j int;
  xi double precision; yi double precision; xj double precision; yj double precision;
  inside boolean := false;
BEGIN
  IF n < 4 THEN RETURN false; END IF;
  j := n - 1;
  FOR i IN 0 .. n - 1 LOOP
    xi := (ring -> i ->> 0)::double precision; yi := (ring -> i ->> 1)::double precision;
    xj := (ring -> j ->> 0)::double precision; yj := (ring -> j ->> 1)::double precision;
    IF ((yi > lat) <> (yj > lat)) AND (lng < (xj - xi) * (lat - yi) / NULLIF(yj - yi, 0) + xi) THEN
      inside := NOT inside;
    END IF;
    j := i;
  END LOOP;
  RETURN inside;
END $$;

CREATE OR REPLACE FUNCTION public.point_in_geojson(geom jsonb, lat double precision, lng double precision)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path TO '' AS $$
DECLARE poly jsonb; k int; hit boolean;
BEGIN
  IF geom IS NULL OR lat IS NULL OR lng IS NULL THEN RETURN false; END IF;
  IF geom ->> 'type' = 'Polygon' THEN
    IF NOT public.point_in_ring(geom -> 'coordinates' -> 0, lat, lng) THEN RETURN false; END IF;
    FOR k IN 1 .. jsonb_array_length(geom -> 'coordinates') - 1 LOOP
      IF public.point_in_ring(geom -> 'coordinates' -> k, lat, lng) THEN RETURN false; END IF; -- in a hole
    END LOOP;
    RETURN true;
  ELSIF geom ->> 'type' = 'MultiPolygon' THEN
    FOR poly IN SELECT value FROM jsonb_array_elements(geom -> 'coordinates') LOOP
      hit := public.point_in_geojson(jsonb_build_object('type', 'Polygon', 'coordinates', poly), lat, lng);
      IF hit THEN RETURN true; END IF;
    END LOOP;
  END IF;
  RETURN false;
END $$;

-- Verdict + distance for a position against the post / company geofences.
CREATE OR REPLACE FUNCTION public.clock_fence_check(p_user uuid, p_company uuid, p_event uuid, p_lat double precision, p_lng double precision)
RETURNS TABLE (verdict text, distance_m integer) LANGUAGE plpgsql STABLE SET search_path TO '' AS $$
DECLARE ev record; has_poly boolean;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN RETURN QUERY SELECT 'no_gps'::text, NULL::integer; RETURN; END IF;
  SELECT e.location_lat, e.location_lng, e.geofence_radius_meters INTO ev FROM public.events e WHERE e.id = p_event AND e.company_id = p_company;
  IF ev.location_lat IS NOT NULL AND ev.location_lng IS NOT NULL AND COALESCE(ev.geofence_radius_meters, 0) > 0 THEN
    distance_m := round(public.haversine_m(p_lat, p_lng, ev.location_lat, ev.location_lng));
    verdict := CASE WHEN distance_m <= ev.geofence_radius_meters THEN 'inside' ELSE 'outside' END;
    RETURN NEXT; RETURN;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.geofences g
    WHERE g.company_id = p_company AND g.is_active
      AND (g.team_id IS NULL OR g.team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = p_user))
  ) INTO has_poly;
  IF NOT has_poly THEN RETURN QUERY SELECT 'no_fence'::text, NULL::integer; RETURN; END IF;
  verdict := CASE WHEN EXISTS (
    SELECT 1 FROM public.geofences g
    WHERE g.company_id = p_company AND g.is_active
      AND (g.team_id IS NULL OR g.team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = p_user))
      AND public.point_in_geojson(g.geometry, p_lat, p_lng)
  ) THEN 'inside' ELSE 'outside' END;
  distance_m := NULL;
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.timesheet_clock_in(
  p_company_id uuid, p_shift_id uuid DEFAULT NULL, p_event_id uuid DEFAULT NULL,
  p_type text DEFAULT 'shift', p_notes text DEFAULT NULL,
  p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL, p_accuracy double precision DEFAULT NULL,
  p_id uuid DEFAULT NULL, p_client_at timestamptz DEFAULT NULL)
RETURNS public.timesheets LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_me uuid := public.get_my_user_id();
  v_now timestamp := (now() AT TIME ZONE 'utc');
  v_at timestamp := v_now;
  v_method text := 'app';
  v_event uuid := p_event_id;
  f record;
  row public.timesheets;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_memberships m WHERE m.company_id = p_company_id AND m.user_id = v_me AND COALESCE(m.status, 'active') = 'active') THEN
    RAISE EXCEPTION 'You are not a member of that company' USING ERRCODE = '42501';
  END IF;
  IF p_type NOT IN ('shift', 'admin', 'manual') THEN RAISE EXCEPTION 'Invalid clock-in type' USING ERRCODE = '22023'; END IF;
  IF p_shift_id IS NOT NULL THEN
    SELECT s.event_id INTO v_event FROM public.shifts s JOIN public.events e ON e.id = s.event_id
      WHERE s.id = p_shift_id AND s.assigned_user_id = v_me AND e.company_id = p_company_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'That shift is not assigned to you' USING ERRCODE = '42501'; END IF;
  ELSIF v_event IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = v_event AND e.company_id = p_company_id) THEN
    RAISE EXCEPTION 'Unknown operation' USING ERRCODE = '22023';
  END IF;
  -- Idempotent replay: same id already recorded for me.
  IF p_id IS NOT NULL THEN
    SELECT * INTO row FROM public.timesheets t WHERE t.id = p_id AND t.user_id = v_me;
    IF FOUND THEN RETURN row; END IF;
  END IF;
  IF p_client_at IS NOT NULL THEN
    IF p_client_at > now() + interval '2 minutes' OR p_client_at < now() - interval '12 hours' THEN
      RAISE EXCEPTION 'Offline clock-in time is out of range' USING ERRCODE = '22023';
    END IF;
    v_at := (p_client_at AT TIME ZONE 'utc'); v_method := 'app_offline';
  END IF;
  IF EXISTS (SELECT 1 FROM public.timesheets t WHERE t.user_id = v_me AND t.company_id = p_company_id AND t.clock_out IS NULL) THEN
    RAISE EXCEPTION 'You are already clocked in' USING ERRCODE = '23505';
  END IF;
  SELECT * INTO f FROM public.clock_fence_check(v_me, p_company_id, v_event, p_lat, p_lng);
  INSERT INTO public.timesheets (id, user_id, company_id, shift_id, event_id, clock_in, clock_method, clock_in_type, notes,
    break_minutes, approved, qb_synced, created_at, updated_at,
    clock_in_lat, clock_in_lng, clock_in_accuracy_m, clock_in_distance_m, clock_in_geofence, client_clock_in)
  VALUES (COALESCE(p_id, gen_random_uuid()), v_me, p_company_id, p_shift_id, v_event, v_at, v_method, p_type, left(p_notes, 1000),
    0, false, false, v_now, v_now,
    p_lat, p_lng, p_accuracy, f.distance_m, f.verdict, CASE WHEN p_client_at IS NOT NULL THEN (p_client_at AT TIME ZONE 'utc') END)
  RETURNING * INTO row;
  RETURN row;
END $$;

CREATE OR REPLACE FUNCTION public.timesheet_clock_out(
  p_id uuid, p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL,
  p_accuracy double precision DEFAULT NULL, p_client_at timestamptz DEFAULT NULL)
RETURNS public.timesheets LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_me uuid := public.get_my_user_id();
  v_now timestamp := (now() AT TIME ZONE 'utc');
  v_at timestamp := v_now;
  t public.timesheets;
  f record;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO t FROM public.timesheets x WHERE x.id = p_id AND x.user_id = v_me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Timesheet not found' USING ERRCODE = '42501'; END IF;
  IF t.clock_out IS NOT NULL THEN RETURN t; END IF; -- idempotent replay
  IF p_client_at IS NOT NULL THEN
    IF p_client_at > now() + interval '2 minutes' OR p_client_at < now() - interval '12 hours' OR (p_client_at AT TIME ZONE 'utc') < t.clock_in THEN
      RAISE EXCEPTION 'Offline clock-out time is out of range' USING ERRCODE = '22023';
    END IF;
    v_at := (p_client_at AT TIME ZONE 'utc');
  END IF;
  SELECT * INTO f FROM public.clock_fence_check(v_me, t.company_id, t.event_id, p_lat, p_lng);
  UPDATE public.timesheets x SET clock_out = v_at, updated_at = v_now,
    clock_out_lat = p_lat, clock_out_lng = p_lng, clock_out_accuracy_m = p_accuracy,
    clock_out_distance_m = f.distance_m, clock_out_geofence = f.verdict,
    client_clock_out = CASE WHEN p_client_at IS NOT NULL THEN (p_client_at AT TIME ZONE 'utc') END,
    clock_method = CASE WHEN p_client_at IS NOT NULL AND x.clock_method = 'app' THEN 'app_offline' ELSE x.clock_method END
  WHERE x.id = p_id RETURNING * INTO t;
  RETURN t;
END $$;

REVOKE ALL ON FUNCTION public.timesheet_clock_in(uuid, uuid, uuid, text, text, double precision, double precision, double precision, uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.timesheet_clock_out(uuid, double precision, double precision, double precision, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clock_fence_check(uuid, uuid, uuid, double precision, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.timesheet_clock_in(uuid, uuid, uuid, text, text, double precision, double precision, double precision, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.timesheet_clock_out(uuid, double precision, double precision, double precision, timestamptz) TO authenticated;
COMMIT;
