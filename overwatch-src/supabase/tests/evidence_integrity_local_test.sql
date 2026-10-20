-- Local test for 20261020033000_evidence_integrity (scratch Postgres + stub only).
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false); -- guard A
INSERT INTO public.incident_media(id,incident_id,file_url,file_type,file_name,uploaded_by,hash,captured_at,capture_lat,capture_lng,capture_source)
VALUES ('aa000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','x','photo','p.jpg','a0000000-0000-0000-0000-00000000000a','abc123',now(),34,-118,'camera');
DO $$ BEGIN IF (SELECT count(*) FROM public.evidence_custody_log WHERE action='uploaded' AND hash='abc123') <> 1 THEN RAISE EXCEPTION 'upload not logged'; END IF; END $$;
-- direct writes to the log are refused
DO $$ BEGIN BEGIN INSERT INTO public.evidence_custody_log(media_id,incident_id,company_id,action) VALUES (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'viewed'); RAISE EXCEPTION 'direct insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
DO $$ BEGIN BEGIN DELETE FROM public.evidence_custody_log; RAISE EXCEPTION 'delete allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
DO $$ BEGIN BEGIN UPDATE public.evidence_custody_log SET note='x'; RAISE EXCEPTION 'update allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
-- verify: matching hash -> verified, wrong -> verify_failed
SELECT public.log_evidence_event('aa000000-0000-0000-0000-000000000001','verified','ABC123');
SELECT public.log_evidence_event('aa000000-0000-0000-0000-000000000001','verified','zzz');
SELECT public.log_evidence_event('aa000000-0000-0000-0000-000000000001','viewed');
DO $$ BEGIN IF (SELECT string_agg(action, ',' ORDER BY created_at, action) FROM public.evidence_custody_log) IS NULL
  OR (SELECT count(*) FROM public.evidence_custody_log WHERE action='verified') <> 1
  OR (SELECT count(*) FROM public.evidence_custody_log WHERE action='verify_failed') <> 1 THEN RAISE EXCEPTION 'verify logic'; END IF; END $$;
DO $$ BEGIN BEGIN PERFORM public.log_evidence_event('aa000000-0000-0000-0000-000000000001','deleted'); RAISE EXCEPTION 'forged delete allowed';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END; END $$;
-- other company cannot see or log
SELECT set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
DO $$ BEGIN IF (SELECT count(*) FROM public.evidence_custody_log) <> 0 THEN RAISE EXCEPTION 'cross-tenant leak'; END IF; END $$;
DO $$ BEGIN BEGIN PERFORM public.log_evidence_event('aa000000-0000-0000-0000-000000000001','viewed'); RAISE EXCEPTION 'cross-tenant log';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
-- hash is write-once (as table owner, bypassing RLS, to prove the trigger)
RESET ROLE;
DO $$ BEGIN BEGIN UPDATE public.incident_media SET hash='tampered'; RAISE EXCEPTION 'hash changed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
-- manager deletes the file: log survives with a 'deleted' row
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
DELETE FROM public.incident_media WHERE id='aa000000-0000-0000-0000-000000000001';
DO $$ BEGIN IF (SELECT count(*) FROM public.evidence_custody_log WHERE action='deleted') <> 1 OR (SELECT count(*) FROM public.evidence_custody_log) <> 5 THEN RAISE EXCEPTION 'delete not logged / log lost'; END IF; END $$;
RESET ROLE;
