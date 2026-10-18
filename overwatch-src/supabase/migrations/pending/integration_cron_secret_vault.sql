-- =============================================================================
-- integration_cron_secret_vault (OverwatchDB nneueuvyeohwnspbwfub ONLY)
-- Vault-only secret for the integration cron calls, mirroring intel-cctv-ingest:
--   * generates a random secret INSIDE the database and stores it in Vault as
--     'integrations_cron_secret' (only if absent). The value is never returned,
--     selected back, logged or committed; nobody needs to know it.
--   * public.integration_cron_secret_matches(candidate) -> boolean, for
--     integration-token-refresh / integration-jobs-worker (service_role only).
--     Compares sha256 digests, so timing does not depend on how many leading
--     characters of the secret match.
-- There is no INTEGRATIONS_CRON_SECRET Edge secret any more.
-- Rollback: rollback/<version>_integration_cron_secret_vault.rollback.sql
-- =============================================================================
BEGIN;
DO $gen$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'integrations_cron_secret') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'integrations_cron_secret',
      'x-integrations-cron-secret for integration-token-refresh / integration-jobs-worker (pg_cron). Generated in-database; never exported.');
  END IF;
END
$gen$;

CREATE OR REPLACE FUNCTION public.integration_cron_secret_matches(candidate text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
  SELECT coalesce(
    length(coalesce(candidate, '')) >= 32
    AND s.secret IS NOT NULL
    AND extensions.digest(candidate, 'sha256') = extensions.digest(s.secret, 'sha256'),
    false)
  FROM (SELECT (SELECT decrypted_secret FROM vault.decrypted_secrets
                 WHERE name = 'integrations_cron_secret' LIMIT 1) AS secret) s;
$fn$;
REVOKE ALL ON FUNCTION public.integration_cron_secret_matches(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.integration_cron_secret_matches(text) TO service_role;
COMMIT;
