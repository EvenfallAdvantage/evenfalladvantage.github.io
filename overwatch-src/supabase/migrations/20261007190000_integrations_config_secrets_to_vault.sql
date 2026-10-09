-- =============================================================================
-- 20261007190000_integrations_config_secrets_to_vault.sql   (DATA migration)
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY.
-- Status: NOT APPLIED (draft, PR "HQ Config E"). Run by hand, in the order
--         given in the PR body (AFTER integration-save-credentials and
--         airtable-proxy are deployed and the E frontend is live).
-- Rollback: rollback/20261007190000_integrations_config_secrets_to_vault.rollback.sql
--
-- Moves plaintext secrets out of integrations_config.config into Supabase
-- Vault for the generic providers (not email/sms, which already use Vault).
-- Live rows read 2026-10-07 (key names only, no values were read):
--   The Guardian Team  airtable  keys = api_key, base_id, table_name   <- api_key moves
--   Evenfall           signal    keys = signal_group_link             <- nothing secret
--
-- For each affected row:
--   * vault.create_secret(json of the secret keys, 'integration:<company>:<provider>')
--   * integrations_config.vault_secret_id = new secret id
--   * secret keys removed from config; config.secret_keys_set = [names]
-- Rows that already have a vault_secret_id are skipped with a NOTICE (merge
-- them by re-saving in HQ Config, which goes through integration-save-credentials).
--
-- Airtable keeps working throughout: airtable-proxy reads Vault first and
-- falls back to the legacy plaintext key, so the order of steps is forgiving.
--
-- Secret key list must match supabase/functions/_shared/integration-secret-keys.ts.
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.integrations_config') IS NULL OR to_regclass('vault.secrets') IS NULL THEN
    RAISE EXCEPTION 'Wrong database or Vault missing: this migration is for OverwatchDB (nneueuvyeohwnspbwfub)';
  END IF;
END
$guard$;

DO $move$
DECLARE
  secret_keys text[] := ARRAY['api_key','access_token','auth_token','rest_api_key','webhook_secret','secret_key','client_secret','refresh_token','password'];
  r record;
  secrets jsonb;
  new_id uuid;
  moved int := 0;
BEGIN
  FOR r IN
    SELECT id, company_id, provider, config, vault_secret_id
    FROM public.integrations_config
    WHERE provider NOT IN ('email', 'sms')
      AND config ?| secret_keys
    FOR UPDATE
  LOOP
    IF r.vault_secret_id IS NOT NULL THEN
      RAISE NOTICE 'skip % / %: already has vault_secret_id; re-save it in HQ Config', r.company_id, r.provider;
      CONTINUE;
    END IF;

    SELECT jsonb_object_agg(key, value) INTO secrets
    FROM jsonb_each(r.config)
    WHERE key = ANY (secret_keys) AND jsonb_typeof(value) = 'string' AND value #>> '{}' <> '';

    IF secrets IS NULL THEN
      -- only empty secret keys: just strip them
      UPDATE public.integrations_config
         SET config = (r.config - secret_keys), updated_at = now()
       WHERE id = r.id;
      CONTINUE;
    END IF;

    new_id := vault.create_secret(secrets::text, 'integration:' || r.company_id || ':' || r.provider, 'Moved from integrations_config.config by 20261007190000');

    UPDATE public.integrations_config
       SET vault_secret_id = new_id,
           config = (r.config - secret_keys)
                    || jsonb_build_object('secret_keys_set', (SELECT jsonb_agg(k ORDER BY k) FROM jsonb_object_keys(secrets) k)),
           updated_at = now()
     WHERE id = r.id;
    moved := moved + 1;
  END LOOP;
  RAISE NOTICE 'moved % integration rows to Vault', moved;
END
$move$;

COMMIT;

-- Verify (shows key NAMES only; must return no secret key names in config):
--   select left(company_id::text,8), provider, vault_secret_id is not null as in_vault,
--          (select string_agg(k, ',') from jsonb_object_keys(config) k) as config_keys
--   from public.integrations_config order by 1, 2;
