-- Rollback for 20261011000000_integration_framework.sql (OverwatchDB only).
-- Deletes the Vault secrets the framework created (named 'integration-conn:%'),
-- then drops the framework tables and functions. integrations_config is untouched.
BEGIN;
DO $v$
BEGIN
  IF to_regclass('public.integration_connections') IS NOT NULL THEN
    DELETE FROM vault.secrets s USING public.integration_connections c
     WHERE s.id = c.vault_secret_id AND s.name LIKE 'integration-conn:%';
  END IF;
END
$v$;
DROP FUNCTION IF EXISTS public.integration_claim_jobs(integer);
DROP FUNCTION IF EXISTS public.integration_release_refresh_lock(uuid, uuid);
DROP FUNCTION IF EXISTS public.integration_acquire_refresh_lock(uuid, integer);
DROP TABLE IF EXISTS public.employee_external_ids;
DROP TABLE IF EXISTS public.integration_jobs;
DROP TABLE IF EXISTS public.integration_events;
DROP TABLE IF EXISTS public.integration_oauth_states;
DROP TABLE IF EXISTS public.integration_connections;
DROP FUNCTION IF EXISTS public.integration_touch_updated_at();
COMMIT;
