-- =============================================================================
-- PENDING / NOT APPLIED: migrations/pending/integration_cron.sql (PR #69)
-- Kept outside migrations/ so the CLI never pushes it by accident. When the
-- user has set both secrets below, apply it via MCP apply_migration (name
-- integration_cron), then move it to migrations/<recorded version>_integration_cron.sql.
-- Target: OverwatchDB (nneueuvyeohwnspbwfub) ONLY. Apply LAST, after
--   20261017232039_integration_framework.sql, after integration-token-refresh
--   and integration-jobs-worker are deployed, and after the user has:
--     1. set the Edge Function secret INTEGRATIONS_CRON_SECRET (random 32+ bytes)
--     2. stored the SAME value in Vault:
--          select vault.create_secret('<value>', 'integrations_cron_secret');
--   pg_cron 1.6.4 and pg_net 0.20.0 are already installed on OverwatchDB
--   (checked 2026-10-17), so the CREATE EXTENSION lines are no-ops.
-- Rollback: rollback/pending_integration_cron.rollback.sql
-- Schedules: token refresh every 10 min, jobs worker every minute,
--            purge expired oauth states daily.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $guard$
BEGIN
  IF to_regclass('public.integration_connections') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261017232039_integration_framework.sql first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'integrations_cron_secret') THEN
    RAISE EXCEPTION 'Create the Vault secret integrations_cron_secret first (same value as INTEGRATIONS_CRON_SECRET)';
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.integration_cron_call(p_function text)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT net.http_post(
    url     := 'https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/' || p_function,
    headers := jsonb_build_object('Content-Type', 'application/json',
                 'x-integrations-cron-secret',
                 (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'integrations_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000);
$fn$;
REVOKE ALL ON FUNCTION public.integration_cron_call(text) FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('integration-token-refresh', '*/10 * * * *', $$SELECT public.integration_cron_call('integration-token-refresh')$$);
SELECT cron.schedule('integration-jobs-worker', '* * * * *', $$SELECT public.integration_cron_call('integration-jobs-worker')$$);
SELECT cron.schedule('integration-oauth-state-purge', '17 3 * * *',
  $$DELETE FROM public.integration_oauth_states WHERE expires_at < now() - interval '1 day'$$);
COMMIT;
