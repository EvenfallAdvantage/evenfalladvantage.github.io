-- Rollback for integration_cron_secret_vault. Roll back integration_cron first
-- (its jobs send this secret). Deletes the Vault secret without reading it.
BEGIN;
DROP FUNCTION IF EXISTS public.integration_cron_secret_matches(text);
DELETE FROM vault.secrets WHERE name = 'integrations_cron_secret';
COMMIT;
