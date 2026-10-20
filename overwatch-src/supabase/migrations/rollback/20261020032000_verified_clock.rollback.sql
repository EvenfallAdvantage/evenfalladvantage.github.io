-- Rollback for 20261020032000_verified_clock. Drops the RPCs/helpers and the new
-- timesheets columns (their GPS / fence data is lost; clock_in/out are untouched).
BEGIN;
DROP FUNCTION IF EXISTS public.timesheet_clock_out(uuid, double precision, double precision, double precision, timestamptz);
DROP FUNCTION IF EXISTS public.timesheet_clock_in(uuid, uuid, uuid, text, text, double precision, double precision, double precision, uuid, timestamptz);
DROP FUNCTION IF EXISTS public.clock_fence_check(uuid, uuid, uuid, double precision, double precision);
DROP FUNCTION IF EXISTS public.point_in_geojson(jsonb, double precision, double precision);
DROP FUNCTION IF EXISTS public.point_in_ring(jsonb, double precision, double precision);
DROP FUNCTION IF EXISTS public.haversine_m(double precision, double precision, double precision, double precision);
ALTER TABLE public.timesheets
  DROP COLUMN IF EXISTS clock_in_lat, DROP COLUMN IF EXISTS clock_in_lng, DROP COLUMN IF EXISTS clock_in_accuracy_m,
  DROP COLUMN IF EXISTS clock_in_distance_m, DROP COLUMN IF EXISTS clock_in_geofence, DROP COLUMN IF EXISTS client_clock_in,
  DROP COLUMN IF EXISTS clock_out_lat, DROP COLUMN IF EXISTS clock_out_lng, DROP COLUMN IF EXISTS clock_out_accuracy_m,
  DROP COLUMN IF EXISTS clock_out_distance_m, DROP COLUMN IF EXISTS clock_out_geofence, DROP COLUMN IF EXISTS client_clock_out;
COMMIT;
