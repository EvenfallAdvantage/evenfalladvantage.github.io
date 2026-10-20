SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false); -- guard A
SELECT public.ack_post_orders('51000000-0000-0000-0000-000000000001');
SELECT public.ack_post_orders('51000000-0000-0000-0000-000000000001'); -- idempotent
DO $$ BEGIN IF (SELECT count(*) FROM public.post_order_acks) <> 1 THEN RAISE EXCEPTION 'not idempotent'; END IF; END $$;
DO $$ BEGIN IF NOT (SELECT is_current FROM public.post_order_ack_status(ARRAY['51000000-0000-0000-0000-000000000001'::uuid])) THEN RAISE EXCEPTION 'should be current'; END IF; END $$;
DO $$ BEGIN IF (SELECT orders_sha256 FROM public.post_order_acks) <> public.post_orders_sha256('Stay at gate','Radio ch 3') THEN RAISE EXCEPTION 'hash'; END IF; END $$;
-- can't ack someone else's shift; can't insert directly
DO $$ BEGIN BEGIN PERFORM public.ack_post_orders('51000000-0000-0000-0000-000000000002'); RAISE EXCEPTION 'acked other shift'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
DO $$ BEGIN BEGIN INSERT INTO public.post_order_acks(company_id,event_id,shift_id,user_id,orders_sha256) VALUES (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'x'); RAISE EXCEPTION 'direct insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
-- orders change -> stale
RESET ROLE; UPDATE public.events SET post_orders='Stay at gate. NEW: no re-entry after 10pm'; SET ROLE authenticated;
DO $$ BEGIN IF (SELECT is_current FROM public.post_order_ack_status(ARRAY['51000000-0000-0000-0000-000000000001'::uuid])) THEN RAISE EXCEPTION 'should be stale'; END IF; END $$;
-- manager sees it, other company guard doesn't
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
DO $$ BEGIN IF (SELECT count(*) FROM public.post_order_ack_status(ARRAY['51000000-0000-0000-0000-000000000001'::uuid])) <> 1 OR (SELECT count(*) FROM public.post_order_acks) <> 1 THEN RAISE EXCEPTION 'manager view'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
DO $$ BEGIN IF (SELECT count(*) FROM public.post_order_ack_status(ARRAY['51000000-0000-0000-0000-000000000001'::uuid])) <> 0 OR (SELECT count(*) FROM public.post_order_acks) <> 0 THEN RAISE EXCEPTION 'leak'; END IF; END $$;
RESET ROLE;
