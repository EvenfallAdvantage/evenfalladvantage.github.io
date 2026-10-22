-- Local RLS test for 20261020055029_push_subscriptions (scratch Postgres + stub only).
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh,auth) VALUES ('a0000000-0000-0000-0000-00000000000a','https://push.example/1','BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM','tBHItJI5svbpez7KI4CCXg');
DO $$ BEGIN
  BEGIN INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh,auth) VALUES ('b0000000-0000-0000-0000-00000000000b','https://push.example/2','BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ','tBHItJI5svbpez7K');
    RAISE EXCEPTION 'insert for another user should fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh,auth) VALUES ('a0000000-0000-0000-0000-00000000000a','http://insecure','BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ','tBHItJI5svbpez7K');
    RAISE EXCEPTION 'non-https endpoint should fail';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
DO $$ BEGIN IF (SELECT count(*) FROM public.push_subscriptions) <> 0 THEN RAISE EXCEPTION 'other user can see subs'; END IF; END $$;
DELETE FROM public.push_subscriptions; -- no rows visible, deletes nothing
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM public.push_subscriptions) <> 1 THEN RAISE EXCEPTION 'other user deleted a sub'; END IF; END $$;
DELETE FROM public.push_subscriptions;
