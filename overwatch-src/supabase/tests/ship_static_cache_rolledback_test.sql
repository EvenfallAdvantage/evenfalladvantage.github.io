-- Rolled-back test for 20261022030000_ship_static_cache (run with the migration body inlined, then ROLLBACK).
-- Checks: static for an unknown ship is kept; a later new ship row gets its type; RLS on; no anon/auth grants.
DO $t$
DECLARE v smallint; g int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ships WHERE mmsi = 111000999) THEN RAISE EXCEPTION 'test MMSI in use'; END IF;
  PERFORM public.ships_static_upsert('[{"mmsi":111000999,"name":"ZZTEST VESSEL","ship_type":52,"length_m":30}]'::jsonb);
  SELECT ship_type INTO v FROM public.ship_static WHERE mmsi = 111000999;
  IF v IS DISTINCT FROM 52 THEN RAISE EXCEPTION 'static not cached: %', v; END IF;
  PERFORM public.ships_upsert('[{"mmsi":111000999,"lat":10,"lon":10,"source":"aisstream"}]'::jsonb);
  SELECT ship_type INTO v FROM public.ships WHERE mmsi = 111000999;
  IF v IS DISTINCT FROM 52 THEN RAISE EXCEPTION 'type not filled on insert: %', v; END IF;
  PERFORM public.ships_static_upsert('[{"mmsi":111000999,"ship_type":null,"destination":"PORT"}]'::jsonb);
  SELECT ship_type INTO v FROM public.ship_static WHERE mmsi = 111000999;
  IF v IS DISTINCT FROM 52 THEN RAISE EXCEPTION 'null erased type'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ship_static'::regclass) THEN RAISE EXCEPTION 'RLS off'; END IF;
  SELECT count(*) INTO g FROM information_schema.role_table_grants WHERE table_name = 'ship_static' AND grantee IN ('anon','authenticated','PUBLIC');
  IF g > 0 THEN RAISE EXCEPTION 'unexpected grants: %', g; END IF;
  RAISE NOTICE 'ship_static_cache: all checks passed';
END
$t$;
