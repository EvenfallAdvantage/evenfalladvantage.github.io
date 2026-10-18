-- =============================================================================
-- 20261018004232_integration_cron (OverwatchDB nneueuvyeohwnspbwfub ONLY), PR #69 follow-up.
-- APPLIED 2026-10-17 17:42 PT, version 20261018004232.
-- Apply AFTER integration_framework and 20261018004108_integration_cron_secret_vault (which
-- generates the Vault secret 'integrations_cron_secret' in-database). The jobs
-- send it as x-integrations-cron-secret; the Edge functions check it against
-- Vault via integration_cron_secret_matches(). No Edge secret is involved.
--   pg_cron 1.6.4 and pg_net 0.20.0 are already installed on OverwatchDB
--   (checked 2026-10-17), so the CREATE EXTENSION lines are no-ops.
-- Rollback: rollback/20261018004232_integration_cron.rollback.sql
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
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'integrations_cron_secret') THEN
    RAISE EXCEPTION 'Apply integration_cron_secret_vault first (creates Vault secret integrations_cron_secret)';
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
