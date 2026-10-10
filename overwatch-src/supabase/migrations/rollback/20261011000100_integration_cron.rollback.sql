-- Rollback for 20261011000100_integration_cron.sql. Leaves the extensions installed
-- (drop them by hand only if nothing else uses them) and the Vault secret in place.
BEGIN;
DO $u$
DECLARE j text;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOREACH j IN ARRAY ARRAY['integration-token-refresh','integration-jobs-worker','integration-oauth-state-purge'] LOOP
      PERFORM cron.unschedule(j) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = j);
    END LOOP;
  END IF;
END
$u$;
DROP FUNCTION IF EXISTS public.integration_cron_call(text);
COMMIT;
