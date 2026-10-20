INSERT INTO public.patrol_logs(id,company_id,checkpoint_id,user_id,scan_method,scan_accuracy_m,scan_distance_m,gps_verified)
VALUES (gen_random_uuid(),'c0000000-0000-0000-0000-000000000001',gen_random_uuid(),'a0000000-0000-0000-0000-00000000000a','nfc',5,12,true);
DO $$ BEGIN BEGIN INSERT INTO public.patrol_logs(id,company_id,checkpoint_id,user_id,scan_method) VALUES (gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'teleport'); RAISE EXCEPTION 'bad method accepted';
  EXCEPTION WHEN check_violation THEN NULL; END; END $$;
