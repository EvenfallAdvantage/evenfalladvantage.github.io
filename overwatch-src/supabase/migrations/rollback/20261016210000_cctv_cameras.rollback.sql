DROP FUNCTION IF EXISTS public.cctv_mark_stale(text, timestamptz);
DROP FUNCTION IF EXISTS public.cctv_cameras_bbox(double precision, double precision, double precision, double precision, integer, integer, integer);
DROP TABLE IF EXISTS public.cctv_source_status;
DROP TABLE IF EXISTS public.cctv_cameras;
