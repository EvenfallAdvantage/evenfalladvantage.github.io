-- =============================================================================
-- ROLLBACK for 20261007190000_integrations_config_secrets_to_vault.sql
-- Target: OverwatchDB (project nneueuvyeohwnspbwfub) ONLY. Run by hand.
-- Copies Vault secrets created by that migration back into config (plaintext
-- again!) and unlinks them. Only needed if the E frontend/functions are rolled
-- back, because the old client-side Airtable code reads config.api_key.
-- Leaves the Vault secrets in place (delete them by hand afterwards if wanted).
-- =============================================================================

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.integrations_config') IS NULL OR to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'Wrong database: this rollback is for OverwatchDB (nneueuvyeohwnspbwfub)';
  END IF;
END
$guard$;

UPDATE public.integrations_config ic
   SET config = (ic.config - 'secret_keys_set') || (ds.decrypted_secret)::jsonb,
       vault_secret_id = NULL,
       updated_at = now()
  FROM vault.decrypted_secrets ds
 WHERE ds.id = ic.vault_secret_id
   AND ic.provider NOT IN ('email', 'sms')
   AND ds.description LIKE 'Moved from integrations_config.config by 20261007190000%';

COMMIT;
