SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false); -- guard A
INSERT INTO public.incident_statements(id,incident_id,company_id,full_name,statement,taken_by)
VALUES ('5a000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Jo Witness','I saw it','a0000000-0000-0000-0000-00000000000a');
-- wrong company for the incident
DO $$ BEGIN BEGIN INSERT INTO public.incident_statements(incident_id,company_id,full_name,taken_by) VALUES ('f0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','X','a0000000-0000-0000-0000-00000000000a'); RAISE EXCEPTION 'cross-company insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
-- taken_by spoofing
DO $$ BEGIN BEGIN INSERT INTO public.incident_statements(incident_id,company_id,full_name,taken_by) VALUES ('f0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','X','b0000000-0000-0000-0000-00000000000b'); RAISE EXCEPTION 'spoofed taker';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
-- edit while unsigned, then sign
UPDATE public.incident_statements SET statement='I saw it clearly' WHERE id='5a000000-0000-0000-0000-000000000001';
UPDATE public.incident_statements SET signature_png='data:image/png;base64,AAAA', statement_sha256='h' WHERE id='5a000000-0000-0000-0000-000000000001';
DO $$ BEGIN IF (SELECT signed_at FROM public.incident_statements WHERE id='5a000000-0000-0000-0000-000000000001') IS NULL OR (SELECT statement_sha256 FROM public.incident_statements WHERE id='5a000000-0000-0000-0000-000000000001') <> encode(sha256(convert_to(E'Jo Witness\nwitness\nI saw it clearly\nfalse','UTF8')),'hex') THEN RAISE EXCEPTION 'signed_at/hash not set'; END IF; END $$;
-- locked after signing (policy hides it from UPDATE -> 0 rows)
UPDATE public.incident_statements SET statement='changed' WHERE id='5a000000-0000-0000-0000-000000000001';
DO $$ BEGIN IF (SELECT statement FROM public.incident_statements WHERE id='5a000000-0000-0000-0000-000000000001') <> 'I saw it clearly' THEN RAISE EXCEPTION 'edited after signing'; END IF; END $$;
-- bad signature payload
DO $$ BEGIN BEGIN INSERT INTO public.incident_statements(incident_id,company_id,full_name,taken_by,signature_png) VALUES ('f0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Y','a0000000-0000-0000-0000-00000000000a','javascript:alert(1)'); RAISE EXCEPTION 'bad sig accepted';
  EXCEPTION WHEN check_violation THEN NULL; END; END $$;
-- other company can't see
SELECT set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
DO $$ BEGIN IF (SELECT count(*) FROM public.incident_statements) <> 0 THEN RAISE EXCEPTION 'leak'; END IF; END $$;
-- even the table owner can't edit a signed statement (trigger)
RESET ROLE;
DO $$ BEGIN BEGIN UPDATE public.incident_statements SET statement='owner edit'; RAISE EXCEPTION 'owner edited';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
-- manager can delete
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
DELETE FROM public.incident_statements WHERE id='5a000000-0000-0000-0000-000000000001';
DO $$ BEGIN IF (SELECT count(*) FROM public.incident_statements) <> 0 THEN RAISE EXCEPTION 'manager delete failed'; END IF; END $$;
RESET ROLE;
