-- Schedule intel-cctv-ingest every 15 minutes via pg_cron + pg_net.
--
-- PREREQUISITES (go-live, each needs approval):
--   1. 20261016212852_cctv_cameras.sql applied.
--   2. 20261016224117_cctv_ingest_secret_rpc.sql applied; intel-cctv-ingest
--      deployed with verify_jwt=false (it checks the header via that rpc).
--   3. Vault secret created in SQL (never printed):
--        select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'cctv_ingest_secret');
-- The job reads the secret from Vault at run time (btrim guards against a
-- trailing newline from copy/paste) and sends it as x-ingest-secret.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'intel-cctv-ingest') THEN
    PERFORM cron.unschedule('intel-cctv-ingest');
  END IF;
END $$;

SELECT cron.schedule(
  'intel-cctv-ingest',
  '*/15 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/intel-cctv-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-secret', (SELECT btrim(decrypted_secret, E' \n\r\t') FROM vault.decrypted_secrets WHERE name = 'cctv_ingest_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);

-- Rollback: SELECT cron.unschedule('intel-cctv-ingest');
