-- Rolled-back test for 20261015210709_staff_locations_realtime.sql.
-- Applies the migration body, checks publication membership and that the
-- RLS SELECT policy Realtime relies on limits rows to company members, then
-- aborts with RAISE EXCEPTION so nothing persists. Expected final message:
--   ROLLED BACK OK | pub=t | rls=t | member_sees=N(>0) | outsider_sees=0 | anon=0
DO $t$
DECLARE
  co uuid := '0f03bc15-aa8d-4bd3-956f-90bdd7904091';
  member_sid text := '3de4a849-3427-4c81-8ff6-ee49d330ec4d';
  outsider_sid text := 'afaa0965-ebe0-4a9d-94e4-be3553f8eab0';
  pub bool; rls bool; m int; o int; a int;
BEGIN
  -- migration body
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.staff_locations'::regclass) THEN
    RAISE EXCEPTION 'rls off';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='staff_locations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_locations;
  END IF;

  SELECT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='staff_locations') INTO pub;
  SELECT relrowsecurity FROM pg_class WHERE oid='public.staff_locations'::regclass INTO rls;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',member_sid,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO m FROM public.staff_locations WHERE company_id = co;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',outsider_sid,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO o FROM public.staff_locations WHERE company_id = co;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  BEGIN SELECT count(*) INTO a FROM public.staff_locations; EXCEPTION WHEN insufficient_privilege THEN a := 0; END;
  RESET ROLE;

  RAISE EXCEPTION 'ROLLED BACK OK | pub=% | rls=% | member_sees=% | outsider_sees=% | anon=%', pub, rls, m, o, a;
END $t$;
