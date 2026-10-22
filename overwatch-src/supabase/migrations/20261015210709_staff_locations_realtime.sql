-- Operations map: deliver live staff position changes over Supabase Realtime.
--
-- The client already subscribes (subscribeStaffLocations, postgres_changes on
-- public.staff_locations filtered by company_id), but the table was never in
-- the supabase_realtime publication, so only the 30s poll worked.
--
-- Security: Realtime evaluates the table's RLS SELECT policy for each
-- subscriber's JWT before delivering INSERT/UPDATE payloads.
-- staff_locations_read limits SELECT to members of the row's company, so a
-- subscriber only receives rows they could already read via REST. RLS is
-- asserted enabled below so this migration fails closed if that changes.
-- DELETE events carry only the primary key (default replica identity), and
-- the client just refetches on any event.

DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.staff_locations'::regclass) THEN
    RAISE EXCEPTION 'staff_locations must have RLS enabled before joining supabase_realtime';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'staff_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_locations;
  END IF;
END $$;

-- Rollback:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.staff_locations;
