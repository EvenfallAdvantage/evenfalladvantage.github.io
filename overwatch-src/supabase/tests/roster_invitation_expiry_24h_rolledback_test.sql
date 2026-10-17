-- Rolled-back test for 20261017230500_roster_invitation_expiry_24h.sql (OverwatchDB).
-- Run as ONE request: [before] + migration body + [checks] + rollback body + [final]. The final RAISE aborts everything.
CREATE TEMP TABLE _t(k text, v text) ON COMMIT DROP;
INSERT INTO _t SELECT 'def_before', md5(pg_get_functiondef('public.upsert_roster_invitation(uuid,uuid,text,uuid,jsonb)'::regprocedure));
INSERT INTO _t SELECT 'acl_before', proacl::text FROM pg_proc WHERE oid='public.upsert_roster_invitation(uuid,uuid,text,uuid,jsonb)'::regprocedure;
INSERT INTO _t SELECT 'rows_before', md5(coalesce(string_agg(to_jsonb(r)::text, '|' ORDER BY id), '')) FROM public.roster_invitations r;
--@@MIGRATION@@
DO $c$
DECLARE ef uuid := '0f03bc15-aa8d-4bd3-956f-90bdd7904091'; u uuid := gen_random_uuid(); m uuid := gen_random_uuid(); r public.roster_invitations; d text;
BEGIN
  d := pg_get_functiondef('public.upsert_roster_invitation(uuid,uuid,text,uuid,jsonb)'::regprocedure);
  INSERT INTO _t VALUES ('def_only_interval_changed', (md5(replace(d, '24 hours', '7 days')) = (SELECT v FROM _t WHERE k='def_before'))::text);
  INSERT INTO _t SELECT 'acl_same', (proacl::text = (SELECT v FROM _t WHERE k='acl_before'))::text FROM pg_proc WHERE oid='public.upsert_roster_invitation(uuid,uuid,text,uuid,jsonb)'::regprocedure;
  INSERT INTO _t SELECT 'definer_searchpath', (prosecdef AND proconfig = ARRAY['search_path=""'])::text FROM pg_proc WHERE oid='public.upsert_roster_invitation(uuid,uuid,text,uuid,jsonb)'::regprocedure;
  INSERT INTO _t VALUES ('rows_unchanged', ((SELECT md5(coalesce(string_agg(to_jsonb(x)::text, '|' ORDER BY id), '')) FROM public.roster_invitations x) = (SELECT v FROM _t WHERE k='rows_before'))::text);
  -- fixture: unlinked test user + EF membership
  INSERT INTO public.users (id, email, first_name, last_name, created_at, updated_at) VALUES (u, 'zztest-invite-expiry@example.invalid', 'ZZ', 'Test', now(), now());
  INSERT INTO public.company_memberships (id, user_id, company_id, role, status, work_preferences, notification_days, created_at, updated_at)
    VALUES (m, u, ef, 'staff', 'active', ARRAY[]::text[], ARRAY['Mon']::text[], now(), now());
  r := public.upsert_roster_invitation(ef, m, 'zztest-invite-expiry@example.invalid', NULL, '{}'::jsonb);
  INSERT INTO _t VALUES ('insert_expiry', (r.expires_at - r.sent_at)::text), ('insert_resend_count', r.resend_count::text);
  UPDATE public.roster_invitations SET accepted_at = now() WHERE id = r.id;
  r := public.upsert_roster_invitation(ef, m, 'zztest-invite-expiry@example.invalid', NULL, '{"resend":true}'::jsonb);
  INSERT INTO _t VALUES ('resend_expiry', (r.expires_at - r.sent_at)::text), ('resend_count', r.resend_count::text), ('resend_reset_accepted', (r.accepted_at IS NULL)::text);
  -- cross-company accept window (accept_roster_invitation case 2 needs expires_at > now()): open now, closed after 24h
  INSERT INTO _t VALUES ('open_now', (r.expires_at > now())::text), ('open_after_25h', (r.expires_at > now() + interval '25 hours')::text);
END $c$;
--@@ROLLBACK@@
DO $f$ DECLARE s text; BEGIN
  INSERT INTO _t SELECT 'def_restored_by_rollback', (md5(pg_get_functiondef('public.upsert_roster_invitation(uuid,uuid,text,uuid,jsonb)'::regprocedure)) = (SELECT v FROM _t WHERE k='def_before'))::text;
  SELECT string_agg(k || '=' || v, ' | ' ORDER BY k) INTO s FROM _t WHERE k NOT IN ('def_before','acl_before','rows_before');
  RAISE EXCEPTION 'TEST_RESULT %', s;
END $f$;
