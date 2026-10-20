-- Local RLS test for 20261020030000_sos_hardening (run against a scratch Postgres with
-- /workspace stub, never against OverwatchDB). Fails loudly on any wrong outcome.
INSERT INTO public.panic_alerts(id,user_id,company_id,status,escalated) VALUES
 ('e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','c0000000-0000-0000-0000-000000000001','active',false);
SET ROLE authenticated;
-- guard A (sender) can append a point
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
INSERT INTO public.panic_alert_locations(alert_id,company_id,user_id,lat,lng) VALUES ('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a',34,-118);
-- manager A can read it but cannot append for the guard
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
DO $$ BEGIN IF (SELECT count(*) FROM public.panic_alert_locations) <> 1 THEN RAISE EXCEPTION 'manager should see 1 point'; END IF; END $$;
DO $$ BEGIN
  BEGIN INSERT INTO public.panic_alert_locations(alert_id,company_id,user_id,lat,lng) VALUES ('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a',1,1);
    RAISE EXCEPTION 'manager insert should fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- guard B (other company) sees nothing
SELECT set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
DO $$ BEGIN IF (SELECT count(*) FROM public.panic_alert_locations) <> 0 THEN RAISE EXCEPTION 'cross-tenant leak'; END IF; END $$;
-- guard A can mark own alert false_alarm, but not resolved
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
DO $$ BEGIN
  BEGIN UPDATE public.panic_alerts SET status='resolved' WHERE id='e0000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'sender resolve should fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE public.panic_alerts SET status='false_alarm' WHERE id='e0000000-0000-0000-0000-000000000001';
-- closed alert: no more points
DO $$ BEGIN
  BEGIN INSERT INTO public.panic_alert_locations(alert_id,company_id,user_id,lat,lng) VALUES ('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a',1,1);
    RAISE EXCEPTION 'insert after close should fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT status FROM public.panic_alerts WHERE id='e0000000-0000-0000-0000-000000000001') <> 'false_alarm' THEN RAISE EXCEPTION 'status not updated'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='panic_alerts') THEN RAISE EXCEPTION 'not published'; END IF; END $$;
DELETE FROM public.panic_alerts;
